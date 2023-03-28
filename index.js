import UnorderedList from "./task/unorderedList"
import OrderedList from "./task/orderedList"
import TaskOrder from "./task/taskOrder"


const createTaskOrder = () => {
  return new TaskOrder()
}

const createTaskList = ({
  requestCount,
  taskCount,
  responseCount,
  resolveCount,
  ordered = true
} = {}) =>
  new (ordered ? OrderedList : UnorderedList)([
    taskCount || requestCount || 1,
    resolveCount || responseCount || 1
  ])

export { createTaskList, createTaskOrder }
