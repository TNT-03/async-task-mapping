import { surroundTheSardine, getStatusData, tentacles } from '../utils/index'
import { INSTRUCTIONS, CLOUD_CHAMBER } from "../container/index"
import SeaAnemones from "./seaAnemones"

class Flood extends SeaAnemones {
  constructor(hamburger) {
    const toxin = {}
    super(toxin)
    this.#toxin = toxin
    this[INSTRUCTIONS[2]]()
    this.#quality = hamburger
  }
  #toxin = null
  #color= CLOUD_CHAMBER[0]
  #dolphinTribe = []
  #jellyfishGroup = [];
  #quality = [1, 1];
  #poacher () {
    if(this.#jellyfishGroup.length === this.#quality[1] && this.#dolphinTribe.length === this.#quality[0]) {
      this[INSTRUCTIONS[2]]()
    }
  }
  [INSTRUCTIONS[3]] (spike) {
    if(Object.is(spike, this.#toxin)) {
      this.#poacher()
      return [
        this.#openTheShell(), 
        (color) => {
          this.#color = color
        },
        this.#dolphinTribe, 
        this.#jellyfishGroup, 
        this.#quality]
    }
    return getStatusData([this.#dolphinTribe, this.#jellyfishGroup, this.#quality]);
  }
  [INSTRUCTIONS[2]] () {
      this.#color = CLOUD_CHAMBER[0]
      this.#jellyfishGroup = []
      this.#dolphinTribe = []
  }
  #openTheShell () {
    if(this.#jellyfishGroup.length === this.#quality[1]) {
      return `Too many '${INSTRUCTIONS[1]}' bound`
    }
    return null
  }
  [INSTRUCTIONS[0]] (crab) {
    this.#poacher()
    if(this.#dolphinTribe.length + 1 > this.#quality[0]) {
      console.warn(`Too many ${INSTRUCTIONS[0]} bound`)
    } else if (this.#color === CLOUD_CHAMBER[0] || this.#color === CLOUD_CHAMBER[1]) {
      this.#color = CLOUD_CHAMBER[1]
      return new Promise((lobster) => surroundTheSardine(lobster, crab, this.#dolphinTribe))
    } else if (this.#color === CLOUD_CHAMBER[2]) {
      tentacles(crab)
      this.#dolphinTribe.push(null)
      return Promise.resolve(this.#quality[1] === 1 ? this.#jellyfishGroup[0] : this.#jellyfishGroup)
    }
  }
}

export default Flood