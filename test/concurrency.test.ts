import { describe, expect, it } from "vitest";
import { createTaskList, createTaskOrder } from "../src/index";
import { isSettled } from "./helpers";

describe("并发与竞态", () => {
  it("TaskOrder:同一 tick 内 request 与 pushResolve 交错,依然按先后顺序配对", async () => {
    const order = createTaskOrder<string>();
    const results: Promise<string>[] = [];
    results.push(order.request());
    order.pushResolve("p1");
    order.pushResolve("p2");
    results.push(order.request());
    results.push(order.request());
    order.pushResolve("p3");
    results.push(order.request());
    order.pushResolve("p4");
    expect(await Promise.all(results)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("TaskOrder:乱序到达(数据先到、请求后到、再混合)", async () => {
    const order = createTaskOrder<number>();
    order.pushResolve(1);
    const a = order.request();
    const b = order.request();
    order.pushResolve(2);
    order.pushResolve(3);
    const c = order.request();
    expect(await Promise.all([a, b, c])).toEqual([1, 2, 3]);
  });

  it("TaskOrder:大量交错调用不丢数据", async () => {
    const order = createTaskOrder<number>();
    const results: Promise<number>[] = [];
    for (let i = 0; i < 500; i++) {
      if (i % 3 === 0) {
        order.pushResolve(i);
        results.push(order.request());
      } else {
        results.push(order.request());
        order.pushResolve(i);
      }
    }
    expect(await Promise.all(results)).toEqual(
      Array.from({ length: 500 }, (_, i) => i),
    );
    expect(order.getStatus()).toEqual({
      pendingRequests: 0,
      pendingResolve: 0,
    });
  });

  it("TaskOrder:paused 期间到达的请求和数据,在 running 时按序结算", async () => {
    const order = createTaskOrder<string>();
    const first = order.request();
    order.paused();
    const second = order.request();
    order.pushResolve("a");
    order.pushResolve("b");
    expect(await isSettled(first)).toBe(false);
    order.running();
    expect(await Promise.all([first, second])).toEqual(["a", "b"]);
  });

  it("TaskOrder:clear 与 pushResolve 同时发生,先后顺序决定结果", async () => {
    const order = createTaskOrder<string>();

    // 先 push 再 clear:数据已经配对给 request,clear 不影响
    const matched = order.request();
    order.pushResolve("kept");
    order.clear();
    expect(await matched).toBe("kept");

    // 先 clear 再 push:数据留在队列里,等待下一个 request
    const cleared = expect(order.request()).rejects.toThrow();
    order.clear();
    order.pushResolve("after-clear");
    await cleared;
    expect(await order.request()).toBe("after-clear");
  });

  it("TaskList(无序):同一 tick 内多个 request 在最后一次 pushResolve 时一起结算", async () => {
    const task = createTaskList<number>({
      ordered: false,
      taskCount: 3,
      resolveCount: 2,
    });
    const requests = [task.request(), task.request()];
    task.pushResolve(1);
    expect(await isSettled(requests[0] as Promise<unknown>)).toBe(false);
    const third = task.request();
    task.pushResolve(2);
    const results = await Promise.all([...requests, third]);
    expect(new Set(results).size).toBe(1);
    expect(results[0]?.list).toEqual([1, 2]);
  });

  it("TaskList:clear 与 pushResolve 同时发生", async () => {
    const task = createTaskList<number>({ ordered: false });
    const pending = expect(task.request()).rejects.toThrow();
    task.clear();
    task.pushResolve(1);
    await pending;
    // clear 之后新 push 的数据属于新一轮
    expect((await task.request()).list).toEqual([1]);
  });

  it("TaskList:重复 pushResolve 超出 resolveCount 抛错,已有数据不受影响", async () => {
    const task = createTaskList<number>({ ordered: false, resolveCount: 2 });
    task.pushResolve(1);
    task.pushResolve(2);
    expect(() => {
      task.pushResolve(3);
    }).toThrow(RangeError);
    expect((await task.request()).list).toEqual([1, 2]);
  });

  it("TaskList:超限后重复 request,每次都返回 reject 且不改变状态", async () => {
    const task = createTaskList<number>({ taskCount: 1 });
    const first = task.request();
    for (let i = 0; i < 3; i++) {
      await expect(task.request()).rejects.toBeInstanceOf(RangeError);
    }
    expect(task.getStatus().requestCount).toBe(1);
    task.pushResolve(1);
    expect((await first).list).toEqual([1]);
  });
});
