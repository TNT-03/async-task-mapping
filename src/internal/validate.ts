/** undefined 取默认值;其余必须是正整数,否则抛错 */
export function resolvePositiveInteger(
  value: unknown,
  name: string,
  fallback: number,
): number {
  if (value === undefined) {
    return fallback;
  }
  return assertPositiveInteger(value, name);
}

export function assertPositiveInteger(value: unknown, name: string): number {
  if (typeof value !== "number") {
    throw new TypeError(`${name} must be a positive integer`);
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(
      `${name} must be a positive integer, got ${String(value)}`,
    );
  }
  return value;
}

/** setTimeout 的上限(2^31 - 1 毫秒,约 24.8 天),超过会被当成 1ms 立即触发 */
export const MAX_TIMEOUT = 2_147_483_647;

/** undefined 表示不启用;其余必须是大于 0 且不超过 MAX_TIMEOUT 的数字(毫秒) */
export function resolveTimeout(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number") {
    throw new TypeError("timeout must be a positive number of milliseconds");
  }
  if (!Number.isFinite(value) || value <= 0 || value > MAX_TIMEOUT) {
    throw new RangeError(
      `timeout must be a positive number no greater than ${String(MAX_TIMEOUT)}, got ${String(value)}`,
    );
  }
  return value;
}

/** undefined 表示不启用;其余必须是 AbortSignal(按鸭子类型判断,不依赖全局构造函数) */
export function resolveSignal(value: unknown): AbortSignal | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isAbortSignalLike(value)) {
    throw new TypeError("signal must be an AbortSignal");
  }
  return value;
}

function isAbortSignalLike(value: unknown): value is AbortSignal {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<AbortSignal>;
  return (
    typeof candidate.aborted === "boolean" &&
    typeof candidate.addEventListener === "function" &&
    typeof candidate.removeEventListener === "function"
  );
}
