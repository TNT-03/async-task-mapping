import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TaskClearedError,
  TaskTimeoutError,
  createTaskList,
} from "../src/index";
import { isSettled } from "./helpers";

afterEach(() => {
  vi.useRealTimers();
});

describe("createTaskList 有序列表", () => {
  it("默认就是有序:request 未绑定完时 pushResolve 会抛错", () => {
    const task = createTaskList<string>();
    expect(() => {
      task.pushResolve("a");
    }).toThrow("bind the request");
  });

  it("绑定完所有 request 后 pushResolve,所有 request 拿到同一份 { list, dataMap }", async () => {
    const task = createTaskList<string>({ taskCount: 2, resolveCount: 2 });
    const first = task.request();
    const second = task.request();
    task.pushResolve("res1");
    task.pushResolve("res2", "second");

    const result = await first;
    expect(result).toEqual({
      list: ["res1", "res2"],
      dataMap: { second: "res2" },
    });
    expect(await second).toBe(result);
  });

  it("支持直接 await / then / catch / finally,每次调用消耗一个 request 名额", async () => {
    const task = createTaskList<string>({ taskCount: 3, resolveCount: 1 });
    const viaThen = task.then(({ list }) => list[0]);
    const viaCatch = task.catch(() => "never");
    const viaAwait = (async () => (await task).list[0])();
    expect(task.getStatus().requestCount).toBe(2);
    await Promise.resolve();
    expect(task.getStatus().requestCount).toBe(3);
    task.pushResolve("x");

    expect(await viaThen).toBe("x");
    expect(await viaCatch).toEqual({ list: ["x"], dataMap: {} });
    expect(await viaAwait).toBe("x");
  });

  it("finally 回调会被调用并透传结果", async () => {
    const task = createTaskList<number>();
    const onFinally = vi.fn();
    const done = task.finally(onFinally);
    task.pushResolve(1);
    expect((await done).list).toEqual([1]);
    expect(onFinally).toHaveBeenCalledTimes(1);
  });

  it("request 超限时返回被 reject 的 RangeError,不输出 console", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const task = createTaskList<number>({ taskCount: 1 });
    const first = task.request();
    await expect(task.request()).rejects.toBeInstanceOf(RangeError);
    task.pushResolve(1);
    await first;
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("pushResolve 超过 resolveCount 抛 RangeError", () => {
    const task = createTaskList<number>({ resolveCount: 1 });
    void task.request();
    task.pushResolve(1);
    expect(() => {
      task.pushResolve(2);
    }).toThrow(RangeError);
  });

  it("一轮结束后再 request 会开启全新的一轮,旧结果不被污染", async () => {
    const task = createTaskList<string>();
    const firstRound = task.request();
    task.pushResolve("a", "k1");
    const first = await firstRound;

    const secondRound = task.request();
    task.pushResolve("b", "k2");
    const second = await secondRound;

    expect(first).toEqual({ list: ["a"], dataMap: { k1: "a" } });
    expect(second).toEqual({ list: ["b"], dataMap: { k2: "b" } });
  });

  it("getStatus 反映 request / pushResolve 的进度", () => {
    const task = createTaskList<number>({ taskCount: 2, resolveCount: 2 });
    expect(task.getStatus()).toEqual({
      requestDone: false,
      responseDone: false,
      requestCount: 0,
      responseCount: 0,
    });
    void task.request();
    void task.request();
    task.pushResolve(1);
    expect(task.getStatus()).toEqual({
      requestDone: true,
      responseDone: false,
      requestCount: 2,
      responseCount: 1,
    });
  });
});

describe("createTaskList 无序列表", () => {
  it("可以先 pushResolve 再 request", async () => {
    const task = createTaskList<number>({ ordered: false, resolveCount: 2 });
    task.pushResolve(1);
    task.pushResolve(2, "two");
    expect(await task.request()).toEqual({ list: [1, 2], dataMap: { two: 2 } });
  });

  it("fulfilled 之后再 request,返回与 pending 路径一致的 { list, dataMap }", async () => {
    const task = createTaskList<number>({ ordered: false, taskCount: 2 });
    const early = task.request();
    task.pushResolve(7, "seven");
    const late = task.request();
    const expected = { list: [7], dataMap: { seven: 7 } };
    expect(await early).toEqual(expected);
    expect(await late).toEqual(expected);
  });

  it("taskCount 个名额都用完后,下一次 request 开启新一轮而不是复用旧结果", async () => {
    const task = createTaskList<number>({ ordered: false, taskCount: 2 });
    void task.request();
    task.pushResolve(1);
    await task.request();

    const nextRound = task.request();
    expect(await isSettled(nextRound)).toBe(false);
    task.pushResolve(2);
    expect((await nextRound).list).toEqual([2]);
  });

  it("同名 key 后者覆盖前者", async () => {
    const task = createTaskList<string>({ ordered: false, resolveCount: 2 });
    task.pushResolve("old", "k");
    task.pushResolve("new", "k");
    const { list, dataMap } = await task.request();
    expect(list).toEqual(["old", "new"]);
    expect(dataMap).toEqual({ k: "new" });
  });

  it("__proto__ 作为 key 只是普通数据,不会污染原型", async () => {
    const task = createTaskList<number>({ ordered: false });
    task.pushResolve(1, "__proto__");
    const { dataMap } = await task.request();
    expect(Object.getPrototypeOf(dataMap)).toBe(Object.prototype);
    expect(Object.keys(dataMap)).toEqual(["__proto__"]);
  });
});

describe("createTaskList 失败路径", () => {
  it("pushReject 让本轮所有 pending 的 request 以同一原因 reject", async () => {
    const task = createTaskList<number>({ taskCount: 2, resolveCount: 2 });
    const reason = new Error("boom");
    const first = expect(task.request()).rejects.toBe(reason);
    const second = expect(task.request()).rejects.toBe(reason);
    task.pushReject(reason);
    await first;
    await second;
  });

  it("本轮 rejected 后再 pushResolve / pushReject 抛错,后续 request 同样 reject", async () => {
    const task = createTaskList<number>({ ordered: false, taskCount: 2 });
    const reason = new Error("boom");
    const first = expect(task.request()).rejects.toBe(reason);
    task.pushReject(reason);
    await first;
    expect(() => {
      task.pushResolve(1);
    }).toThrow("rejected");
    expect(() => {
      task.pushReject(new Error("again"));
    }).toThrow("rejected");
    await expect(task.request()).rejects.toBe(reason);
  });

  it("所有 request 名额用完后,下一次 request 开启新一轮", async () => {
    const task = createTaskList<number>();
    const failed = expect(task.request()).rejects.toThrow("boom");
    task.pushReject(new Error("boom"));
    await failed;

    const next = task.request();
    task.pushResolve(5);
    expect((await next).list).toEqual([5]);
  });

  it("timeout:首个 request 起计时,超时以 TaskTimeoutError reject", async () => {
    vi.useFakeTimers();
    const task = createTaskList<number>({ timeout: 100 });
    expect(vi.getTimerCount()).toBe(0);

    const pending = expect(task.request()).rejects.toBeInstanceOf(
      TaskTimeoutError,
    );
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("timeout:在时限内结算则取消定时器", async () => {
    vi.useFakeTimers();
    const task = createTaskList<number>({ timeout: 100 });
    const pending = task.request();
    task.pushResolve(1);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await pending).list).toEqual([1]);
  });

  it("timeout:没有人在等就不计时,数据先到时迟到的 request 立即拿到结果", async () => {
    vi.useFakeTimers();
    const task = createTaskList<number>({ ordered: false, timeout: 100 });
    task.pushResolve(1);
    expect(vi.getTimerCount()).toBe(0);

    // 超过 timeout 之后才 request:不会超时,直接拿到已就绪的结果
    await vi.advanceTimersByTimeAsync(1000);
    expect((await task.request()).list).toEqual([1]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("timeout:数据未凑齐时,从首个 request 起计时,超时后本轮 rejected", async () => {
    vi.useFakeTimers();
    const task = createTaskList<number>({
      ordered: false,
      resolveCount: 2,
      timeout: 100,
    });
    task.pushResolve(1);
    await vi.advanceTimersByTimeAsync(1000);

    const pending = expect(task.request()).rejects.toBeInstanceOf(
      TaskTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(() => {
      task.pushResolve(2);
    }).toThrow("rejected");
  });
});

describe("createTaskList paused / running", () => {
  it("paused 期间 pushResolve 只记录不分发,running 后统一结算", async () => {
    const task = createTaskList<number>({ ordered: false });
    const pending = task.request();
    task.paused();
    task.pushResolve(1);
    expect(await isSettled(pending)).toBe(false);
    task.running();
    expect((await pending).list).toEqual([1]);
  });

  it("paused 期间 pushReject 在 running 后才分发", async () => {
    const task = createTaskList<number>();
    const assertion = expect(task.request()).rejects.toThrow("late");
    task.paused();
    task.pushReject(new Error("late"));
    task.running();
    await assertion;
  });

  it("paused 期间已 pushReject,之后的 pushResolve 同样抛 rejected 错误,running 后 pending 的 request 以原因 reject", async () => {
    const task = createTaskList<number>({ ordered: false });
    const reason = new Error("late");
    const pending = expect(task.request()).rejects.toBe(reason);
    task.paused();
    task.pushReject(reason);
    expect(() => {
      task.pushResolve(1);
    }).toThrow("rejected");
    expect(() => {
      task.pushReject(new Error("again"));
    }).toThrow("rejected");
    expect(await isSettled(pending)).toBe(false);

    task.running();
    await pending;
  });

  it("重复 paused / running 是幂等的", async () => {
    const task = createTaskList<number>();
    const pending = task.request();
    task.running();
    task.paused();
    task.paused();
    task.pushResolve(1);
    task.running();
    task.running();
    expect((await pending).list).toEqual([1]);
  });
});

describe("createTaskList clear", () => {
  it("clear 让 pending 的 request 以 TaskClearedError reject,并重置本轮", async () => {
    const task = createTaskList<number>({ taskCount: 2 });
    const pending = expect(task.request()).rejects.toBeInstanceOf(
      TaskClearedError,
    );
    task.clear();
    await pending;
    expect(task.getStatus().requestCount).toBe(0);

    // clear 之后是全新的一轮,有序列表需要重新绑定完所有 request
    const next = [task.request(), task.request()];
    task.pushResolve(1);
    expect((await next[0])?.list).toEqual([1]);
  });

  it("重复 clear 不会报错", () => {
    const task = createTaskList<number>();
    task.clear();
    task.clear();
    expect(task.getStatus().requestCount).toBe(0);
  });

  it("clear 不影响已经结算的 request", async () => {
    const task = createTaskList<number>();
    const pending = task.request();
    task.pushResolve(1);
    task.clear();
    expect((await pending).list).toEqual([1]);
  });
});

describe("createTaskList signal", () => {
  it("abort 让 pending 的 request 以 signal.reason reject,实例此后失效", async () => {
    const controller = new AbortController();
    const task = createTaskList<number>({ signal: controller.signal });
    const reason = new Error("stop");
    const pending = expect(task.request()).rejects.toBe(reason);
    controller.abort(reason);
    await pending;

    await expect(task.request()).rejects.toBe(reason);
    // abort 后 push 被静默忽略:不抛错、不入队
    expect(() => {
      task.pushResolve(1);
    }).not.toThrow();
    expect(() => {
      task.pushReject(1);
    }).not.toThrow();
    expect(task.getStatus().responseCount).toBe(0);
    await expect(task.request()).rejects.toBe(reason);
  });

  it("创建时 signal 已经 aborted,实例直接失效", async () => {
    const reason = new Error("already");
    const task = createTaskList<number>({ signal: AbortSignal.abort(reason) });
    await expect(task.request()).rejects.toBe(reason);
  });
});
