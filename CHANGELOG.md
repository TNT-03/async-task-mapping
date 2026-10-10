# async-task-mapping

## 2.0.0

### Major Changes

2.0.0:整个项目重构为 TypeScript(strict),构建工具由 rollup + babel 换成 tsdown。

- 仅发布 ESM 并自带类型声明,要求 Node.js >= 22.18(`require()` 也可直接加载);`exports` 指向 `dist/index.js` 与 `dist/index.d.ts`。
- 删除 1.x 保留的兼容 API:`requestCount` / `responseCount` 选项与 `pushResponse` 方法,请使用 `taskCount` / `resolveCount` 与 `pushResolve`。
- `request` 超限不再输出 `console.warn` 并返回 `undefined`,而是返回被 reject 的 Promise(`RangeError`)。
- `pushResolve` 超限或顺序错误时同步抛错,不再返回错误字符串。
- `clear()` 会让仍在 pending 的 request 以 `TaskClearedError` reject,不再永远悬挂。
- `createTaskList` 的 `taskCount` / `resolveCount` 必须是正整数,非法值抛 `RangeError` / `TypeError`(缺省仍为 1;此前 `0` 等值会被悄悄当成 1)。
- 无序列表在 fulfilled 之后再 `request`,统一返回 `{ list, dataMap }`(此前返回裸数组)。
- 每一轮结算时会生成新的 `list` / `dataMap` 快照,不同轮次之间不再共享引用。
- `createTaskOrder().getStatus()` 返回真实的未配对数量(此前恒为 0)。
- `createTaskOrder` 在 `paused()` 期间积压的多条数据,`running()` 后会一次性全部配对(此前只配对一条),并移除了调试用的 `console.log`。

### Minor Changes

- 新增 `pushReject`:TaskList 为 fail-fast,TaskOrder 与队首 request 按序配对。
- 新增 `timeout` 与 `signal`(`AbortSignal`)选项。实例被 abort 后,pending 的 request 以 `signal.reason` reject,之后的 `request` 同样 reject,`pushResolve` / `pushReject` 会被静默忽略。
- 新增 `createStepTask` 并发池。
- 导出 `TaskClearedError`、`TaskTimeoutError` 与全部公共类型。
