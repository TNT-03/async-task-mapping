# async-task-mapping

[![npm version](https://img.shields.io/npm/v/async-task-mapping)](https://www.npmjs.com/package/async-task-mapping)
[![CI](https://github.com/TNT-03/async-task-mapping/actions/workflows/ci.yml/badge.svg)](https://github.com/TNT-03/async-task-mapping/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/async-task-mapping)](https://github.com/TNT-03/async-task-mapping/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/async-task-mapping)](https://www.npmjs.com/package/async-task-mapping)

It can make asynchronous tasks that promise cannot complete, ignore the order of sending and receiving, allow binding of asynchronous tasks in pending status, allow triggering a task in multiple functions, and support producer consumer mode and order mode.

English | [简体中文](https://github.com/TNT-03/async-task-mapping/blob/master/README-zh_CN.md)

## Pre-requisites

- Node.js >= 22.18 (or any modern runtime that supports ES2023).
- ESM only. `import` works everywhere, and `require()` works on Node.js 22.18+.
- Zero runtime dependencies and no restriction on your tech stack. Type declarations are included.

> Upgrading from 1.x? See the [migration guide](#migrating-from-1x-to-20).

## Install

```sh
npm i async-task-mapping --save
```

## Usage

### use createTaskList

```javascript
import { createTaskList } from "async-task-mapping";
// In TypeScript, declare the data type: createTaskList<string>()
const asyncTask = createTaskList({
  ordered: true,
  taskCount: 2,
  resolveCount: 2,
});

setTimeout(async () => {
  // The instance is a thenable, so you can use either async/await or .then.
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

You can use these functions in different methods. All requests of a round settle together once `resolveCount` pieces of data have been pushed. The result of the above code is:

```javascript
// time 400: data-1 response1
// time 400: data-2 response2
```

#### Options of createTaskList

| name         | description                                                                                                   | default     |
| ------------ | ------------------------------------------------------------------------------------------------------------- | ----------- |
| ordered      | Ordered list: every request must be bound before the first `pushResolve`, otherwise `pushResolve` throws     | `true`      |
| taskCount    | Number of times `request` (including `then` / `catch` / `finally` / `await`) can be bound, positive integer | `1`         |
| resolveCount | Number of times `pushResolve` can be called, positive integer                                                 | `1`         |
| timeout      | Timeout in milliseconds (> 0 and ≤ 2147483647). Counted from the first request of a round. Rejects with `TaskTimeoutError`     | `undefined` |
| signal       | An `AbortSignal`. See [abort](#abort-and-timeout)                                                             | `undefined` |

Invalid values throw immediately: a non-number throws `TypeError`, a non-positive-integer `taskCount` / `resolveCount` or a non-positive `timeout` throws `RangeError`, and a `signal` that is not an `AbortSignal` throws `TypeError`.

#### Methods on createTaskList Instances

| name         | description                                                                                                                       | notes                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| request      | Bind one request and return a Promise                                                                                             | Over the limit, it returns a rejected Promise (`RangeError`)                    |
| then\*       | `then` / `catch` / `finally` of the instance, each one calls `request()` once                                                     | `task.then(({ list, dataMap }) => {})`                                          |
| pushResolve  | Add data: `pushResolve(data, name?)`. With a `name` (an empty string is a valid key), the data can be read from `dataMap[name]`                                    | Throws on over the limit, on wrong order (ordered list) and after `pushReject` |
| pushReject   | Fail the current round with `reason`. Every pending and later request of the round rejects (fail-fast)                            | Throws if the round has already failed, and (ordered list) if requests are not all bound |
| clear        | Reset the current round. Pending requests reject with `TaskClearedError`                                                          | See [clear](#clear-rejects-pending-requests)                                    |
| paused       | Pause dispatching. `pushResolve` / `pushReject` are still recorded but requests do not settle                                     | `clear`, `timeout` and `abort` are never deferred                               |
| running      | Resume dispatching and settle immediately if possible                                                                             | --                                                                              |
| getStatus    | Get current status                                                                                                                | See below                                                                       |

```javascript
asyncTask.getStatus();
// {
//   requestDone: true,   // whether all `taskCount` requests are bound
//   responseDone: false, // whether all `resolveCount` pushResolve are done
//   requestCount: 2,     // number of requests bound
//   responseCount: 0     // number of pushResolve done
// }
```

**Result shape.** `await task` always resolves `{ list, dataMap }`, for both ordered and unordered lists. `list` keeps the order of `pushResolve`, `dataMap` is a plain object. Every round gets its own snapshot, and a later round never mutates the result of an earlier one.

**Unordered list.** With `ordered: false`, data can be pushed before the request is bound, and a request that is bound after the round has been fulfilled resolves immediately:

```javascript
const task = createTaskList({ ordered: false, resolveCount: 2 });
task.pushResolve("x", "k1");
task.pushResolve("y");
console.log(await task.request());
// { list: [ 'x', 'y' ], dataMap: { k1: 'x' } }
```

Once all `taskCount` requests are used up and the round has settled, the next `request` starts a new round. For an unordered list (`ordered: false`), calling `pushResolve` in that situation also starts a new round. An ordered list must `request` first, and an extra `pushResolve` still throws `RangeError`.

### use createTaskOrder

Requests and data are paired strictly in first-in-first-out order, regardless of which side arrives first.

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

The result of the above code is:

```javascript
// time 230: data1 resolve1
// time 500: data2 resolve2
// resolve3 has no request yet:
// taskOrder.getStatus() -> { pendingRequests: 0, pendingResolve: 1 }
```

#### Options of createTaskOrder

| name    | description                                                                                    | default     |
| ------- | ---------------------------------------------------------------------------------------------- | ----------- |
| timeout | Timeout in milliseconds (> 0 and ≤ 2147483647) of **each** request. A timed-out request leaves the queue        | `undefined` |
| signal  | An `AbortSignal`. See [abort](#abort-and-timeout)                                              | `undefined` |

#### Methods on createTaskOrder Instances

| name                 | description                                                                                    | notes                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| request              | Bind one request                                                                               | --                                                                          |
| then\*               | `then` / `catch` / `finally` of the instance, each one calls `request()` once                  | --                                                                          |
| pushResolve          | Add data                                                                                       | --                                                                          |
| pushReject           | Pair with the first unmatched request and reject it with `reason`                              | Later requests are not affected                                             |
| clear                | Clear the queues. Pending requests reject with `TaskClearedError`, unmatched data is dropped   | Does **not** reset `getLastCompletedTask()` or `paused()`. See [clear](#clear-rejects-pending-requests) |
| paused               | Pause matching                                                                                 | `running()` matches every piled-up pair at once                             |
| running              | Resume matching                                                                                | --                                                                          |
| getStatus            | `{ pendingRequests, pendingResolve }`: unmatched requests and unmatched data                   | --                                                                          |
| getLastCompletedTask | The data of the last successful match, `null` if there is none                                 | `pushReject` does not update it                                             |

```javascript
const order = createTaskOrder();
const first = order.request().catch((e) => `rejected: ${e.message}`);
const second = order.request();
order.pushReject(new Error("boom"));
order.pushResolve("ok");
console.log(await first, "/", await second);
// rejected: boom / ok
```

### use createStepTask

A concurrency pool: it starts running when called, and never runs more than `limit` tasks at the same time.

```javascript
import { createStepTask } from "async-task-mapping";

const settled = await createStepTask(
  [
    // each task receives the signal: pass it to fetch so abort really cancels the request
    (signal) => fetch("/a", { signal }),
    (signal) => fetch("/b", { signal }),
    (signal) => fetch("/c", { signal }),
  ],
  {
    limit: 2, // required, positive integer
    signal: controller.signal, // optional
    onComplete: (settled) => {}, // optional
  },
);
// settled is ordered by task index, like Promise.allSettled:
// [{ status: "fulfilled", value }, { status: "rejected", reason }, ...]
```

- A task that throws synchronously, or is not a function, is recorded as `rejected`. The returned Promise itself only rejects for `onComplete` errors or `abort`.
- `onComplete` is called once after all tasks settle and before the returned Promise resolves. If it throws, the returned Promise rejects with that error.
- After `abort`, no new task is started and the returned Promise rejects with `signal.reason`. Tasks that are already running are not forcibly interrupted, but every task function receives the same `signal` (a signal that never aborts when no `signal` option is given). Pass it to `fetch` and similar APIs to really cancel them.
- `tasks` that is not an array throws `TypeError`, and a `limit` that is not a positive integer throws `TypeError` / `RangeError`.

### Errors

```javascript
import { TaskClearedError, TaskTimeoutError } from "async-task-mapping";
```

| error              | when                                                                  |
| ------------------ | --------------------------------------------------------------------- |
| `TaskClearedError` | `clear()` was called while the request was pending                    |
| `TaskTimeoutError` | `timeout` was configured and the request did not settle in time       |
| `RangeError`       | `request` / `pushResolve` over the limit, or an invalid numeric option |

## Notes

### thenable consumes a request

`then`, `catch`, `finally` and `await` on an instance each call `request()` once, and each consumes one request slot. For `taskCount: 1`, the second `await task` in the same round gets a rejected `RangeError` promise.

An `async` function that `return`s the instance unwraps it, which counts as one more `await`. Return `task.request()` explicitly when you want to control it.

**Risk: anything that unwraps a thenable silently consumes a slot**, including `Promise.resolve(task)`, `Promise.all([task])`, `Promise.race([...])`, and handing the instance to a third-party library or test framework that `await`s it. Once a slot is consumed by accident, the real consumer gets a `RangeError` (and `createTaskOrder` pairs the data with the wrong request). Always call `request()` explicitly in application code, and do not pass the instance around as if it were a plain Promise.

### What clear does not reset

`clear()` of `createTaskOrder` only empties the two queues (pending requests and unmatched data):

- `getLastCompletedTask()` still returns the last matched data from before `clear()`.
- If `paused()` was called earlier, the instance stays paused after `clear()`: new requests / data keep piling up until `running()`.

If you need these to be reset, do it yourself (for example call `running()` after `clear()`, or create a new instance).

### clear rejects pending requests

`clear()` (and `abort`) rejects every pending request. **If the caller has no `catch`, the rejection is an `unhandledRejection`, and Node.js terminates the process by default.**

```javascript
task.then(render); // not safe: rejects with TaskClearedError after task.clear()
task.then(render).catch(() => {}); // safe
```

### abort and timeout

- `signal`: after it is aborted, pending requests reject with `signal.reason`, later `request()` calls reject with it as well, and `pushResolve` / `pushReject` are **silently ignored** (a producer is not always aware that the consumer has given up). A signal that is already aborted when the instance is created takes effect immediately. The instance only holds a weak reference to its `signal`, so a long-lived signal does not keep the instance alive, and the listener it left on the signal is removed automatically once the instance is garbage collected.
- `timeout` of `createTaskList` starts at the first request of a round and applies to the whole round, ordered or not. **Nobody waiting means no timer**: in an unordered list that is already filled by `pushResolve` there is no timer, and a late request resolves immediately.
- `timeout` of `createTaskOrder` is counted for each request separately.

### pushReject

- `createTaskList`: fail-fast. The whole round fails (whether by `pushReject` or by `timeout`), later requests of the same round reject too, and `pushResolve` / `pushReject` throw. **Call `clear()` to recover immediately**; otherwise the next `request()` only starts a new round after all `taskCount` request slots are used up. This also holds when `pushReject` is called while `paused()`: the requests reject after `running()`, and a later `pushResolve` already throws.
- `createTaskOrder`: paired with requests in FIFO order, only one request is rejected.

### paused

`paused()` only defers the dispatching of `pushResolve` / `pushReject`. `clear`, `timeout` and `abort` always take effect immediately. **Note that `timeout` is not frozen by pausing**: the timer keeps running while paused and rejects with `TaskTimeoutError` when it fires. If a pause may last long, do not combine it with a short `timeout`.

## Migrating from 1.x to 2.0

| 1.x | 2.0 |
| --- | --- |
| Published as a bundle with no type declarations | ESM only with built-in types, `engines.node >= 22.18`. Use `import` (or `require()` on Node.js 22.18+) |
| `requestCount` / `responseCount` options and `pushResponse` (compatibility layer) | Removed. Use `taskCount` / `resolveCount` and `pushResolve` |
| `request` over the limit logged `console.warn` and returned `undefined` | Returns a rejected Promise (`RangeError`). Nothing is logged |
| `pushResolve` over the limit or in the wrong order **returned** an error string | **Throws** `RangeError` / `Error` |
| `clear()` left pending requests hanging forever | They reject with `TaskClearedError`. Add a `catch`, see [clear](#clear-rejects-pending-requests) |
| `taskCount: 0` and similar values silently became `1` | `taskCount` / `resolveCount` / `timeout` / `signal` are validated and throw on invalid values |
| An unordered list returned a bare array for a request after fulfilled | Always `{ list, dataMap }` |
| `dataMap` was shared by every round (`clear()` did not reset it) | Each round has its own `list` / `dataMap` snapshot |
| `createTaskOrder().getStatus()` always returned `0`, and `running()` matched only one pair | Real numbers, and `running()` matches every piled-up pair |
| Debug `console.log` in `createTaskOrder` | Removed |
| -- | New: `pushReject`, `timeout`, `signal`, `createStepTask`, `TaskClearedError`, `TaskTimeoutError` |

Notes:

- `ordered` defaults to `true`, as it did in the 1.x code (the 1.x README said `false` by mistake). If you rely on pushing data before binding requests, set `ordered: false` explicitly.
- `getStatus()` of `createTaskOrder` uses `pendingResolve` (the 1.x README wrote `pendingResponses` by mistake).

### Contributing

Issues and pull requests are welcome, please read [CONTRIBUTING.md](https://github.com/TNT-03/async-task-mapping/blob/master/CONTRIBUTING.md) first (written in Chinese).

### License

[MIT](https://github.com/TNT-03/async-task-mapping/blob/master/LICENSE).
