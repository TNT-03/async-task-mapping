import UnorderedList from "./task/unorderedList";
import OrderedList from "./task/orderedList";
import TaskOrder from "./task/taskOrder";

const createTaskOrder = () => {
  return new TaskOrder();
};

const createTaskList = ({
  requestCount,
  taskCount,
  responseCount,
  resolveCount,
  ordered = true,
} = {}) => {
  if (requestCount || responseCount) {
    console.warn(
      "Please use an API after v1.0.0. The current API is already in an unsafe state."
    );
  }
  return new (ordered ? OrderedList : UnorderedList)([
    taskCount || requestCount || 1,
    resolveCount || responseCount || 1,
  ]);
};

export { createTaskList, createTaskOrder };
