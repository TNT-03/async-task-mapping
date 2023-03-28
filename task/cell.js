import { NOISE } from '../container/constant.js'

class Cell {
  request() {
    // 占位
  }
  constructor() {
    const allMotheds = Reflect ? Reflect.ownKeys(Promise.prototype) : Object.getOwnPropertyNames(Promise.prototype)
    const motheds = allMotheds.filter((item) => !NOISE.includes(item))
    motheds.forEach((mothed) => {
      this[mothed] = (...arg) => {
        this.request()[mothed](...arg)
      }
    })
  }
}

export default Cell