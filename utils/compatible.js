import { MOTHODS } from "./../container/index";
const addOldMotheds = (task) => {
  MOTHODS.forEach(({ name, oldName }) => {
    task[oldName] = (data, key) => {
      console.warn(
        "Please use an API after v1.0.0. The current API is already in an unsafe state."
      );
      return task[name](data, key);
    };
  });
};

export { addOldMotheds };
