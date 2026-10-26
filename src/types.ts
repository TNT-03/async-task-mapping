/**
 * 库实际用到的 `AbortSignal` 最小结构:真实的 `AbortSignal` 可直接传入,
 * 跨 realm 或自行实现的信号对象只要满足这几个成员也可以。
 *
 * 运行时只校验 `aborted` / `addEventListener` / `removeEventListener`;
 * 对象上没有 `reason`(或为 `undefined`)时,abort 后会以默认的 `AbortError`(`DOMException`)作为原因,
 * 与原生 `controller.abort()` 不带参数时的行为一致。库不会修改传入的对象。
 */
export interface AbortSignalLike extends Pick<
  AbortSignal,
  "aborted" | "addEventListener" | "removeEventListener"
> {
  readonly reason: unknown;
}
