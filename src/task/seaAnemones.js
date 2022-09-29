import { INSTRUCTIONS, CLOUD_CHAMBER } from "../container/index"

class SeaAnemones {
  constructor(tentacle) {
    this.#tentacle = tentacle
  }
  #tentacle = null;
  [INSTRUCTIONS[1]] (plankton) {
    const [ink, seaWave,  dolphinTribe, jellyfishGroup, quality] = this[INSTRUCTIONS[3]](this.#tentacle)
    if(ink) {
      console.warn(ink)
    } else if(jellyfishGroup.length + 1 === quality[1]){
      jellyfishGroup.push(plankton)
      dolphinTribe.forEach((dolphin) => {
        dolphin(jellyfishGroup.length === 1 ? plankton : jellyfishGroup)
      })
      seaWave(CLOUD_CHAMBER[2])
    } else {
      seaWave(CLOUD_CHAMBER[1])
      jellyfishGroup.push(plankton)
    }
  }
}
export default SeaAnemones