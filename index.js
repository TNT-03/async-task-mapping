import UnorderedList from "./task/unorderedList"
import OrderedList from "./task/orderedList"
import TaskOrder from "./task/taskOrder"


const createTaskOrder = () => {
  return new TaskOrder()
}

const createTaskList = ({ requestCount, responseCount, ordered = true } = {}) => {
  return new (ordered ? OrderedList : UnorderedList)([requestCount || 1, responseCount || 1])
}


export { createTaskList, createTaskOrder }
