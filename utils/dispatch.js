export const checkCallback = (cb) => {
  if (cb) {
    cb();
  }
};

export const getTracks = (node) => {
  let count = 0;
  while (node.next) {
    count++;
    node = node.next;
  }
  return count;
};
