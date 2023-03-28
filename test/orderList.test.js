// eslint-disable-next-line @typescript-eslint/no-var-requires
// const { createTaskList } = require('../dist/index')
test('createTaskList error', async () => {
  const asyncTask = createTaskList({ordered: true, taskCount: 2, resolveCount: 2})
  let target = ''
  setTimeout(() => {
    asyncTask.then((data) => {
      target += data.join('')
    })
  }, 10)
  setTimeout(async () => {
    const data = await asyncTask
    target += data.join('')
  }, 20)

  setTimeout(() => {
    asyncTask.pushResolve('res1')
  }, 30)

  setTimeout(() => {
    asyncTask.pushResolve('res2')
  }, 40)
  setTimeout(() => {
    expect(target).toBe('res1res2res1res2');
  }, 50)
});