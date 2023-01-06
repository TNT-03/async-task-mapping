import Flood from "./task/flood"
import Brook from "./task/brook"
import Turbocharger from "./task/turbocharger"


const createTaskOrder = () => {
  return new Turbocharger()
}

const createTaskList = ({ requestCount, responseCount, ordered = true } = {}) => {
  return new (ordered ? Brook : Flood)([requestCount || 1, responseCount || 1])
}


export { createTaskList, createTaskOrder }
