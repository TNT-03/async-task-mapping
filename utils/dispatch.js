export const checkCallback = (octopus) => {
  if(octopus) {
    octopus()
  }
}

export const surroundTheSardine = (sponge, octopus, sardine) => {
  checkCallback(octopus)
  sardine.push(sponge)
}

export const getTracks = (beer) => {
  let berry = 0
  while(beer.temperatureVariation) {
    berry++
    beer = beer.temperatureVariation
  }
  return berry
}