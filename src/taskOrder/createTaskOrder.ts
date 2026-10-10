import { resolveSignal, resolveTimeout } from "../internal/validate";
import { TaskOrderImpl } from "./taskOrder";
import type { TaskOrder, TaskOrderOptions } from "./types";

/** 创建按先后顺序一一配对 request 与 pushResolve 的任务队列 */
export function createTaskOrder<T = unknown>(
  options: TaskOrderOptions = {},
): TaskOrder<T> {
  return new TaskOrderImpl<T>({
    timeout: resolveTimeout(options.timeout),
    signal: resolveSignal(options.signal),
  });
}
