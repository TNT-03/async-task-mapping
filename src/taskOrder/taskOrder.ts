import { TaskClearedError, TaskTimeoutError } from "../errors";
import { startTimer, watchAbort } from "../internal/lifecycle";
import { Thenable } from "../internal/thenable";
import { Queue } from "./queue";
import type { TaskOrder, TaskOrderStatus } from "./types";

export interface TaskOrderConfig {
  timeout: number | undefined;
  signal: AbortSignal | undefined;
}

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  cancelTimer: (() => void) | null;
}

type Settlement<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: unknown };

export class TaskOrderImpl<T> extends Thenable<T> implements TaskOrder<T> {
  readonly #timeout: number | undefined;
  #requests = new Queue<PendingRequest<T>>();
  #settlements = new Queue<Settlement<T>>();
  #paused = false;
  #lastCompleted: T | null = null;
  #aborted: { reason: unknown } | null = null;

  constructor(config: TaskOrderConfig) {
    super();
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

  override request(): Promise<T> {
    if (this.#aborted) {
      return Promise.reject(this.#aborted.reason);
    }
    return new Promise<T>((resolve, reject) => {
      const pending: PendingRequest<T> = { resolve, reject, cancelTimer: null };
      const node = this.#requests.push(pending);
      if (this.#timeout !== undefined) {
        pending.cancelTimer = startTimer(this.#timeout, () => {
          // request 一旦被配对或丢弃,定时器就已被取消,因此触发时节点一定还在队列中
          pending.cancelTimer = null;
          this.#requests.remove(node);
          reject(new TaskTimeoutError());
        });
      }
      this.#match();
    });
  }

  pushResolve(data: T): void {
    if (this.#aborted) {
      // 实例已被 abort:生产者不一定知道消费端取消了,静默丢弃数据
      return;
    }
    this.#settlements.push({ ok: true, value: data });
    this.#match();
  }

  pushReject(reason: unknown): void {
    if (this.#aborted) {
      return;
    }
    this.#settlements.push({ ok: false, reason });
    this.#match();
  }

  clear(): void {
    this.#discard(new TaskClearedError());
  }

  paused(): void {
    this.#paused = true;
  }

  running(): void {
    this.#paused = false;
    this.#match();
  }

  getStatus(): TaskOrderStatus {
    return {
      pendingRequests: this.#requests.size,
      pendingResolve: this.#settlements.size,
    };
  }

  getLastCompletedTask(): T | null {
    return this.#lastCompleted;
  }

  /** 把队首的 request 与队首的数据按 FIFO 一一配对,直到有一侧为空 */
  #match(): void {
    if (this.#paused) {
      return;
    }
    while (this.#requests.size > 0 && this.#settlements.size > 0) {
      // 循环条件已保证两个队列都非空,这里只是为了收窄类型
      const request = this.#requests.shift();
      const settlement = this.#settlements.shift();
      if (request && settlement) {
        request.value.cancelTimer?.();
        request.value.cancelTimer = null;
        if (settlement.value.ok) {
          this.#lastCompleted = settlement.value.value;
          request.value.resolve(settlement.value.value);
        } else {
          request.value.reject(settlement.value.reason);
        }
      }
    }
  }

  #discard(reason: unknown): void {
    const requests = this.#requests.drain();
    this.#settlements.drain();
    for (const request of requests) {
      request.cancelTimer?.();
      request.cancelTimer = null;
      request.reject(reason);
    }
  }

  /** abort 事件只会触发一次(监听器是 once,已 aborted 的 signal 也只同步回调一次) */
  #abort(reason: unknown): void {
    this.#aborted = { reason };
    this.#discard(reason);
  }
}
