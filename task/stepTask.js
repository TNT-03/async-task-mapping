class StepTask {
  #index = 0;
  taskList = [];
  result = [];
  err = [];
  code = () => {
    //
  };
  constructor(list, limit, code) {
    this.taskList = list;
    this.code = code;
    for (let i = 0; i < limit; i++) {
      checkTask();
    }
  }
  checkTask() {
    this.taskList[this.this.#index++]()
      .then(
        (data) => {
          this.result.push(data);
          checkTask();
        },
        (e) => {
          this.err.push(e);
          checkTask();
        }
      )
      .then(this.code);
  }
}

export default StepTask;
