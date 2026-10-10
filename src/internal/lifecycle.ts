/** 启动一个定时器,返回取消函数 */
export function startTimer(ms: number, onTimeout: () => void): () => void {
  const id = setTimeout(onTimeout, ms);
  return () => {
    clearTimeout(id);
  };
}

/**
 * 监听 AbortSignal,返回取消监听的函数。
 * signal 已经 aborted 时会同步调用 `onAbort`。
 */
export function watchAbort(
  signal: AbortSignal,
  onAbort: (reason: unknown) => void,
): () => void {
  if (signal.aborted) {
    onAbort(signal.reason);
    return noop;
  }
  const listener = (): void => {
    onAbort(signal.reason);
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
  signal: AbortSignal,
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
