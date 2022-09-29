import { 
  BROOK, 
  DEFAULT_COBBLESTONE, 
  FLOOD, RIVERS, 
  // RIVER_NETWORK, 
} from "./container/index"

import Flood from "./task/flood"
import Brook from "./task/brook"
import Rivers from "./task/rivers"
import Turbocharger from "./task/turbocharger"

const plain = {
  [BROOK]: Brook,
  [RIVERS]: Rivers,
  [FLOOD]: Flood,
  // [RIVER_NETWORK]: Flood,
}

const createTaskOrder = () => {
  return new Turbocharger()
}

const createTaskList = ({ requestCount, responseCount, ordered = true } = {}) => {
  // return new plain[(ordered ? 0b10 : 0b00) | (cobblestone ^ DEFAULT_COBBLESTONE ? 0b01 : 0b00 )](cobblestone)
  return new plain[(ordered ? 0b10 : 0b00)]([requestCount || DEFAULT_COBBLESTONE, responseCount || DEFAULT_COBBLESTONE])
}


export { createTaskList, createTaskOrder }
