# async-task-mapping

它可以做出 promise 无法完成的异步任务，可以无视发送和接收的顺序，允许绑定 pending 状态的异步任务，允许在多个函数内共同触发一个任务，并且支持生产者-消费者模式和订单模式。

[English](./README.md) | 简体中文

## 使用之前

async-task-mapping 工具没有使用任何第三方依赖包，不会限制技术栈。

## 安装

```sh
npm i async-task-mapping --save
```

## 使用方法

### 使用 createTaskList

版本 1.0.0-beta

```javascript
import { createTaskList } from "async-task-mapping";
const asyncTask = createTaskList({
  ordered: true,
  taskCount: 2,
  resolveCount: 2,
});

setTimeout(async () => {
  // 这里返回一个Promise.resolve，你可以使用async/await或者.then.
  const data = await asyncTask;
  console.log("data-1", data);
  // 或者
  asyncTask.then((data) => {
    console.log("data-1", data);
  });
}, 100);

setTimeout(async () => {
  const data = await asyncTask;
  console.log("data-2", data);
}, 200);

setTimeout(() => {
  asyncTask.pushResolve("response1");
}, 300);

setTimeout(() => {
  asyncTask.pushResolve("response2");
}, 400);
```

你可以在不同函数中使用这些方法. 以上代码执行结果为:

```javascript
// time 200: request-2
// time 300: data-1 response1
// time 400: data-2 response2
```

#### createTaskList 实例化过程中传入的参数

| 名称         | 描述           | 默认值 |
| ------------ | -------------- | ------ |
| ordered      | 是否为有序     | false  |
| taskCount    | 读取数据的次数 | 1      |
| resolveCount | 增加数据的次数 | 1      |

#### createTaskList 实例上的方法

| 名称        | 描述           | 返回值的数据结构                                                                                                                                                                                                                                                   |
| ----------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| pushResolve | 增加数据的方法 | --                                                                                                                                                                                                                                                                 |
| clear       | 清空所有的状态 | --                                                                                                                                                                                                                                                                 |
| paused      | 暂停任务       | --                                                                                                                                                                                                                                                                 |
| running     | 继续匹配任务   | --                                                                                                                                                                                                                                                                 |
| getStatus   | 获取当前状态   | {<br>&nbsp;&nbsp; requestDone: false (是否完成所有的 request 绑定), <br>&nbsp;&nbsp; responseDone: false (是否完成所有的 pushResolve), <br>&nbsp;&nbsp; requestCount: 1 (已绑定的 request 数量),<br>&nbsp;&nbsp; responseCount: 1 (已完成的 pushResolve 数量)<br>} |

### 使用 createTaskOrder

request 和 response 可以不按照顺序绑定.

```javascript
import { createTaskOrder } from "async-task-mapping";
const taskOrder = createTaskOrder({ order: false });

setTimeout(async () => {
  // 这里返回一个Promise.resolve，你可以使用async/await或者.then.
  const data = await taskOrder;
  console.log("data1", data);
}, 230);

setTimeout(async () => {
  const data = await taskOrder;
  console.log("data2", data);
}, 500);
setTimeout(() => {
  resolve;
  taskOrder.pushResolve("resolve1");
}, 200);
setTimeout(() => {
  taskOrder.pushResolve("resolve2");
}, 300);
setTimeout(() => {
  taskOrder.pushResolve("resolve3");
}, 400);
```

你可以在不同函数中使用这些方法. 以上代码执行结果为:

```javascript
// time 230: data1 resolve1
// time 500: data2 resolve2
```

#### createTaskOrder 实例上的方法

| 名称                     | 描述                                            | 返回值的数据结构                                                                                                                         |
| ------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| pushResolve              | 增加数据的方法                                  | --                                                                                                                                       |
| clear                    | 清空所有的状态                                  | --                                                                                                                                       |
| paused                   | 暂停任务                                        | --                                                                                                                                       |
| running                  | 继续匹配任务                                    | --                                                                                                                                       |
| getStatus                | 获取当前状态                                    | {<br>&nbsp;&nbsp; pendingRequests: 0 (未完成匹配的 request 数量), <br>&nbsp;&nbsp; pendingResponses: 0 (未完成匹配的 response 数量)<br>} |
| getLastCompletedTask<br> | 获取最后一个 request 与 response 完成匹配的数据 | --                                                                                                                                       |

### 开源协议

[MIT](./LICENSE).
