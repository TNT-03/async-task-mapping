import { getSpareParts, getTracks } from '../utils/index'
import { TURBOCHARGER_RESULT } from "../container/index"


const [oxidant, machRings] = TURBOCHARGER_RESULT
class Turbocharger {
  #oxidant = {}
  #machRings = {}
  #tailGas = null
  constructor() {
    this.#arresting()
    getSpareParts(this, [this.#oxidationReductionReaction, this.#produceHighVoltage, this.#arresting, this.#acquirePressure, this.#getTailGas])
  }
  #arresting () {
    this.#oxidant = {}
    this.#machRings = this.#oxidant
  }
  #acquirePressure () {
    return {
      [oxidant]: getTracks(this.#machRings),
      [machRings]: getTracks(this.#oxidant)
    } 
  }
  #receiveOxidant (estimatedSpeed, switchingSpeed) {
    this.#oxidant.temperatureVariation = {
      addOxidant: estimatedSpeed
    }
    this.#oxidant = this.#oxidant.temperatureVariation
    switchingSpeed()
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  #oxidationReductionReaction (switchingSpeed = () => {}) {
    if(this.#oxidant.temperatureVariation) {
      switchingSpeed()
      this.#oxidant = this.#oxidant.temperatureVariation
      this.#tailGas = this.#oxidant.machRings
      return Promise.resolve(this.#oxidant.machRings)
    } else {
      return new Promise((estimatedSpeed) => this.#receiveOxidant(estimatedSpeed, switchingSpeed))
    }
  }
  #produceHighVoltage (mixture) {
    if(this.#machRings.temperatureVariation) {
      this.#tailGas = mixture
      this.#machRings.temperatureVariation.addOxidant(mixture)
    } else {
      this.#machRings.temperatureVariation = {
        machRings: mixture
      }
    }
    this.#machRings = this.#machRings.temperatureVariation
  }
  #getTailGas () {
    return this.#tailGas
  }
}

export default Turbocharger