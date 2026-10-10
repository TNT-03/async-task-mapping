import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TaskClearedError,
  TaskTimeoutError,
  createTaskOrder,
} from "../src/index";
import { isSettled } from "./helpers";

afterEach(() => {
  vi.useRealTimers();
});

describe("createTaskOrder 基础配对", () => {
  it("request 与 pushResolve 按先后顺序一一配对", async () => {
    const order = createTaskOrder<string>();
    const first = order.request();
    const second = order.request();
    order.pushResolve("res1");
    order.pushResolve("res2");
    expect(await first).toBe("res1");
    expect(await second).toBe("res2");
  });

  it("可以先 pushResolve 再 request,数据先到先配", async () => {
    const order = createTaskOrder<number>();
    order.pushResolve(1);
    order.pushResolve(2);
    expect(await order.request()).toBe(1);
    expect(await order.request()).toBe(2);
  });

  it("直接 await / then / catch / finally 各消耗一次 request", async () => {
    const order = createTaskOrder<number>();
    const viaThen = order.then((value) => value * 10);
    const viaCatch = order.catch(() => -1);
    const onFinally = vi.fn();
    const viaFinally = order.finally(onFinally);
    order.pushResolve(1);
    order.pushResolve(2);
    order.pushResolve(3);
    expect(await viaThen).toBe(10);
    expect(await viaCatch).toBe(2);
    expect(await viaFinally).toBe(3);
    expect(onFinally).toHaveBeenCalledTimes(1);
  });

  it("getStatus 返回正确的待匹配数量", () => {
    const order = createTaskOrder<number>();
    expect(order.getStatus()).toEqual({
      pendingRequests: 0,
      pendingResolve: 0,
    });
    void order.request();
    void order.request();
    expect(order.getStatus()).toEqual({
      pendingRequests: 2,
      pendingResolve: 0,
    });
    order.pushResolve(1);
    expect(order.getStatus()).toEqual({
      pendingRequests: 1,
      pendingResolve: 0,
    });
    order.pushResolve(2);
    order.pushResolve(3);
    order.pushResolve(4);
    expect(order.getStatus()).toEqual({
      pendingRequests: 0,
      pendingResolve: 2,
    });
  });

  it("getLastCompletedTask 初始为 null,之后是最近一次匹配到的数据", async () => {
    const order = createTaskOrder<string>();
    expect(order.getLastCompletedTask()).toBeNull();
    const pending = order.request();
    order.pushResolve("a");
    await pending;
    expect(order.getLastCompletedTask()).toBe("a");
    order.pushResolve("b");
    expect(order.getLastCompletedTask()).toBe("a");
    await order.request();
    expect(order.getLastCompletedTask()).toBe("b");
  });

  it("undefined 也是合法数据", async () => {
    const order = createTaskOrder<undefined>();
    order.pushResolve(undefined);
    await expect(order.request()).resolves.toBeUndefined();
  });
});

describe("createTaskOrder 失败路径", () => {
  it("pushReject 与队首 request 配对并 reject,不影响后面的 request", async () => {
    const order = createTaskOrder<string>();
    const first = expect(order.request()).rejects.toThrow("bad");
    const second = order.request();
    order.pushReject(new Error("bad"));
    order.pushResolve("ok");
    await first;
    expect(await second).toBe("ok");
    expect(order.getLastCompletedTask()).toBe("ok");
  });

  it("先 pushReject 再 request,在 request 时 reject", async () => {
    const order = createTaskOrder<string>();
    order.pushReject(new Error("early"));
    await expect(order.request()).rejects.toThrow("early");
  });

  it("timeout:每个 request 单独计时,超时后出队且不占用后续数据", async () => {
    vi.useFakeTimers();
    const order = createTaskOrder<string>({ timeout: 100 });
    const timedOut = expect(order.request()).rejects.toBeInstanceOf(
      TaskTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(100);
    await timedOut;
    expect(order.getStatus().pendingRequests).toBe(0);

    const next = order.request();
    order.pushResolve("fresh");
    expect(await next).toBe("fresh");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("timeout:匹配成功后取消定时器", async () => {
    vi.useFakeTimers();
    const order = createTaskOrder<number>({ timeout: 100 });
    const pending = order.request();
    expect(vi.getTimerCount()).toBe(1);
    order.pushResolve(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(await pending).toBe(1);
  });
});

describe("createTaskOrder paused / running", () => {
  it("paused 期间积压的数据,running 后会一次性全部配对", async () => {
    const order = createTaskOrder<number>();
    order.paused();
    const first = order.request();
    const requests = [first, order.request(), order.request()];
    order.pushResolve(1);
    order.pushResolve(2);
    order.pushResolve(3);
    expect(await isSettled(first)).toBe(false);
    expect(order.getStatus()).toEqual({
      pendingRequests: 3,
      pendingResolve: 3,
    });

    order.running();
    expect(await Promise.all(requests)).toEqual([1, 2, 3]);
  });

  it("重复 paused / running 是幂等的", async () => {
    const order = createTaskOrder<number>();
    order.running();
    order.paused();
    order.paused();
    const pending = order.request();
    order.pushResolve(1);
    order.running();
    order.running();
    expect(await pending).toBe(1);
  });
});

describe("createTaskOrder clear / signal", () => {
  it("clear 让 pending 的 request 以 TaskClearedError reject,并丢弃未配对的数据", async () => {
    const order = createTaskOrder<number>();
    const pending = expect(order.request()).rejects.toBeInstanceOf(
      TaskClearedError,
    );
    order.clear();
    await pending;

    order.pushResolve(1);
    order.clear();
    expect(order.getStatus()).toEqual({
      pendingRequests: 0,
      pendingResolve: 0,
    });
  });

  it("重复 clear 不会报错,clear 不重置 getLastCompletedTask", async () => {
    const order = createTaskOrder<number>();
    order.pushResolve(1);
    await order.request();
    order.clear();
    order.clear();
    expect(order.getLastCompletedTask()).toBe(1);
  });

  it("abort 让 pending 的 request 以 signal.reason reject,实例此后失效", async () => {
    const controller = new AbortController();
    const order = createTaskOrder<number>({ signal: controller.signal });
    const reason = new Error("stop");
    const pending = expect(order.request()).rejects.toBe(reason);
    controller.abort(reason);
    await pending;

    await expect(order.request()).rejects.toBe(reason);
    // abort 后 push 被静默忽略:不抛错、不入队
    expect(() => {
      order.pushResolve(1);
    }).not.toThrow();
    expect(() => {
      order.pushReject(1);
    }).not.toThrow();
    expect(order.getStatus()).toEqual({
      pendingRequests: 0,
      pendingResolve: 0,
    });
    await expect(order.request()).rejects.toBe(reason);
  });
});
