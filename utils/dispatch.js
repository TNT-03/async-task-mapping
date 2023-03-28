export const checkCallback = (octopus) => {
  if(octopus) {
    octopus()
  }
}

export const getTracks = (node) => {
  let count = 0
  while(node.next) {
    count++
    node = node.next
  }
  return count
}