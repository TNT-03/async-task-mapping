/** `clear()` 时仍处于 pending 的 request 会以此错误 reject */
export class TaskClearedError extends Error {
  override readonly name = "TaskClearedError";

  constructor(message = "The task was cleared before it settled") {
    super(message);
  }
}

/** 配置了 `timeout` 且在时限内没有等到结果时,request 会以此错误 reject */
export class TaskTimeoutError extends Error {
  override readonly name = "TaskTimeoutError";

  constructor(message = "The task timed out before it settled") {
    super(message);
  }
}
