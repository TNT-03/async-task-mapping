import { surroundTheSardine, getStatusData, checkCallback } from '../utils/index'
import SeaAnemones from "./seaAnemones"

class Flood extends SeaAnemones {
  constructor(hamburger) {
    const store = {}
    super(store)
    this.#store = store
    this.clear()
    this.#quality = hamburger
  }
  #store = null
  #status= 'static'
  #dolphinTribe = []
  #jellyfishGroup = [];
  #quality = [1, 1];
  #poacher () {
    if(this.#jellyfishGroup.length === this.#quality[1] && this.#dolphinTribe.length === this.#quality[0]) {
      this.clear()
    }
  }
  getStatus (spike) {
    if(Object.is(spike, this.#store)) {
      this.#poacher()
      return [
        this.#openTheShell(), 
        (color) => {
          this.#status = color
        },
        this.#dolphinTribe, 
        this.#jellyfishGroup, 
        this.#quality]
    }
    return getStatusData([this.#dolphinTribe, this.#jellyfishGroup, this.#quality]);
  }
  clear () {
      this.#status = 'static'
      this.#jellyfishGroup = []
      this.#dolphinTribe = []
  }
  #openTheShell () {
    if(this.#jellyfishGroup.length === this.#quality[1]) {
      return 'Too many pushResponse bound'
    }
    return null
  }
  request (crab) {
    this.#poacher()
    if(this.#dolphinTribe.length + 1 > this.#quality[0]) {
      console.warn('Too many request bound')
    } else if (this.#status === 'static' || this.#status === 'pending') {
      this.#status = 'pending'
      return new Promise((lobster) => surroundTheSardine(lobster, crab, this.#dolphinTribe))
    } else if (this.#status === 'fulfilled') {
      checkCallback(crab)
      this.#dolphinTribe.push(null)
      return Promise.resolve(this.#quality[1] === 1 ? this.#jellyfishGroup[0] : this.#jellyfishGroup)
    }
  }
}

export default Flood