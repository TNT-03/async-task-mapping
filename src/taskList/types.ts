export interface TaskListOptions {
  /** 是否有序:有序列表必须先绑定完所有 request,才能 pushResolve。默认 `true` */
  ordered?: boolean | undefined;
  /** 可绑定的 request 次数,正整数,默认 1 */
  taskCount?: number | undefined;
  /** 可 pushResolve 的次数,正整数,默认 1 */
  resolveCount?: number | undefined;
  /** 超时毫秒数(> 0),从一轮任务进入 pending(首个 request)起计时,超时后本轮 reject */
  timeout?: number | undefined;
  /**
   * 取消信号:abort 后等价于 `clear()`,但 pending 的 request 以 `signal.reason` reject。
   * 实例此后失效:之后的 `request()` 同样 reject,`pushResolve` / `pushReject` 被静默忽略。
   */
  signal?: AbortSignal | undefined;
}

export interface TaskListResult<T> {
  readonly list: readonly T[];
  readonly dataMap: Readonly<Record<string, T>>;
}

export interface TaskListStatus {
  /** 是否已绑定完所有 request */
  requestDone: boolean;
  /** 是否已完成所有 pushResolve */
  responseDone: boolean;
  /** 已绑定的 request 数量 */
  requestCount: number;
  /** 已完成的 pushResolve 数量 */
  responseCount: number;
}

export interface TaskList<T> extends PromiseLike<TaskListResult<T>> {
  /** 绑定一次 request。超限时返回被 reject 的 Promise(RangeError) */
  request(): Promise<TaskListResult<T>>;
  then<A = TaskListResult<T>, B = never>(
    onfulfilled?: ((value: TaskListResult<T>) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B>;
  catch<B = never>(
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<TaskListResult<T> | B>;
  finally(onfinally?: (() => void) | null): Promise<TaskListResult<T>>;
  /**
   * 添加数据;超限、顺序错误、本轮已失败时同步抛错。
   * 实例已 abort 时静默忽略。
   */
  pushResolve(data: T, name?: string): void;
  /** 本轮以 `reason` 失败:所有 pending 与后续的 request 都会 reject */
  pushReject(reason: unknown): void;
  /**
   * 清空本轮状态,pending 的 request 以 `TaskClearedError` reject。
   * 注意:如果调用方没有 `catch`(例如只写了 `task.then(cb)`),
   * 这些 reject 会触发 `unhandledRejection`,Node.js 默认会因此终止进程。
   */
  clear(): void;
  /** 暂停分发:pushResolve / pushReject 仍会记录,但不会结算 request */
  paused(): void;
  /** 恢复分发,并立即尝试结算 */
  running(): void;
  getStatus(): TaskListStatus;
}
