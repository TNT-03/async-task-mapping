import {
  resolvePositiveInteger,
  resolveSignal,
  resolveTimeout,
} from "../internal/validate";
import { TaskListImpl } from "./taskList";
import type { TaskList, TaskListOptions } from "./types";

/**
 * 创建任务列表。
 * `ordered` 默认 `true`;`taskCount` / `resolveCount` 缺省为 1,其余非正整数会抛错。
 */
export function createTaskList<T = unknown>(
  options: TaskListOptions = {},
): TaskList<T> {
  return new TaskListImpl<T>({
    ordered: options.ordered ?? true,
    taskCount: resolvePositiveInteger(options.taskCount, "taskCount", 1),
    resolveCount: resolvePositiveInteger(
      options.resolveCount,
      "resolveCount",
      1,
    ),
    timeout: resolveTimeout(options.timeout),
    signal: resolveSignal(options.signal),
  });
}
