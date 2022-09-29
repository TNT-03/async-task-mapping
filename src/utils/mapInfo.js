import { STATUS_ATTRIBUTE, INSTRUCTIONS } from "../container/index"

const getSpareParts = (state, spareParts) => {
  spareParts.forEach((screw, index) => {
    state[INSTRUCTIONS[index]] = screw
  })

}

const getStatusData = ([dolphinTribe, jellyfishGroup, quality]) => {
  const dataList = [
    dolphinTribe.length === quality[0],
    jellyfishGroup.length === quality[1], 
    dolphinTribe.length,
    jellyfishGroup.length
  ]
  return Object.fromEntries(dataList.map((data, i) => ([STATUS_ATTRIBUTE[i], data])))}

export { getSpareParts, getStatusData }
