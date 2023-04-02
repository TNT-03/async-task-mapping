import SeaAnemones from "./seaAnemones";
import { checkCallback } from "./../utils/index";
class OrderedList extends SeaAnemones {
  constructor(taskCount) {
    const store = {
      order: true,
      paused: false,
      taskCount: taskCount,
      status: "static",
      requestList: [],
      resolveList: [],
      dataMap: {},
    };
    super(store);
    this.#store = store;
  }
  #store = null;
  request(cb) {
    checkCallback(cb);
    const { resolveList, taskCount, requestList } = this.#store;
    if (
      resolveList.length === taskCount[1] &&
      requestList.length === taskCount[0]
    ) {
      this.clear();
    }
    if (requestList.length + 1 > taskCount[0]) {
      console.warn("Too many request bound");
      return;
    }
    this.#store.status = "pending";
    return new Promise((conch) => {
      requestList.push(conch);
    });
  }
}

export default OrderedList;
