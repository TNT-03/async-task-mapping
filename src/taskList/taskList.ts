import { TaskClearedError, TaskTimeoutError } from "../errors";
import { startTimer, watchAbort } from "../internal/lifecycle";
import { Thenable } from "../internal/thenable";
import type { TaskList, TaskListResult, TaskListStatus } from "./types";

export interface TaskListConfig {
  ordered: boolean;
  taskCount: number;
  resolveCount: number;
  timeout: number | undefined;
  signal: AbortSignal | undefined;
}

type RoundState = "static" | "pending" | "fulfilled" | "rejected";

interface Waiter<T> {
  resolve: (result: TaskListResult<T>) => void;
  reject: (reason: unknown) => void;
}

interface Failure {
  reason: unknown;
}

/**
 * 有序 / 无序任务列表共用的单一状态机。
 * 一"轮"指从首个 request 到所有 request 名额用完并结算为止。
 */
export class TaskListImpl<T>
  extends Thenable<TaskListResult<T>>
  implements TaskList<T>
{
  readonly #ordered: boolean;
  readonly #taskCount: number;
  readonly #resolveCount: number;
  readonly #timeout: number | undefined;

  #state: RoundState = "static";
  #paused = false;
  /** 本轮已绑定的 request 数量(包含结算后立即返回结果的) */
  #boundRequests = 0;
  #waiters: Waiter<T>[] = [];
  #values: T[] = [];
  #named = new Map<string, T>();
  /** 已记录的失败;paused 期间 pushReject 只记录,running 后才分发 */
  #failure: Failure | null = null;
  #result: TaskListResult<T> | null = null;
  #cancelTimer: (() => void) | null = null;
  #aborted: Failure | null = null;

  constructor(config: TaskListConfig) {
    super();
    this.#ordered = config.ordered;
    this.#taskCount = config.taskCount;
    this.#resolveCount = config.resolveCount;
    this.#timeout = config.timeout;

    if (config.signal) {
      // 只持有弱引用,避免长寿命的 signal 把实例钉在内存里
      const self = new WeakRef(this);
      watchAbort(config.signal, (reason) => {
        const target = self.deref();
        if (target) {
          target.#abort(reason);
        }
      });
    }
  }

  override request(): Promise<TaskListResult<T>> {
    if (this.#aborted) {
      return Promise.reject(this.#aborted.reason);
    }
    if (this.#isDrained()) {
      this.#resetRound();
    }
    if (this.#boundRequests >= this.#taskCount) {
      return Promise.reject(new RangeError("Too many request bound"));
    }
    this.#boundRequests++;

    if (this.#state === "fulfilled" && this.#result) {
      return Promise.resolve(this.#result);
    }
    if (this.#state === "rejected" && this.#failure) {
      return Promise.reject(this.#failure.reason);
    }

    if (this.#state === "static") {
      this.#state = "pending";
      this.#startTimeout();
    }
    return new Promise<TaskListResult<T>>((resolve, reject) => {
      this.#waiters.push({ resolve, reject });
    });
  }

  pushResolve(data: T, name?: string): void {
    if (this.#aborted) {
      // 实例已被 abort:生产者不一定知道消费端取消了,静默丢弃数据
      return;
    }
    this.#assertCanPush();
    if (this.#values.length >= this.#resolveCount) {
      throw new RangeError("Too many pushResolve bound");
    }
    this.#values.push(data);
    if (name) {
      this.#named.set(name, data);
    }
    this.#flush();
  }

  pushReject(reason: unknown): void {
    if (this.#aborted) {
      return;
    }
    this.#assertCanPush();
    this.#failure = { reason };
    this.#flush();
  }

  clear(): void {
    this.#discardRound(new TaskClearedError());
  }

  paused(): void {
    this.#paused = true;
  }

  running(): void {
    this.#paused = false;
    this.#flush();
  }

  getStatus(): TaskListStatus {
    return {
      requestDone: this.#boundRequests === this.#taskCount,
      responseDone: this.#values.length === this.#resolveCount,
      requestCount: this.#boundRequests,
      responseCount: this.#values.length,
    };
  }

  /** 本轮已结算且所有 request 名额都已用完,下一次 request 应开启新一轮 */
  #isDrained(): boolean {
    return (
      (this.#state === "fulfilled" || this.#state === "rejected") &&
      this.#boundRequests === this.#taskCount
    );
  }

  #assertCanPush(): void {
    if (this.#failure) {
      throw new Error(
        "The task list has been rejected, call clear() before pushing again",
      );
    }
    if (this.#ordered && this.#boundRequests !== this.#taskCount) {
      throw new Error("Please bind the request before binding the pushResolve");
    }
  }

  #flush(): void {
    if (this.#paused) {
      return;
    }
    if (this.#failure) {
      this.#settleRejected(this.#failure.reason);
    } else if (
      this.#state !== "fulfilled" &&
      this.#values.length === this.#resolveCount
    ) {
      this.#settleFulfilled();
    }
  }

  #settleFulfilled(): void {
    // 每轮生成新的快照,不与后续轮次共享引用
    const result: TaskListResult<T> = {
      list: [...this.#values],
      dataMap: Object.fromEntries(this.#named),
    };
    this.#result = result;
    this.#state = "fulfilled";
    this.#stopTimeout();
    const waiters = this.#waiters;
    this.#waiters = [];
    for (const waiter of waiters) {
      waiter.resolve(result);
    }
  }

  #settleRejected(reason: unknown): void {
    this.#failure = { reason };
    this.#state = "rejected";
    this.#stopTimeout();
    const waiters = this.#waiters;
    this.#waiters = [];
    for (const waiter of waiters) {
      waiter.reject(reason);
    }
  }

  #startTimeout(): void {
    if (this.#timeout === undefined) {
      return;
    }
    this.#cancelTimer = startTimer(this.#timeout, () => {
      // 本轮一旦结算或被丢弃,定时器就已被取消,因此触发时一定处于 pending
      this.#cancelTimer = null;
      this.#settleRejected(new TaskTimeoutError());
    });
  }

  #stopTimeout(): void {
    this.#cancelTimer?.();
    this.#cancelTimer = null;
  }

  /** 重置为全新的一轮,不触碰仍在 pending 的 waiter */
  #resetRound(): void {
    this.#stopTimeout();
    this.#state = "static";
    this.#boundRequests = 0;
    this.#values = [];
    this.#named = new Map();
    this.#failure = null;
    this.#result = null;
  }

  /** 丢弃当前一轮:pending 的 request 以 reason reject */
  #discardRound(reason: unknown): void {
    const waiters = this.#waiters;
    this.#waiters = [];
    this.#resetRound();
    for (const waiter of waiters) {
      waiter.reject(reason);
    }
  }

  /** abort 事件只会触发一次(监听器是 once,已 aborted 的 signal 也只同步回调一次) */
  #abort(reason: unknown): void {
    this.#aborted = { reason };
    this.#discardRound(reason);
  }
}
