import { TaskClearedError, TaskTimeoutError } from "../errors";
import { startTimer, watchAbortWeakly } from "../internal/lifecycle";
import { Thenable } from "../internal/thenable";
import type { AbortSignalLike } from "../types";
import type { TaskList, TaskListResult, TaskListStatus } from "./types";

export interface TaskListConfig {
  ordered: boolean;
  taskCount: number;
  resolveCount: number;
  timeout: number | undefined;
  signal: AbortSignalLike | undefined;
}

/**
 * 一轮任务的状态:
 * - static:尚无 request 绑定;
 * - pending:已有 request 绑定,等待结算;
 * - fulfilled:已成功结算,携带本轮结果;
 * - rejected:已失败(pushReject 或 timeout),携带失败原因。
 */
type Round<T> =
  | { readonly status: "static" }
  | { readonly status: "pending" }
  | { readonly status: "fulfilled"; readonly result: TaskListResult<T> }
  | { readonly status: "rejected"; readonly reason: unknown };

interface Waiter<T> {
  resolve: (result: TaskListResult<T>) => void;
  reject: (reason: unknown) => void;
}

/** 用对象包一层,以便区分"没有原因"与"原因是 undefined" */
interface Reason {
  readonly reason: unknown;
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

  #round: Round<T> = { status: "static" };
  #paused = false;
  /** 本轮已绑定的 request 数量(包含结算后立即返回结果的) */
  #boundRequests = 0;
  #waiters: Waiter<T>[] = [];
  #values: T[] = [];
  #named = new Map<string, T>();
  /** 已记录但尚未分发的失败;paused 期间 pushReject 只记录,running 后才分发。分发后移入 `#round` */
  #pendingFailure: Reason | null = null;
  #cancelTimer: (() => void) | null = null;
  #aborted: Reason | null = null;

  constructor(config: TaskListConfig) {
    super();
    this.#ordered = config.ordered;
    this.#taskCount = config.taskCount;
    this.#resolveCount = config.resolveCount;
    this.#timeout = config.timeout;

    if (config.signal) {
      // 只持有弱引用,避免长寿命的 signal 把实例钉在内存里;实例被回收后会摘除监听器
      watchAbortWeakly(config.signal, this, (target, reason) => {
        target.#abort(reason);
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

    const round = this.#round;
    switch (round.status) {
      case "fulfilled":
        return Promise.resolve(round.result);
      case "rejected":
        return Promise.reject(round.reason);
      case "static":
        this.#round = { status: "pending" };
        this.#startTimeout();
        break;
      case "pending":
        break;
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
    if (name !== undefined) {
      this.#named.set(name, data);
    }
    this.#flush();
  }

  pushReject(reason: unknown): void {
    if (this.#aborted) {
      return;
    }
    this.#assertCanPush();
    this.#pendingFailure = { reason };
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
    const status = this.#round.status;
    return (
      (status === "fulfilled" || status === "rejected") &&
      this.#boundRequests === this.#taskCount
    );
  }

  #assertCanPush(): void {
    // 无序列表:上一轮已成功结算且名额用完时,此时的 push 属于新一轮,与 request() 保持一致。
    // 有序列表必须先 request(),而 request() 会自行开启新一轮,所以这里仍按超限处理。
    // 失败的一轮不在此列,仍需 clear() 或等下一次 request() 才会结束
    if (
      !this.#ordered &&
      this.#round.status === "fulfilled" &&
      this.#isDrained()
    ) {
      this.#resetRound();
    }
    if (this.#pendingFailure || this.#round.status === "rejected") {
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
    if (this.#pendingFailure) {
      this.#settleRejected(this.#pendingFailure.reason);
      return;
    }
    // 只有尚未结算的一轮(static / pending)才可能被结算为成功;
    // 已 fulfilled 无需重复结算,已 rejected(如 timeout)则不能被后来凑齐的数据覆盖
    const status = this.#round.status;
    if (
      (status === "static" || status === "pending") &&
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
    this.#round = { status: "fulfilled", result };
    this.#stopTimeout();
    const waiters = this.#waiters;
    this.#waiters = [];
    for (const waiter of waiters) {
      waiter.resolve(result);
    }
  }

  #settleRejected(reason: unknown): void {
    this.#round = { status: "rejected", reason };
    this.#pendingFailure = null;
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
    this.#round = { status: "static" };
    this.#boundRequests = 0;
    this.#values = [];
    this.#named = new Map();
    this.#pendingFailure = null;
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
