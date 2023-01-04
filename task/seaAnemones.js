
class SeaAnemones {
  constructor(tentacle) {
    this.#tentacle = tentacle
  }
  #tentacle = null;
  pushResponse (plankton) {
    const [ink, seaWave,  dolphinTribe, jellyfishGroup, quality] = this.getStatus(this.#tentacle)
    if(ink) {
      console.warn(ink)
    } else if(jellyfishGroup.length + 1 === quality[1]){
      jellyfishGroup.push(plankton)
      dolphinTribe.forEach((dolphin) => {
        dolphin(jellyfishGroup.length === 1 ? plankton : jellyfishGroup)
      })
      seaWave('fulfilled')
    } else {
      seaWave('pending')
      jellyfishGroup.push(plankton)
    }
  }
}
export default SeaAnemones