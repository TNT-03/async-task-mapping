# async-task-mapping
它可以做出promise无法完成的异步任务，可以无视发送和接收的顺序，允许绑定pending状态的异步任务，允许在多个函数内共同触发一个任务，并且支持生产者-消费者模式和订单模式。

[English](./README.md) | 简体中文
## 使用之前
async-task-mapping工具没有使用任何第三方依赖包，不会限制技术栈。

## 安装

```sh
npm i async-task-mapping --save
```

## 使用方法
### 使用 createTaskList

```javascript
import { createTaskList } from 'async-task-mapping';
const asyncTask = createTaskList({ordered: true, requestCount: 2, responseCount: 2})

  setTimeout(async () => {
    // 这里返回一个Promise.resolve，你可以使用async/await或者.then.
    const data = await asyncTask.request()
    console.log('data-1', data)
  }, 100)

  setTimeout(async () => {
    const data = await asyncTask.request(() => console.log('request-2'))
    console.log('data-2', data)
  }, 200)

  setTimeout(() => {
    asyncTask.pushResponse('response1')
  }, 300)

  setTimeout(() => {
    asyncTask.pushResponse('response2')
  }, 400)

```
你可以在不同函数中使用这些方法. 以上代码执行结果为:
```javascript
// time 200: request-2
// time 300: data-1 response1
// time 400: data-2 response2
```
#### createTaskList实例化过程中传入的参数

|      名称       | 描述         | 默认值  |
|  ----          | ----         | ----   |
| ordered        | 是否为有序     | false  |
| requestCount   | 读取数据的次数     | 1      |
| responseCount  | 增加数据的次数  | 1      |

#### createTaskList实例上的方法

|  名称           | 描述         | 返回值的数据结构  |
|  ----          | ----        | ----  |
| request        | 接收的方法，可以传入一个立即执行的函数     | Promise类型, 如果responseCount为1，<br>得到的data是pushResponse的原数据，<br> 如果responseCount大于1，将得到一个数组 |
| pushResponse   | 增加数据的方法 | -- |
| clear          | 清空所有的状态 | -- |
| getStatus      | 获取当前状态   | {<br>&nbsp;&nbsp; requestDone: false (是否完成所有的request绑定), <br>&nbsp;&nbsp; responseDone: false (是否完成所有的pushResponse), <br>&nbsp;&nbsp; requestCount: 1 (已绑定的request数量),<br>&nbsp;&nbsp; responseCount: 1 (已完成的pushResponse数量)<br>} |


### 使用 createTaskOrder

request和response可以不按照顺序绑定.
```javascript
import { createTaskOrder } from 'async-task-mapping';
const taskOrder = createTaskOrder()

  setTimeout(async () => {
    // 这里返回一个Promise.resolve，你可以使用async/await或者.then.
    const data = await taskOrder.request()
    console.log('data1', data)
  }, 230)

  setTimeout(async () => {
    const data = await taskOrder.request(() => console.log('request 2'))
    console.log('data2', data)
  }, 500)
  setTimeout( () => {
    taskOrder.pushResponse('Response1')
  }, 200)
  setTimeout(() => {
    taskOrder.pushResponse('Response2')
  }, 300)
  setTimeout(() => {
    taskOrder.pushResponse('Response3')
  }, 400)

```
你可以在不同函数中使用这些方法. 以上代码执行结果为:
```javascript
// time 230: data1 Response1
// time 500: data2 Response2
```

#### createTaskOrder实例上的方法

|  名称           | 描述         | 返回值的数据结构  |
|  ----          | ----        | ----  |
| request        | 接收数据的方法，可以传入一个立即执行的函数    | Promise类型, 得到的data是pushResponse的原数据 |
| pushResponse   | 增加数据的方法 | -- |
| clear          | 清空所有的状态 | -- |
| getStatus      | 获取当前状态   | {<br>&nbsp;&nbsp; pendingRequests: 0 (未完成匹配的request数量), <br>&nbsp;&nbsp; pendingResponses: 0 (未完成匹配的response数量)<br>} |
| getLastCompletedTask          | 获取最后一个request与response完成匹配的数据 | -- |


### 开源协议

[MIT](./LICENSE).