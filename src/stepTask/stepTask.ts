import { watchAbort } from "../internal/lifecycle";
import { assertPositiveInteger, resolveSignal } from "../internal/validate";

export interface StepTaskOptions<T> {
  /** 最大并发数,正整数 */
  limit: number;
  /** 取消信号:abort 后不再启动新任务,返回的 Promise 以 `signal.reason` reject */
  signal?: AbortSignal | undefined;
  /** 全部任务结算后、返回的 Promise resolve 前调用一次;它抛出的错误会使返回的 Promise reject */
  onComplete?: ((settled: PromiseSettledResult<T>[]) => void) | undefined;
}

/**
 * 并发池:调用即开始执行,同时运行的任务不超过 `limit`。
 * 结果按任务下标排序(与 `Promise.allSettled` 一致),同步抛错的任务记为 rejected。
 */
export function createStepTask<T>(
  tasks: readonly (() => PromiseLike<T> | T)[],
  options: StepTaskOptions<T>,
): Promise<PromiseSettledResult<T>[]> {
  // 先转成 unknown 再判断,避免 Array.isArray 把 tasks 收窄成 any[]
  const candidate: unknown = tasks;
  if (!Array.isArray(candidate)) {
    throw new TypeError("tasks must be an array of functions");
  }
  const limit = assertPositiveInteger(options.limit, "limit");
  const signal = resolveSignal(options.signal);
  const onComplete = options.onComplete;

  return new Promise<PromiseSettledResult<T>[]>((resolve, reject) => {
    // 结算后置空,释放对任务函数及其闭包的引用
    let queue: (() => PromiseLike<T> | T)[] | null = [...tasks];
    const total = queue.length;
    const settled = new Array<PromiseSettledResult<T>>(total);
    let nextIndex = 0;
    let running = 0;
    let finished = 0;
    // 会在回调里被修改,用 as boolean 避免控制流把它收窄成恒为 false
    let closed = false as boolean;
    let unwatch: (() => void) | null = null;

    const close = (): void => {
      closed = true;
      queue = null;
      unwatch?.();
      unwatch = null;
    };

    const record = (index: number, result: PromiseSettledResult<T>): void => {
      if (closed) {
        return;
      }
      settled[index] = result;
      running--;
      finished++;
      if (finished === total) {
        close();
        try {
          onComplete?.(settled);
          resolve(settled);
        } catch (error) {
          reject(error);
        }
      } else {
        launch();
      }
    };

    const launch = (): void => {
      while (queue && running < limit && nextIndex < total) {
        const index = nextIndex++;
        const task = queue[index] as () => PromiseLike<T> | T;
        running++;
        // executor 内同步抛错会自动变成 rejected;非函数元素同理(TypeError)
        const outcome = new Promise<T>((settle) => {
          settle(task());
        });
        // 结算都经由微任务回调,同步抛错的任务也不会造成递归调用
        outcome.then(
          (value) => {
            record(index, { status: "fulfilled", value });
          },
          (reason: unknown) => {
            record(index, { status: "rejected", reason });
          },
        );
      }
    };

    if (signal) {
      // 完成时会先 unwatch,所以回调触发时一定还没 closed
      unwatch = watchAbort(signal, (reason) => {
        close();
        reject(reason);
      });
    }
    if (closed) {
      return;
    }
    if (total === 0) {
      close();
      try {
        onComplete?.(settled);
        resolve(settled);
      } catch (error) {
        reject(error);
      }
      return;
    }
    launch();
  });
}
