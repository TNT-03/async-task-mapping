// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createTaskList } = require('../dist/index')
test('unorderList error', async () => {
  const asyncTask = createTaskList({ordered: false, requestCount: 2, responseCount: 2})
  let target = ''
  setTimeout(async () => {
    const data = await asyncTask.request(() => target += 'req1')
    target += data.join('')
  }, 10)
  setTimeout(async () => {
    const data = await asyncTask.request(() => target += 'req2')
    target += data.join('')
  }, 20)

  setTimeout(() => {
    asyncTask.pushResponse('res1')
  }, 30)

  setTimeout(() => {
    asyncTask.pushResponse('res2')
  }, 40)
  setTimeout(() => {
    expect(target).toBe('req1req2res1res2res1res2');
  }, 50)
});