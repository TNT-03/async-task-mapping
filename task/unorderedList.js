import SeaAnemones from "./seaAnemones";
import { checkCallback, addOldMotheds } from "./../utils/index";

class UnorderedList extends SeaAnemones {
  constructor(taskCount) {
    const store = {
      taskCount: taskCount,
      status: "static",
      requestList: [],
      resolveList: [],
      dataMap: {},
    };
    super(store);
    this.#store = store;
    addOldMotheds(this);
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
    } else if (
      this.#store.status === "static" ||
      this.#store.status === "pending"
    ) {
      this.#store.status = "pending";
      return new Promise((lobster) => {
        requestList.push(lobster);
      });
    } else if (this.#store.status === "fulfilled") {
      requestList.push(null);
      return Promise.resolve(resolveList);
    }
  }
}

export default UnorderedList;
