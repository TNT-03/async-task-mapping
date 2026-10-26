import { describe, expect, it } from "vitest";
import { createStepTask, createTaskList, createTaskOrder } from "../src/index";
import type { AbortSignalLike } from "../src/index";
import { deferred } from "./helpers";

/**
 * 只实现库用到的成员的信号对象。
 * 不传参数时对象上没有 `reason` 属性;传了(包括 `undefined`)则带上 `reason`。
 */
function createFakeSignal(...args: [] | [reason: unknown]): {
  signal: AbortSignalLike;
  abort: () => void;
} {
  const listeners = new Set<() => void>();
  const state: {
    aborted: boolean;
    reason?: unknown;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  } = {
    aborted: false,
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };
  if (args.length > 0) {
    state.reason = args[0];
  }
  return {
    signal: state as unknown as AbortSignalLike,
    abort: () => {
      state.aborted = true;
      for (const listener of [...listeners]) {
        listener();
      }
    },
  };
}

/** 没有 reason 时的默认原因:与原生 `abort()` 不带参数时一致 */
const isDefaultAbortError = (reason: unknown): boolean =>
  reason instanceof DOMException && reason.name === "AbortError";

describe("AbortSignalLike:自行实现的信号对象", () => {
  it("TaskList / TaskOrder / StepTask 都接受只实现必要成员的对象", () => {
    const { signal } = createFakeSignal();
    expect(() => createTaskList({ signal })).not.toThrow();
    expect(() => createTaskOrder({ signal })).not.toThrow();
    expect(() =>
      createStepTask([() => 1], { limit: 1, signal: signal as AbortSignal }),
    ).not.toThrow();
  });

  it("带 reason:abort 后以该 reason reject", async () => {
    const reason = new Error("stop");

    const list = createFakeSignal(reason);
    const task = createTaskList<number>({ signal: list.signal });
    const listPending = expect(task.request()).rejects.toBe(reason);
    list.abort();
    await listPending;
    await expect(task.request()).rejects.toBe(reason);

    const order = createFakeSignal(reason);
    const taskOrder = createTaskOrder<number>({ signal: order.signal });
    const orderPending = expect(taskOrder.request()).rejects.toBe(reason);
    order.abort();
    await orderPending;
    await expect(taskOrder.request()).rejects.toBe(reason);

    const step = createFakeSignal(reason);
    const gate = deferred<number>();
    const stepPending = expect(
      createStepTask([() => gate.promise], {
        limit: 1,
        signal: step.signal as AbortSignal,
      }),
    ).rejects.toBe(reason);
    step.abort();
    await stepPending;
    gate.resolve(1);
  });

  it("没有 reason(属性缺失或为 undefined):abort 后以默认的 AbortError reject", async () => {
    for (const fake of [createFakeSignal(), createFakeSignal(undefined)]) {
      const task = createTaskList<number>({ signal: fake.signal });
      const pending = task.request();
      fake.abort();
      expect(isDefaultAbortError(await pending.catch((e: unknown) => e))).toBe(
        true,
      );
      expect(
        isDefaultAbortError(await task.request().catch((e: unknown) => e)),
      ).toBe(true);
    }

    const order = createFakeSignal();
    const taskOrder = createTaskOrder<number>({ signal: order.signal });
    const orderPending = taskOrder.request();
    order.abort();
    expect(
      isDefaultAbortError(await orderPending.catch((e: unknown) => e)),
    ).toBe(true);

    const step = createFakeSignal();
    const gate = deferred<number>();
    const stepPending = createStepTask([() => gate.promise], {
      limit: 1,
      signal: step.signal as AbortSignal,
    });
    step.abort();
    expect(
      isDefaultAbortError(await stepPending.catch((e: unknown) => e)),
    ).toBe(true);
    gate.resolve(1);
  });

  it("创建时已经 aborted 且没有 reason:同样使用默认的 AbortError", async () => {
    const fake = createFakeSignal();
    fake.abort();
    const task = createTaskList<number>({ signal: fake.signal });
    expect(
      isDefaultAbortError(await task.request().catch((e: unknown) => e)),
    ).toBe(true);
  });

  it("显式传入的 falsy reason(null)必须原样保留,不会被默认值替换", async () => {
    const controller = new AbortController();
    const task = createTaskList<number>({ signal: controller.signal });
    const pending = expect(task.request()).rejects.toBeNull();
    controller.abort(null);
    await pending;

    const fake = createFakeSignal(null);
    const order = createTaskOrder<number>({ signal: fake.signal });
    const orderPending = expect(order.request()).rejects.toBeNull();
    fake.abort();
    await orderPending;
  });

  it("填充默认原因不会修改传入的对象", async () => {
    const fake = createFakeSignal();
    const task = createTaskList<number>({ signal: fake.signal });
    const pending = task.request().catch((e: unknown) => e);
    fake.abort();
    await pending;
    expect("reason" in fake.signal).toBe(false);
  });

  it("缺少必要成员的对象会抛 TypeError", () => {
    const bad = (value: unknown): never => value as never;
    expect(() => createTaskList({ signal: bad({ aborted: false }) })).toThrow(
      TypeError,
    );
    expect(() =>
      createTaskOrder({
        signal: bad({ aborted: false, addEventListener: () => undefined }),
      }),
    ).toThrow(TypeError);
    expect(() =>
      createStepTask([() => 1], { limit: 1, signal: bad({}) }),
    ).toThrow(TypeError);
    expect(() =>
      createStepTask([() => 1], { limit: 1, signal: bad(null) }),
    ).toThrow(TypeError);
  });
});
