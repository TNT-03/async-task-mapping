# async-task-mapping

[![npm version](https://img.shields.io/npm/v/async-task-mapping)](https://www.npmjs.com/package/async-task-mapping)
[![CI](https://github.com/TNT-03/async-task-mapping/actions/workflows/ci.yml/badge.svg)](https://github.com/TNT-03/async-task-mapping/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/async-task-mapping)](https://github.com/TNT-03/async-task-mapping/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/async-task-mapping)](https://www.npmjs.com/package/async-task-mapping)

它可以做出 promise 无法完成的异步任务，可以无视发送和接收的顺序，允许绑定 pending 状态的异步任务，允许在多个函数内共同触发一个任务，并且支持生产者-消费者模式和订单模式。

[English](./README.md) | 简体中文

## 使用之前

- Node.js >= 22.18(或任何支持 ES2023 的现代运行时)。
- 仅发布 ESM。`import` 随处可用,Node.js 22.18+ 也可以直接 `require()`。
- 零运行时依赖,不限制技术栈,自带类型声明。

> 从 1.x 升级?请先看[迁移指南](#从-1x-迁移到-20)。

## 安装

```sh
npm i async-task-mapping --save
```

## 使用方法

### 使用 createTaskList

```javascript
import { createTaskList } from "async-task-mapping";
// TypeScript 中可以声明数据类型:createTaskList<string>()
const asyncTask = createTaskList({
  ordered: true,
  taskCount: 2,
  resolveCount: 2,
});

setTimeout(async () => {
  // 实例是 thenable,可以使用 async/await,也可以使用 .then
  const { list, dataMap } = await asyncTask;
  console.log("data-1", list[0]);
}, 100);

setTimeout(async () => {
  const { list, dataMap } = await asyncTask;
  console.log("data-2", dataMap.res2);
}, 200);

setTimeout(() => {
  asyncTask.pushResolve("response1");
}, 300);

setTimeout(() => {
  asyncTask.pushResolve("response2", "res2");
}, 400);
```

你可以在不同的方法里使用这些函数。同一轮的所有 request 会在 `resolveCount` 份数据全部 push 之后一起结算。上面代码的结果是:

```javascript
// time 400: data-1 response1
// time 400: data-2 response2
```

#### createTaskList 实例化时传入的参数

| 名称         | 说明                                                                                                   | 默认值      |
| ------------ | ------------------------------------------------------------------------------------------------------ | ----------- |
| ordered      | 是否有序:有序列表必须先绑定完所有 request,才能 `pushResolve`,否则 `pushResolve` 会抛错                | `true`      |
| taskCount    | 可以绑定 request 的次数(`request` / `then` / `catch` / `finally` / `await` 都算一次),正整数            | `1`         |
| resolveCount | 可以 `pushResolve` 的次数,正整数                                                                       | `1`         |
| timeout      | 超时毫秒数(> 0 且 ≤ 2147483647),从一轮的首个 request 起计时,超时后本轮以 `TaskTimeoutError` reject                    | `undefined` |
| signal       | `AbortSignal`,见 [abort 与 timeout](#abort-与-timeout)                                                 | `undefined` |

非法值会立即抛错:类型不是 number 抛 `TypeError`;`taskCount` / `resolveCount` 不是正整数、`timeout` 不是正数抛 `RangeError`;`signal` 不是 `AbortSignal` 抛 `TypeError`。

#### createTaskList 实例上的方法

| 名称        | 说明                                                                                       | 备注                                                       |
| ----------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| request     | 绑定一次 request,返回 Promise                                                              | 超限时返回被 reject 的 Promise(`RangeError`)               |
| then\*      | 实例上的 `then` / `catch` / `finally`,每调用一次相当于 `request()` 一次                   | `task.then(({ list, dataMap }) => {})`                     |
| pushResolve | 添加数据:`pushResolve(data, name?)`,传了 `name`(空字符串也是合法 key)就可以通过 `dataMap[name]` 取到            | 超限、顺序错误(有序列表)、本轮已 `pushReject` 时抛错      |
| pushReject  | 让本轮以 `reason` 失败,本轮 pending 的和之后的 request 都会 reject(fail-fast)             | 本轮已失败时抛错;有序列表还要求 request 已绑定完           |
| clear       | 重置本轮,pending 的 request 以 `TaskClearedError` reject                                  | 见 [clear 会 reject](#clear-会-reject-pending-的-request)  |
| paused      | 暂停分发:`pushResolve` / `pushReject` 仍会记录,但 request 不会结算                        | `clear`、`timeout`、`abort` 不受影响,始终立即生效          |
| running     | 恢复分发,并在可以结算时立即结算                                                           | --                                                         |
| getStatus   | 获取当前状态                                                                               | 见下方                                                     |

```javascript
asyncTask.getStatus();
// {
//   requestDone: true,   // 是否已绑定完 taskCount 个 request
//   responseDone: false, // 是否已完成 resolveCount 次 pushResolve
//   requestCount: 2,     // 已绑定的 request 数量
//   responseCount: 0     // 已完成的 pushResolve 数量
// }
```

**返回结构。** 无论有序还是无序,`await task` 得到的都是 `{ list, dataMap }`。`list` 按 `pushResolve` 的顺序排列,`dataMap` 是普通对象。每一轮都有自己的快照,后续轮次不会修改之前轮次的结果。

**无序列表。** `ordered: false` 时可以先 push 数据再绑定 request,本轮已 fulfilled 之后才绑定的 request 会立即得到结果:

```javascript
const task = createTaskList({ ordered: false, resolveCount: 2 });
task.pushResolve("x", "k1");
task.pushResolve("y");
console.log(await task.request());
// { list: [ 'x', 'y' ], dataMap: { k1: 'x' } }
```

`taskCount` 个 request 名额用完且本轮已结算后,下一次 `request` 会开启新的一轮;无序列表(`ordered: false`)在这种情况下直接 `pushResolve` 也会开启新的一轮。有序列表必须先 `request`,多余的 `pushResolve` 仍会抛 `RangeError`。

### 使用 createTaskOrder

request 与数据严格按先进先出配对,不管哪一边先到。

```javascript
import { createTaskOrder } from "async-task-mapping";
const taskOrder = createTaskOrder();

setTimeout(async () => {
  const data = await taskOrder;
  console.log("data1", data);
}, 230);

setTimeout(async () => {
  const data = await taskOrder;
  console.log("data2", data);
}, 500);

setTimeout(() => {
  taskOrder.pushResolve("resolve1");
}, 200);
setTimeout(() => {
  taskOrder.pushResolve("resolve2");
}, 300);
setTimeout(() => {
  taskOrder.pushResolve("resolve3");
}, 400);
```

上面代码的结果是:

```javascript
// time 230: data1 resolve1
// time 500: data2 resolve2
// resolve3 暂时没有 request 与它配对:
// taskOrder.getStatus() -> { pendingRequests: 0, pendingResolve: 1 }
```

#### createTaskOrder 实例化时传入的参数

| 名称    | 说明                                                                 | 默认值      |
| ------- | -------------------------------------------------------------------- | ----------- |
| timeout | **每个** request 的超时毫秒数(> 0 且 ≤ 2147483647),超时的 request 会出队            | `undefined` |
| signal  | `AbortSignal`,见 [abort 与 timeout](#abort-与-timeout)               | `undefined` |

#### createTaskOrder 实例上的方法

| 名称                 | 说明                                                                              | 备注                                                      |
| -------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| request              | 绑定一次 request                                                                  | --                                                        |
| then\*               | 实例上的 `then` / `catch` / `finally`,每调用一次相当于 `request()` 一次          | --                                                        |
| pushResolve          | 添加数据                                                                          | --                                                        |
| pushReject           | 与队首尚未匹配的 request 配对,并让它以 `reason` reject                           | 不影响之后的 request                                      |
| clear                | 清空队列:pending 的 request 以 `TaskClearedError` reject,未配对的数据被丢弃     | **不会**重置 `getLastCompletedTask()`,也**不会**解除 `paused()`,见 [clear 会 reject](#clear-会-reject-pending-的-request) |
| paused               | 暂停匹配                                                                          | `running()` 会一次性配对所有积压的数据                    |
| running              | 恢复匹配                                                                          | --                                                        |
| getStatus            | `{ pendingRequests, pendingResolve }`:未匹配的 request 数量与未匹配的数据数量    | --                                                        |
| getLastCompletedTask | 最近一次成功匹配到的数据,没有时为 `null`                                         | `pushReject` 不会更新它                                   |

```javascript
const order = createTaskOrder();
const first = order.request().catch((e) => `rejected: ${e.message}`);
const second = order.request();
order.pushReject(new Error("boom"));
order.pushResolve("ok");
console.log(await first, "/", await second);
// rejected: boom / ok
```

### 使用 createStepTask

并发池:调用即开始执行,同时运行的任务数不会超过 `limit`。

```javascript
import { createStepTask } from "async-task-mapping";

const controller = new AbortController();

const settled = await createStepTask(
  [
    // 任务函数会收到 signal,把它交给 fetch,abort 时就能真正取消请求
    (signal) => fetch("/a", { signal }),
    (signal) => fetch("/b", { signal }),
    (signal) => fetch("/c", { signal }),
  ],
  {
    limit: 2, // 必填,正整数
    signal: controller.signal, // 可选
    onComplete: (settled) => {}, // 可选
  },
);
// settled 按任务下标排序,与 Promise.allSettled 一致:
// [{ status: "fulfilled", value }, { status: "rejected", reason }, ...]
```

- 同步抛错的任务、不是函数的元素都会记为 `rejected`。返回的 Promise 本身只会因为 `onComplete` 抛错或 `abort` 而 reject。
- `onComplete` 在全部任务结算后、返回的 Promise resolve 前调用一次;它抛错会使返回的 Promise 以该错误 reject。
- `abort` 后不再启动新任务,返回的 Promise 以 `signal.reason` reject。已经在运行的任务不会被强制中断,但每个任务函数都会收到同一个 `signal`(没有传入 `signal` 时是一个永不 abort 的信号),把它交给 `fetch` 等 API 即可真正取消。
- `abort` 之后**不会**调用 `onComplete`。
- 参数非法时是**同步抛错**,不会返回被 reject 的 Promise:`tasks` 不是数组抛 `TypeError`;`limit` 不是正整数抛 `TypeError` / `RangeError`;`signal` 不是 `AbortSignal` 抛 `TypeError`。如果参数来自用户输入,请在调用处加 `try`。

### 失败路径:pushReject、timeout 与 signal

`pushReject`、`timeout`、`signal` 让 `.catch` / `.finally` 真正可用。请务必处理 reject,见 [clear 会 reject](#clear-会-reject-pending-的-request)。

**pushReject**:由生产者一侧让 request 失败。

```javascript
import { createTaskList } from "async-task-mapping";

const task = createTaskList();
const pending = task.request();

task.pushReject(new Error("boom"));

await pending.catch((error) => console.log(error.message));
// boom
// 本轮已失败:之后的 pushResolve / pushReject 都会抛错。
// 想立即恢复请调用 task.clear(),详见下方「pushReject」一节。
```

`createTaskOrder` 的 `pushReject` 只会让队首尚未匹配的一个 request reject,示例见 `createTaskOrder` 一节。

**timeout**:在时限内没有等到结果,就以 `TaskTimeoutError` reject。

```javascript
import {
  createTaskList,
  createTaskOrder,
  TaskTimeoutError,
} from "async-task-mapping";

// createTaskList:每一轮只计时一次,从首个 request 开始
const task = createTaskList({ timeout: 1000 });
try {
  await task; // 1 秒内没有人调用 task.pushResolve
} catch (error) {
  console.log(error instanceof TaskTimeoutError); // true
}

// createTaskOrder:每个 request 单独计时,
// 超时的 request 会出队,不影响其他 request
const order = createTaskOrder({ timeout: 1000 });
await order.request().catch((error) => error instanceof TaskTimeoutError); // true
```

**signal**:用 `AbortSignal` 从外部取消。

```javascript
import { createTaskOrder } from "async-task-mapping";

const controller = new AbortController();
const order = createTaskOrder({ signal: controller.signal });

const pending = order.request();
controller.abort(new Error("page closed"));

await pending.catch((error) => console.log(error.message));
// page closed

// abort 之后实例不再可用:
await order.request().catch((error) => console.log(error.message)); // page closed
order.pushResolve("x"); // 被静默忽略,不会抛错
```

`createTaskList` 以同样的方式接收 `timeout` 和 `signal`。更多细节(例如 `timeout` 与 `paused()` 的关系)见 [abort 与 timeout](#abort-与-timeout) 和 [paused](#paused)。

### TypeScript

自带类型声明,不需要额外安装 `@types` 包。两个工厂函数都通过泛型参数指定数据类型(默认 `unknown`):

```typescript
import {
  createStepTask,
  createTaskList,
  createTaskOrder,
  type StepTaskFunction,
  type TaskList,
  type TaskListResult,
  type TaskOrder,
} from "async-task-mapping";

const list: TaskList<string> = createTaskList<string>();
const pending = list.request(); // 有序列表必须先绑定 request
list.pushResolve("a", "k"); // list.pushResolve(1) 会编译报错,数据必须是 string
const result: TaskListResult<string> = await pending;
console.log(result.list[0], result.dataMap.k);
// result.list: readonly string[]
// result.dataMap: Readonly<Record<string, string>>

const order: TaskOrder<number> = createTaskOrder<number>();
const next = order.request();
order.pushResolve(1);
const value = await next; // number
const last = order.getLastCompletedTask(); // number | null

// createStepTask<T>:每个任务返回 T(或 PromiseLike<T>)
const tasks: StepTaskFunction<number>[] = [() => 1, async () => 2];
const settled = await createStepTask(tasks, { limit: 2 });
// settled: PromiseSettledResult<number>[]
```

导出的类型:

| 类型                                        | 说明                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `TaskList<T>`、`TaskOrder<T>`               | `createTaskList<T>()` / `createTaskOrder<T>()` 返回的实例类型,都是 `PromiseLike`       |
| `TaskListOptions`、`TaskOrderOptions`       | 工厂函数的参数类型,所有字段均可选                                                     |
| `TaskListResult<T>`                         | `{ readonly list: readonly T[]; readonly dataMap: Readonly<Record<string, T>> }`       |
| `TaskListStatus`、`TaskOrderStatus`         | `getStatus()` 的返回类型                                                               |
| `StepTaskFunction<T>`、`StepTaskOptions<T>` | 任务函数 `(signal: AbortSignal) => PromiseLike<T> \| T` 与 `createStepTask` 的参数类型 |
| `TaskClearedError`、`TaskTimeoutError`      | 错误类(是值,不只是类型),可配合 `instanceof` 使用                                    |

reject 的 `reason` 类型是 `unknown`,使用前请先收窄:`if (error instanceof TaskTimeoutError) { ... }`。

### 错误类型

```javascript
import { TaskClearedError, TaskTimeoutError } from "async-task-mapping";
```

会让返回的 Promise **reject** 的错误:

| 错误                       | 触发条件                                                  |
| -------------------------- | --------------------------------------------------------- |
| `TaskClearedError`         | request 还在 pending 时调用了 `clear()`                   |
| `TaskTimeoutError`         | 配置了 `timeout`,request 没有在时限内结算                 |
| `RangeError`               | `request` 超限(`createTaskList`)                          |
| `signal.reason`            | `signal` 被 abort:pending 的和之后的 request 都以它 reject |
| `pushReject` 传入的 `reason` | 你传给 `pushReject(reason)` 的值                          |

会被**同步抛出**的错误:

| 错误         | 触发条件                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| `RangeError` | `pushResolve` 超限,或 `taskCount` / `resolveCount` / `timeout` / `limit` 超出范围                          |
| `TypeError`  | 数值类参数不是 number、`signal` 不是 `AbortSignal`、`createStepTask` 的 `tasks` 不是数组                   |
| `Error`      | `createTaskList`:`pushResolve` / `pushReject` 顺序错误(有序列表,request 还没绑定完),或本轮已失败后再 `pushResolve` / `pushReject` |

## 注意事项

### thenable 会消耗名额

对实例调用 `then`、`catch`、`finally` 或 `await`,每次都会调用一次 `request()`,各消耗一个 request 名额。`taskCount: 1` 时,同一轮里第二次 `await task` 会得到被 reject 的 `RangeError` Promise。

`async` 函数里 `return` 实例会被隐式展开,相当于多一次 `await`。需要精确控制时请显式 `return task.request()`。

**风险:任何会"展开 thenable"的写法都会悄悄消耗名额**,包括 `Promise.resolve(task)`、`Promise.all([task])`、`Promise.race([...])`,以及把实例交给会 `await` 它的第三方库或测试框架。名额被意外消耗后,真正的消费者会得到 `RangeError`(`createTaskOrder` 则会让数据与错误的 request 配对)。建议在业务代码里始终显式调用 `request()`,不要把实例当作普通 Promise 传来传去。

### clear 不会重置的状态

`createTaskOrder` 的 `clear()` 只清空两个队列(pending 的 request 与未配对的数据):

- `getLastCompletedTask()` 仍会返回 `clear()` 之前最近一次匹配到的数据。
- 如果之前调用过 `paused()`,`clear()` 之后实例依然是暂停状态,新到的 request / 数据会继续积压,直到 `running()`。

需要这些状态归零时,请自行处理(例如在 `clear()` 之后调用 `running()`,或者直接新建实例)。

### clear 会 reject pending 的 request

`clear()`(以及 `abort`)会让所有 pending 的 request reject。**如果调用方没有 `catch`,这个 reject 就是 `unhandledRejection`,Node.js 默认会终止进程。**

```javascript
task.then(render); // 不安全:task.clear() 之后会以 TaskClearedError reject
task.then(render).catch(() => {}); // 安全
```

### abort 与 timeout

- `signal`:abort 后 pending 的 request 以 `signal.reason` reject,之后的 `request()` 同样 reject,`pushResolve` / `pushReject` 会被**静默忽略**(生产者不一定知道消费端已经放弃)。创建实例时 signal 已经 aborted 则立即生效。实例只对 `signal` 持有弱引用,长寿命的 signal 不会让实例无法被回收,实例被回收后它留在 signal 上的监听器也会被自动摘除。
- `createTaskList` 的 `timeout` 从一轮的首个 request 开始计时,针对整轮生效(有序、无序都一样)。**没有人在等就不计时**:无序列表在没有 request 时就用 `pushResolve` 填满数据,不会有定时器,之后迟到的 request 会立即拿到结果。
- `createTaskOrder` 的 `timeout` 针对每个 request 单独计时。

### pushReject

- `createTaskList`:fail-fast。整轮失败(`pushReject` 或 `timeout` 触发都一样),本轮后续绑定的 request 也会 reject,`pushResolve` / `pushReject` 都会抛错。**想立即恢复请调用 `clear()`**;不调用的话,要等 `taskCount` 个 request 名额全部用完,下一次 `request()` 才会开启新的一轮。在 `paused()` 期间 `pushReject` 也是如此:`running()` 之后 request 才会 reject,而之后的 `pushResolve` 已经会抛错。
- `createTaskOrder`:按先进先出与 request 配对,只会让一个 request reject。

### paused

`paused()` 只会推迟 `pushResolve` / `pushReject` 的分发。`clear`、`timeout`、`abort` 始终立即生效。**注意 `timeout` 不会因为暂停而冻结**:暂停期间计时照常进行,到点就会以 `TaskTimeoutError` reject。如果你的暂停可能持续很久,请不要同时设置较短的 `timeout`。

## 从 1.x 迁移到 2.0

| 1.x | 2.0 |
| --- | --- |
| 打包产物没有类型声明 | 仅 ESM 且自带类型,`engines.node >= 22.18`。使用 `import`(Node.js 22.18+ 也可以 `require()`) |
| `requestCount` / `responseCount` 选项与 `pushResponse`(兼容层) | 已删除。请使用 `taskCount` / `resolveCount` 与 `pushResolve` |
| `request` 超限时输出 `console.warn` 并返回 `undefined` | 返回被 reject 的 Promise(`RangeError`),不再输出日志 |
| `pushResolve` 超限或顺序错误时**返回**错误字符串 | **抛出** `RangeError` / `Error` |
| `clear()` 后 pending 的 request 永远悬挂 | 以 `TaskClearedError` reject,请加上 `catch`,见 [clear](#clear-会-reject-pending-的-request) |
| `taskCount: 0` 等值被悄悄当成 `1` | `taskCount` / `resolveCount` / `timeout` / `signal` 会校验,非法值直接抛错 |
| 无序列表在 fulfilled 之后再 `request` 返回裸数组 | 统一返回 `{ list, dataMap }` |
| `dataMap` 在所有轮次间共享(`clear()` 不会重置) | 每一轮都有独立的 `list` / `dataMap` 快照 |
| `createTaskOrder().getStatus()` 恒为 `0`,`running()` 只配对一条 | 返回真实数量,`running()` 会配对所有积压的数据 |
| `createTaskOrder` 内有调试用的 `console.log` | 已移除 |
| -- | 新增:`pushReject`、`timeout`、`signal`、`createStepTask`、`TaskClearedError`、`TaskTimeoutError` |

补充说明:

- `ordered` 默认值是 `true`,与 1.x 代码一致(1.x 的 README 误写成了 `false`)。如果你依赖「先 push 数据、后绑定 request」,请显式设置 `ordered: false`。
- `createTaskOrder` 的 `getStatus()` 字段是 `pendingResolve`(1.x 的 README 误写成了 `pendingResponses`)。

## 参与贡献

欢迎提 Issue 和 Pull Request,提交之前请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## License

[MIT](https://github.com/TNT-03/async-task-mapping/blob/master/LICENSE).
