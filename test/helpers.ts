export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** 判断 promise 当前是否已结算(只观察一个微任务周期之后的状态) */
export async function isSettled(promise: Promise<unknown>): Promise<boolean> {
  const pending = Symbol("pending");
  const marker = await Promise.race([
    promise.then(
      () => "settled",
      () => "settled",
    ),
    Promise.resolve(pending),
  ]);
  return marker !== pending;
}

/** 多次 gc + 轮询,直到 isCollected 返回 true,避免单次 gc 的偶发不稳定 */
export async function collectGarbage(
  isCollected: () => boolean,
): Promise<boolean> {
  if (typeof gc !== "function") {
    throw new Error("需要以 --expose-gc 运行测试");
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    gc();
    if (isCollected()) {
      return true;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  return isCollected();
}
