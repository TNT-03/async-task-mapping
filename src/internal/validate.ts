import type { AbortSignalLike } from "../types";

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

/**
 * 断言 `value` 是 undefined(不启用)或满足 `AbortSignalLike`(按鸭子类型判断,不依赖全局构造函数),否则抛 `TypeError`。
 * 断言只会收窄类型而不会替换值,所以调用方传入完整的 `AbortSignal` 时,类型仍是 `AbortSignal`。
 */
export function assertOptionalSignal(
  value: unknown,
): asserts value is AbortSignalLike | undefined {
  if (value !== undefined && !isAbortSignalLike(value)) {
    throw new TypeError(
      "signal must be an AbortSignal, or an object with `aborted`, `addEventListener` and `removeEventListener`",
    );
  }
}

/** undefined 表示不启用;其余必须满足 `AbortSignalLike`,否则抛 `TypeError` */
export function resolveSignal(value: unknown): AbortSignalLike | undefined {
  assertOptionalSignal(value);
  return value;
}

/** 只校验 `aborted` / `addEventListener` / `removeEventListener`;缺失的 `reason` 由 `watchAbort` 填充默认值 */
function isAbortSignalLike(value: unknown): value is AbortSignalLike {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<AbortSignalLike>;
  return (
    typeof candidate.aborted === "boolean" &&
    typeof candidate.addEventListener === "function" &&
    typeof candidate.removeEventListener === "function"
  );
}
