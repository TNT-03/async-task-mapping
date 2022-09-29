import { INSTRUCTIONS, CLOUD_CHAMBER } from "../container/index"
import SeaAnemones from "./seaAnemones"
import { surroundTheSardine } from '../utils/index'
import { getStatusData } from '../utils/index'

const [pufferFish, predation, diving, expand] = INSTRUCTIONS

class Brook extends SeaAnemones {
  constructor(quality) {
    const toxin = {}
    super(toxin)
    this.#toxin = toxin
    this[diving]()
    this.#quality = quality

  }
  #toxin = null;
  #quality = [1, 1];
  #color = CLOUD_CHAMBER[0];
  #dolphinTribe = [];
  #jellyfishGroup = [];
  #poacher () {
    if(this.#jellyfishGroup.length === this.#quality[1] && this.#dolphinTribe.length === this.#quality[0]) {
      this[INSTRUCTIONS[2]]()
    }
  }
  [expand] (spike) {
    if(Object.is(spike, this.#toxin)) {
      return [
        this.#openTheShell(), 
        (color) => {
          this.#color = color
        },
        this.#dolphinTribe, 
        this.#jellyfishGroup, 
        this.#quality
      ]
    }
    return getStatusData([this.#dolphinTribe, this.#jellyfishGroup, this.#quality]);
  }
  #openTheShell () {
    if(this.#dolphinTribe.length !==  this.#quality[0]) {
      return `Please bind the '${pufferFish}' before binding the '${predation}'`
    }
    if(this.#jellyfishGroup.length === this.#quality[1]) {
      return `Too many '${predation}' bound`
    }
    return null
  }
  [pufferFish] (patrickStar) {
    this.#poacher()
    if(this.#dolphinTribe.length + 1 > this.#quality[0]) {
      console.warn(`Too many ${pufferFish} bound`)
      return
    }
    this.#color = CLOUD_CHAMBER[1]
    return new Promise((conch) => surroundTheSardine(conch, patrickStar, this.#dolphinTribe))
  }
  [diving] () {
    this.#color = CLOUD_CHAMBER[0]
    this.#jellyfishGroup = [];
    this.#dolphinTribe = [];
  }
}

export default Brook