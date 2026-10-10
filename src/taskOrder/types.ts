export interface TaskOrderOptions {
  /** 每个 request 的超时毫秒数(> 0 且 ≤ 2147483647),超时后该 request 以 TaskTimeoutError reject 并出队 */
  timeout?: number | undefined;
  /**
   * 取消信号:abort 后等价于 `clear()`,但 pending 的 request 以 `signal.reason` reject。
   * 实例此后失效:之后的 `request()` 同样 reject,`pushResolve` / `pushReject` 被静默忽略。
   */
  signal?: AbortSignal | undefined;
}

export interface TaskOrderStatus {
  /** 尚未匹配到数据的 request 数量 */
  pendingRequests: number;
  /** 尚未匹配到 request 的数据(含 pushReject)数量 */
  pendingResolve: number;
}

export interface TaskOrder<T> extends PromiseLike<T> {
  /** 绑定一次 request,按先后顺序与 pushResolve / pushReject 一一配对 */
  request(): Promise<T>;
  then<A = T, B = never>(
    onfulfilled?: ((value: T) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B>;
  catch<B = never>(
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<T | B>;
  finally(onfinally?: (() => void) | null): Promise<T>;
  pushResolve(data: T): void;
  /** 与队首尚未匹配的 request 配对,并让它以 `reason` reject */
  pushReject(reason: unknown): void;
  /**
   * 清空所有状态:pending 的 request 以 `TaskClearedError` reject,未配对的数据被丢弃。
   * 注意:如果调用方没有 `catch`(例如只写了 `order.then(cb)`),
   * 这些 reject 会触发 `unhandledRejection`,Node.js 默认会因此终止进程。
   */
  clear(): void;
  paused(): void;
  running(): void;
  getStatus(): TaskOrderStatus;
  /** 最近一次成功匹配到的数据,尚无时为 null */
  getLastCompletedTask(): T | null;
}
