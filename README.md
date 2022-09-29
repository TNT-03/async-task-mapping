# async-task-mapping
It can flexibly control asynchronous tasks, ignore the order of sending and receiving, allow binding of asynchronous tasks in pending state, and support producer consumer mode and order mode,

English | [简体中文](https://github.com/TNT-03/async-task-mapping/blob/master/README-zh_CN.md) 
## Pre-requisites
The async-task-mapping library does not use any third-party dependency packages and does not limit the technology stack.

## Install

```sh
npm i async-task-mapping --save
```

## Usage
### use createTaskList

```javascript
import { createTaskList } from 'async-task-mapping';
const asyncTask = createTaskList({ordered: true, requestCount: 2, responseCount: 2})

  setTimeout(async () => {
    // A Promise.resolve is returned here. You can use either async/await or .then.
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
You can use these functions in different methods. The result of the above code is:
```javascript
// time 200: request-2
// time 300: data-1 response1
// time 400: data-2 response2
```
#### Parameters passed in during createTaskList instantiation

|      name       | description         | default  |
|  ----          | ----         | ----   |
| ordered        | Is it orderly     | false  |
| requestCount   | Number of times to access data     | 1      |
| responseCount  | Increase the number of times of data  | 1   |

#### Methods on createTaskList Instances

|  name           | description         | returned data structure  |
|  ----          | ----        | ----  |
| request        | Used to access data | Promise type, The data obtained is the original data of <br> pushResponse. If the responseCount is greater than 1,<br> an array will be obtained|
| pushResponse   | Used to add data | -- |
| clear          | Clear all statuses | -- |
| getStatus      | Get current status | {<br>&nbsp;&nbsp;// Whether to complete all request binding <br> &nbsp;&nbsp; requestDone: false, <br>&nbsp;&nbsp;// Whether to complete all pushResponse<br>&nbsp;&nbsp; responseDone: false, <br>&nbsp;&nbsp; //Number of requests bound <br>&nbsp;&nbsp; requestCount: 1 (Number of requests bound), <br>&nbsp;&nbsp; // Number of pushResponse complete<br>&nbsp;&nbsp;responseCount: 1 (Number of pushResponse completed)<br>} |

### use createTaskOrder

The request and response can be out of order.
```javascript
import { createTaskOrder } from 'async-task-mapping';
const taskOrder = createTaskOrder()

  setTimeout(async () => {
    // A Promise.resolve is returned here. You can use either async/await or .then.
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
You can use these functions in different methods. The result of the above code is:
```javascript
// time 230: data1 Response1
// time 500: data2 Response2
```
#### Methods on createTaskOrder Instances

|  name           | description         | returned data structure  |
|  ----          | ----        | ----  |
| request        | The method to access data, which can be <br> passed in a function to be executed immediately    | Promise type, the data obtained is the original data of <br> pushResponse |
| pushResponse   | Used to add data | -- |
| clear          | Clear all statuses | -- |
| getStatus      | Get current status   | {<br>&nbsp;&nbsp;//Number of incomplete matching requests<br>&nbsp;&nbsp;pendingRequests: 0, <br>&nbsp;&nbsp;//Number of responses that have not completed matching<br>&nbsp;&nbsp;pendingResponses: 0 <br> } |
| getLastCompletedTask  | Get the data matching the last request with the response | -- |

### License

[MIT](https://github.com/TNT-03/async-task-mapping/blob/master/LICENSE).