import { getTracks } from '../utils/index'
import Cell from './cell'

class TaskOrder extends Cell{
  //  链带
  #resolveChain ={}
  #requestChain ={}
  //  拉头
  #slider = {}
  #lastResolveData = null
  #paused = false
  constructor() {
    super()
    this.clear()
  }
  clear () {
    this.#slider = {}
    this.#resolveChain = this.#slider
    this.#requestChain = this.#slider
  }
  getStatus () {
    return {
      pendingRequests: getTracks(this.#requestChain),
      pendingResolve: getTracks(this.#resolveChain)
    }
  }
  #zipUp () {
    if(this.#paused) {
      return
    }
    const next = this.#slider.next
    if(next && next.request && next.resolveData) {
      this.#lastResolveData = next.resolveData
      this.#slider = next
      next.request(next.resolveData)
    }
  }
  #addChainTeeth (node) {
    let next = node.next ? node.next : {}
    next = next.next
    return next
  }
  request () {
    return new Promise((request) =>{
      this.#requestChain = this.#addChainTeeth(this.#requestChain)
      this.#requestChain.request = request
      this.#zipUp()
    })
  }
  pushResolve (resolveData) {
    this.#requestChain = this.#addChainTeeth(this.#requestChain)
    this.#requestChain.resolveData = resolveData
    this.#zipUp()
  }
  getLastCompletedTask() {
    return this.#lastResolveData
  }
  paused () {
    this.#paused = true
  }
  running() {
    this.#paused = false
    this.#zipUp()
  }
}

export default TaskOrder