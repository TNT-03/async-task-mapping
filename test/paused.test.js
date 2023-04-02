// eslint-disable-next-line
const { createTaskOrder } = require("../dist/index");
test("createTaskList error", async () => {
  const taskOrder = createTaskOrder();
  let target = "";
  setTimeout(() => {
    taskOrder.then((data) => {
      target += `then1: ${data}, `;
    });
  }, 10);
  setTimeout(async () => {
    const data = await taskOrder;
    target += `then2: ${data}, `;
    taskOrder.paused();
  }, 20);
  setTimeout(() => {
    taskOrder.pushResolve("res1");
  }, 40);
  setTimeout(() => {
    taskOrder.pushResolve("res2");
  }, 50);
  setTimeout(() => {
    taskOrder.pushResolve("res3");
  }, 60);
  setTimeout(async () => {
    taskOrder.running();
    const data = await taskOrder;
    target += `then3: ${data}, `;
  }, 70);

  setTimeout(() => {
    expect(target).toBe("then1: res1, then2: res2, then3: res3, ");
  }, 90);
});
