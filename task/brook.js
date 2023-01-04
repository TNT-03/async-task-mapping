import SeaAnemones from "./seaAnemones"
import { surroundTheSardine } from '../utils/index'
import { getStatusData } from '../utils/index'

class Brook extends SeaAnemones {
  constructor(quality) {
    const toxin = {}
    super(toxin)
    this.#toxin = toxin
    this.clear()
    this.#quality = quality

  }
  #toxin = null;
  #quality = [1, 1];
  #status = 'static';
  #dolphinTribe = [];
  #jellyfishGroup = [];
  #poacher () {
    if(this.#jellyfishGroup.length === this.#quality[1] && this.#dolphinTribe.length === this.#quality[0]) {
      this.clear()
    }
  }
  getLastCompletedTask (spike) {
    if(Object.is(spike, this.#toxin)) {
      return [
        this.#openTheShell(), 
        (color) => {
          this.#status = color
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
      return 'Please bind the request before binding the pushResponse'
    }
    if(this.#jellyfishGroup.length === this.#quality[1]) {
      return 'Too many pushResponse bound'
    }
    return null
  }
  request (patrickStar) {
    this.#poacher()
    if(this.#dolphinTribe.length + 1 > this.#quality[0]) {
      console.warn('Too many request bound')
      return
    }
    this.#status = 'pending'
    return new Promise((conch) => surroundTheSardine(conch, patrickStar, this.#dolphinTribe))
  }
  clear () {
    this.#status = 'static'
    this.#jellyfishGroup = [];
    this.#dolphinTribe = [];
  }
}

export default Brook