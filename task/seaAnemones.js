import Cell from "./cell";
import { getStatusData } from "../utils/index";

class SeaAnemones extends Cell {
  constructor(store) {
    super();
    this.#store = store;
  }
  #store = null;
  pushResolve(resolve, name) {
    const { order, paused, resolveList, dataMap, taskCount, requestList } =
      this.#store;
    if (order && requestList.length !== taskCount[0]) {
      return "Please bind the request before binding the pushResolve";
    }
    if (resolveList.length === taskCount[1]) {
      return "Too many pushResolve bound";
    }
    resolveList.push(resolve);
    if (name) {
      dataMap[name] = resolve;
    }
    if (paused) {
      return;
    }
    this.running();
  }
  paused() {
    this.#store.paused = true;
  }
  running() {
    const { resolveList, dataMap, taskCount, requestList } = this.#store;
    if (resolveList.length === taskCount[1]) {
      requestList.forEach((callback) => {
        callback({ list: resolveList, dataMap });
      });
      this.#store.status = "fulfilled";
    } else {
      this.#store.status = "pending";
    }
    this.#store.paused = false;
  }
  clear() {
    [
      this.#store.taskCount,
      this.#store.status,
      this.#store.requestList,
      this.#store.resolveList,
    ] = [[1, 1], "static", [], []];
  }
  getStatus() {
    const { requestList, resolveList, taskCount } = this.#store;
    return getStatusData([requestList, resolveList, taskCount]);
  }
}
export default SeaAnemones;
