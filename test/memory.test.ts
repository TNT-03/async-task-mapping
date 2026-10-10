import { describe, expect, it } from "vitest";
import { createStepTask, createTaskList, createTaskOrder } from "../src/index";
import { collectGarbage } from "./helpers";

/**
 * 每个场景都在独立函数里创建对象,只把 WeakRef 带出来,
 * 避免测试函数自身的局部变量把对象钉住。
 */
describe("内存释放", () => {
  it("TaskOrder:已匹配的数据在下一次匹配后可被回收", async () => {
    const order = createTaskOrder<object>();
    const ref = await (async () => {
      const payload = {};
      order.pushResolve(payload);
      await order.request();
      return new WeakRef(payload);
    })();
    // getLastCompletedTask 会持有最近一次的数据,再匹配一次后才应释放
    order.pushResolve({});
    await order.request();
    expect(await collectGarbage(() => ref.deref() === undefined)).toBe(true);
  });

  it("TaskOrder:clear 后丢弃的数据与 request 可被回收", async () => {
    const order = createTaskOrder<object>();
    const ref = (() => {
      const payload = {};
      order.pushResolve(payload);
      order.clear();
      return new WeakRef(payload);
    })();
    expect(await collectGarbage(() => ref.deref() === undefined)).toBe(true);
    expect(order.getStatus()).toEqual({
      pendingRequests: 0,
      pendingResolve: 0,
    });
  });

  it("TaskList:下一轮开始后,上一轮的结果快照可被回收", async () => {
    const task = createTaskList<object>({ ordered: false });
    const ref = await (async () => {
      const payload = {};
      task.pushResolve(payload);
      await task.request();
      return new WeakRef(payload);
    })();
    const next = task.request();
    task.pushResolve({});
    await next;
    expect(await collectGarbage(() => ref.deref() === undefined)).toBe(true);
  });

  it("TaskList:clear 后丢弃的数据可被回收", async () => {
    const task = createTaskList<object>({ ordered: false, resolveCount: 2 });
    const ref = (() => {
      const payload = {};
      task.pushResolve(payload, "named");
      task.clear();
      return new WeakRef(payload);
    })();
    expect(await collectGarbage(() => ref.deref() === undefined)).toBe(true);
    expect(task.getStatus().responseCount).toBe(0);
  });

  it("TaskList:clear 后 pending 的 request 及其回调闭包可被回收", async () => {
    const task = createTaskList<object>({ ordered: false });
    const ref = await (async () => {
      const payload = {};
      const pending = task
        .request()
        .then(() => payload)
        .catch(() => undefined);
      task.clear();
      await pending;
      return new WeakRef(payload);
    })();
    expect(await collectGarbage(() => ref.deref() === undefined)).toBe(true);
  });

  it("TaskOrder:clear 后 pending 的 request 及其回调闭包可被回收", async () => {
    const order = createTaskOrder<object>();
    const ref = await (async () => {
      const payload = {};
      const pending = order
        .request()
        .then(() => payload)
        .catch(() => undefined);
      order.clear();
      await pending;
      return new WeakRef(payload);
    })();
    expect(await collectGarbage(() => ref.deref() === undefined)).toBe(true);
    expect(order.getStatus().pendingRequests).toBe(0);
  });

  it("实例已被回收后 signal 再 abort,不会报错", async () => {
    const controller = new AbortController();
    const refs = (() => [
      new WeakRef(createTaskList({ signal: controller.signal })),
      new WeakRef(createTaskOrder({ signal: controller.signal })),
    ])();
    expect(
      await collectGarbage(() =>
        refs.every((ref) => ref.deref() === undefined),
      ),
    ).toBe(true);
    expect(() => {
      controller.abort();
    }).not.toThrow();
  });

  it("带 signal 的实例不会被长寿命的 signal 钉在内存里", async () => {
    const controller = new AbortController();
    const refs = (() => [
      new WeakRef(createTaskList({ signal: controller.signal })),
      new WeakRef(createTaskOrder({ signal: controller.signal })),
    ])();
    expect(
      await collectGarbage(() =>
        refs.every((ref) => ref.deref() === undefined),
      ),
    ).toBe(true);
  });

  it("实例被回收后,会摘除它留在长寿命 signal 上的监听器", async () => {
    const listeners = new Set<() => void>();
    // 只实现库用到的三个成员,方便统计监听器数量
    const signal = {
      aborted: false,
      addEventListener: (_type: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.delete(listener);
      },
    } as unknown as AbortSignal;

    const refs = (() => [
      new WeakRef(createTaskList({ signal })),
      new WeakRef(createTaskOrder({ signal })),
    ])();
    expect(listeners.size).toBe(2);
    expect(
      await collectGarbage(() =>
        refs.every((ref) => ref.deref() === undefined),
      ),
    ).toBe(true);
    // FinalizationRegistry 的回调是异步触发的,同样需要轮询
    expect(await collectGarbage(() => listeners.size === 0)).toBe(true);
  });

  it("StepTask:完成后释放任务函数及其闭包", async () => {
    const results = await (async () => {
      const payload = { big: new Array<number>(1000).fill(1) };
      const settled = await createStepTask([() => payload.big.length], {
        limit: 1,
      });
      return { settled, ref: new WeakRef(payload) };
    })();
    expect(await collectGarbage(() => results.ref.deref() === undefined)).toBe(
      true,
    );
    expect(results.settled[0]).toEqual({ status: "fulfilled", value: 1000 });
  });
});
