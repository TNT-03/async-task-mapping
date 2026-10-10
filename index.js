import UnorderedList from "./task/unorderedList";
import OrderedList from "./task/orderedList";
import TaskOrder from "./task/taskOrder";

const createTaskOrder = () => {
  return new TaskOrder();
};

const createTaskList = ({
  taskCount,
  resolveCount,
  ordered = true,
} = {}) => {
  return new (ordered ? OrderedList : UnorderedList)([
    taskCount || 1,
    resolveCount || 1,
  ]);
};

export { createTaskList, createTaskOrder };
