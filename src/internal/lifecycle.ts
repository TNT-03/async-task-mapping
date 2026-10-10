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

function noop(): void {
  // 无需清理
}
