// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createTaskList } = require("../dist/index");
test("createTaskList error", async () => {
  const asyncTask = createTaskList({
    ordered: true,
    taskCount: 2,
    resolveCount: 2,
  });
  let target = "";
  setTimeout(() => {
    asyncTask.then(({ list }) => {
      target += list.join("");
    });
  }, 10);
  setTimeout(async () => {
    const { list, dataMap } = await asyncTask;
    target += list.join("") + dataMap.res2_name;
  }, 20);

  setTimeout(() => {
    asyncTask.pushResolve("res1");
  }, 30);

  setTimeout(() => {
    asyncTask.pushResolve("res2", "res2_name");
  }, 40);
  setTimeout(() => {
    expect(target).toBe("res1res2res1res2" + "res2");
  }, 50);
});
