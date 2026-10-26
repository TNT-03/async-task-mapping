import type { AbortSignalLike } from "../types";

/** 启动一个定时器,返回取消函数 */
export function startTimer(ms: number, onTimeout: () => void): () => void {
  const id = setTimeout(onTimeout, ms);
  return () => {
    clearTimeout(id);
  };
}

/**
 * 读取 abort 的原因。真实的 `AbortSignal` 在 abort 后一定有 `reason`;
 * 自行实现的信号对象可能没有,此时与原生 `abort()` 不带参数时一致,使用默认的 `AbortError`。
 * 只是读取时填充,不会修改传入的对象。
 */
function readAbortReason(signal: AbortSignalLike): unknown {
  // 只有 undefined 才填充:`abort(null)` 等显式传入的值必须原样保留
  return signal.reason === undefined
    ? new DOMException("This operation was aborted", "AbortError")
    : signal.reason;
}

/**
 * 监听 AbortSignal,返回取消监听的函数。
 * signal 已经 aborted 时会同步调用 `onAbort`。
 */
export function watchAbort(
  signal: AbortSignalLike,
  onAbort: (reason: unknown) => void,
): () => void {
  if (signal.aborted) {
    onAbort(readAbortReason(signal));
    return noop;
  }
  const listener = (): void => {
    onAbort(readAbortReason(signal));
  };
  signal.addEventListener("abort", listener, { once: true });
  return () => {
    signal.removeEventListener("abort", listener);
  };
}

/** target 被回收后,自动摘掉它留在 signal 上的监听器 */
const unwatchRegistry = new FinalizationRegistry<() => void>((unwatch) => {
  unwatch();
});

/**
 * 与 `watchAbort` 类似,但只对 `target` 持有弱引用:
 * - 长寿命的 signal 不会把 `target` 钉在内存里;
 * - `target` 被回收后,监听器会被摘除,不会在 signal 上越积越多。
 * 注意:`onAbort` 不能闭包引用 `target`,否则弱引用就失去意义。
 */
export function watchAbortWeakly<T extends object>(
  signal: AbortSignalLike,
  target: T,
  onAbort: (target: T, reason: unknown) => void,
): void {
  const ref = new WeakRef(target);
  const unwatch = watchAbort(signal, (reason) => {
    const alive = ref.deref();
    if (alive) {
      onAbort(alive, reason);
    }
  });
  // 已 aborted 时 unwatch 是空操作,注册也无害
  unwatchRegistry.register(target, unwatch);
}

function noop(): void {
  // 无需清理
}
