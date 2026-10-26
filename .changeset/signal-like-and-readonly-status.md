---
"async-task-mapping": patch
---

类型与校验改进:

- 新增并导出 `AbortSignalLike` 类型,`signal` 选项改用它:真实的 `AbortSignal` 可直接传入,只实现 `aborted` / `addEventListener` / `removeEventListener` 的对象也可以;对象缺少 `reason` 时,abort 后以默认的 `AbortError`(`DOMException`)reject,不会修改传入的对象。`createStepTask` 的 `signal` 仍是完整的 `AbortSignal`(会转发给任务函数)。
- `signal` 校验失败的 `TypeError` 信息更准确。
- `TaskListStatus` / `TaskOrderStatus` 的字段改为 `readonly`。
- 内部重构:`createTaskList` 的状态机改为可辨识联合,行为不变。
