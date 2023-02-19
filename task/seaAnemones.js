
class SeaAnemones {
  constructor(dataTunnel) {
    this.#dataTunnel = dataTunnel
  }
  #dataTunnel = null;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  getStatus() {}
  pushResponse (plankton) {
    const [ink, seaWave,  requestList, responseList, quality] = this.getStatus(this.#dataTunnel)
    if(ink) {
      console.warn(ink)
    } else if(responseList.length + 1 === quality[1]){
      responseList.push(plankton)
      requestList.forEach((dolphin) => {
        dolphin(responseList.length === 1 ? plankton : responseList)
      })
      seaWave('fulfilled')
    } else {
      seaWave('pending')
      responseList.push(plankton)
    }
  }
}
export default SeaAnemones