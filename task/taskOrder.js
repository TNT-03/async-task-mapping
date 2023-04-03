import { getTracks } from "../utils/index";
import Cell from "./cell";
import { addOldMotheds } from "./../utils/index";

class TaskOrder extends Cell {
  //  链带
  #resolveChain = {};
  #requestChain = {};
  //  拉头
  #slider = {};
  #lastResolveData = null;
  #paused = false;
  constructor() {
    super();
    this.clear();
    addOldMotheds(this);
  }
  clear() {
    this.#slider = {};
    this.#resolveChain = this.#slider;
    this.#requestChain = this.#slider;
  }
  getStatus() {
    return {
      pendingRequests: getTracks(this.#requestChain),
      pendingResolve: getTracks(this.#resolveChain),
    };
  }
  #zipUp() {
    if (this.#paused) {
      return;
    }
    const next = this.#slider.next;
    console.log("zipUp", next);
    if (next && next.request && next.resolveData) {
      this.#lastResolveData = next.resolveData;
      this.#slider = next;
      next.request(next.resolveData);
    }
  }
  #addChainTeeth(node) {
    node.next = node.next ? node.next : {};
    return node.next;
  }
  request() {
    return new Promise((request) => {
      this.#requestChain = this.#addChainTeeth(this.#requestChain);
      this.#requestChain.request = request;
      this.#zipUp();
    });
  }
  pushResolve(resolveData) {
    this.#resolveChain = this.#addChainTeeth(this.#resolveChain);
    this.#resolveChain.resolveData = resolveData;
    this.#zipUp();
  }
  getLastCompletedTask() {
    return this.#lastResolveData;
  }
  paused() {
    this.#paused = true;
  }
  running() {
    this.#paused = false;
    this.#zipUp();
  }
}

export default TaskOrder;
