import { describe, expect, it, vi } from "vitest";
import {
  TaskClearedError,
  createStepTask,
  createTaskList,
  createTaskOrder,
} from "../src/index";
describe("旧实现缺陷的回归", () => {
  // 源码不得使用 console / window / navigator / process 等全局,由 eslint.config.js 的
  // no-console 与 no-restricted-globals 在 lint 阶段保证
  it("所有路径(含超限、clear)都不向 console 输出", async () => {
    const spies = (["log", "warn", "error", "info"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    const task = createTaskList<number>();
    const first = task.request();
    await task.request().catch(() => undefined);
    task.pushResolve(1);
    await first;

    const order = createTaskOrder<number>();
    order.pushResolve(1);
    await order.request();
    const dropped = order.request().catch(() => undefined);
    order.clear();
    await dropped;

    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });

  it("实例不拷贝 Promise.prototype,也不覆盖 Symbol.toStringTag", () => {
    for (const instance of [createTaskList(), createTaskOrder()]) {
      expect(Object.getOwnPropertyNames(instance)).toEqual([]);
      expect(Object.prototype.toString.call(instance)).toBe("[object Object]");
      expect(instance).not.toBeInstanceOf(Promise);
      expect("then" in instance).toBe(true);
    }
  });

  it("clear 后旧的 pending Promise 会被结算,不会永远悬挂", async () => {
    const task = createTaskList<number>();
    const order = createTaskOrder<number>();
    const pending = [task.request(), order.request()].map((promise) =>
      promise.then(
        () => "fulfilled",
        (error: unknown) =>
          error instanceof TaskClearedError ? "cleared" : "other",
      ),
    );
    task.clear();
    order.clear();
    expect(await Promise.all(pending)).toEqual(["cleared", "cleared"]);
  });

  it("request 超限不会得到 undefined,await 也能得到明确的错误", async () => {
    const task = createTaskList<number>();
    void task.request();
    const overflow = task.request();
    expect(overflow).toBeInstanceOf(Promise);
    await expect(overflow).rejects.toBeInstanceOf(RangeError);
    await expect(task.then(() => 1)).rejects.toBeInstanceOf(RangeError);
  });

  it("pushResolve 的错误通过异常暴露,而不是返回字符串", () => {
    const task = createTaskList<number>();
    let returned: unknown;
    expect(() => {
      returned = task.pushResolve(1);
    }).toThrow();
    expect(returned).toBeUndefined();
  });

  it("TaskOrder.getStatus 不再恒为 0", () => {
    const order = createTaskOrder<number>();
    void order.request();
    void order.request();
    order.pushResolve(1);
    order.pushResolve(2);
    order.pushResolve(3);
    expect(order.getStatus()).toEqual({
      pendingRequests: 0,
      pendingResolve: 1,
    });
  });

  it("不同轮次之间的 dataMap 互不污染", async () => {
    const task = createTaskList<string>({ ordered: false });
    task.pushResolve("a", "key");
    const first = await task.request();
    const next = task.request();
    task.pushResolve("b", "other");
    const second = await next;
    expect(first.dataMap).toEqual({ key: "a" });
    expect(second.dataMap).toEqual({ other: "b" });
  });

  it("StepTask 能正常运行并按下标收集结果", async () => {
    const settled = await createStepTask(
      [
        () => Promise.resolve("a"),
        () => Promise.reject(new Error("b")),
        () => "c",
      ],
      { limit: 2 },
    );
    expect(settled.map((item) => item.status)).toEqual([
      "fulfilled",
      "rejected",
      "fulfilled",
    ]);
  });

  it("paused 后积压的多条数据在 running 时不会只匹配一条", async () => {
    const order = createTaskOrder<number>();
    order.paused();
    const requests = [order.request(), order.request()];
    order.pushResolve(1);
    order.pushResolve(2);
    order.running();
    expect(await Promise.all(requests)).toEqual([1, 2]);
  });
});
