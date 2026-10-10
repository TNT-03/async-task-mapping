/**
 * 让实例可以直接 `await` / `.then`。
 *
 * 每次调用 `then` / `catch` / `finally` 都会调用一次 `request()`,即消耗一个 request 名额。
 * 这里显式定义三个方法,不再运行时拷贝 `Promise.prototype`。
 *
 * 注意:
 * - `async` 函数里 `return` 实例会被隐式展开(等价于 `await`),同样消耗一个名额。
 * - 任何会"展开 thenable"的写法都会消耗名额,例如 `Promise.resolve(实例)`、`Promise.all([实例])`、
 *   `Promise.race([...])`,以及把实例交给会 `await` 它的第三方库 / 测试框架。
 *   需要精确控制时,请始终显式调用 `request()`。
 * - `clear()` / `abort` / `timeout` 会让这里返回的 Promise reject,没有 `catch` 时会触发 `unhandledRejection`。
 */
export abstract class Thenable<R> implements PromiseLike<R> {
  abstract request(): Promise<R>;

  then<A = R, B = never>(
    onfulfilled?: ((value: R) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return this.request().then(onfulfilled, onrejected);
  }

  catch<B = never>(
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<R | B> {
    return this.request().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<R> {
    return this.request().finally(onfinally);
  }
}
