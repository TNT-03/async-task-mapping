import { describe, expect, it, vi } from "vitest";
import { createStepTask } from "../src/index";
import { deferred } from "./helpers";

describe("createStepTask", () => {
  it("并发数不会超过 limit,且所有任务都会执行", async () => {
    let running = 0;
    let maxRunning = 0;
    const gates = Array.from({ length: 6 }, () => deferred<number>());
    const tasks = gates.map((gate, index) => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      const value = await gate.promise;
      running--;
      return value + index;
    });

    const result = createStepTask(tasks, { limit: 2 });
    await Promise.resolve();
    expect(running).toBe(2);

    // 乱序完成,结果依旧按下标排列
    for (const index of [1, 0, 3, 2, 5, 4]) {
      gates[index]?.resolve(100);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    const settled = await result;
    expect(maxRunning).toBe(2);
    expect(settled).toEqual(
      [100, 101, 102, 103, 104, 105].map((value) => ({
        status: "fulfilled",
        value,
      })),
    );
  });

  it("成功与失败都记录在 settled 数组里,同步抛错记为 rejected", async () => {
    const failure = new Error("async fail");
    const settled = await createStepTask<number>(
      [
        () => 1,
        () => Promise.reject(failure),
        () => {
          throw new Error("sync fail");
        },
        () => Promise.resolve(4),
      ],
      { limit: 3 },
    );
    expect(settled[0]).toEqual({ status: "fulfilled", value: 1 });
    expect(settled[1]).toEqual({ status: "rejected", reason: failure });
    expect(settled[2]).toMatchObject({ status: "rejected" });
    expect((settled[2] as PromiseRejectedResult).reason).toBeInstanceOf(Error);
    expect(settled[3]).toEqual({ status: "fulfilled", value: 4 });
  });

  it("limit 大于任务数时全部并行", async () => {
    const settled = await createStepTask([() => 1, () => 2], { limit: 10 });
    expect(settled.map((item) => item.status)).toEqual([
      "fulfilled",
      "fulfilled",
    ]);
  });

  it("任务列表为空时立即完成并触发 onComplete", async () => {
    const onComplete = vi.fn();
    await expect(createStepTask([], { limit: 1, onComplete })).resolves.toEqual(
      [],
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("onComplete 在 resolve 前只调用一次,并拿到完整结果", async () => {
    const onComplete = vi.fn();
    const settled = await createStepTask([() => 1, () => 2], {
      limit: 1,
      onComplete,
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(settled);
  });

  it("onComplete 抛错会让返回的 Promise reject", async () => {
    await expect(
      createStepTask([() => 1], {
        limit: 1,
        onComplete: () => {
          throw new Error("callback failed");
        },
      }),
    ).rejects.toThrow("callback failed");
  });

  it("任务列表为空且 onComplete 抛错时,返回的 Promise 同样 reject", async () => {
    await expect(
      createStepTask([], {
        limit: 1,
        onComplete: () => {
          throw new Error("empty callback failed");
        },
      }),
    ).rejects.toThrow("empty callback failed");
  });

  it("不会修改传入的任务数组", async () => {
    const tasks = [() => 1, () => 2];
    await createStepTask(tasks, { limit: 1 });
    expect(tasks).toHaveLength(2);
  });

  it("limit 非法时同步抛错", () => {
    expect(() => createStepTask([], { limit: 0 })).toThrow(RangeError);
    expect(() => createStepTask([], { limit: 1.5 })).toThrow(RangeError);
    expect(() =>
      createStepTask([], { limit: "2" as unknown as number }),
    ).toThrow(TypeError);
    expect(() =>
      createStepTask("nope" as unknown as (() => number)[], { limit: 1 }),
    ).toThrow(TypeError);
  });

  it("abort 后不再启动新任务,返回的 Promise 以 signal.reason reject", async () => {
    const controller = new AbortController();
    const started: number[] = [];
    const gate = deferred<number>();
    const tasks = [0, 1, 2].map((index) => () => {
      started.push(index);
      return gate.promise;
    });
    const reason = new Error("stop");
    const result = expect(
      createStepTask(tasks, { limit: 1, signal: controller.signal }),
    ).rejects.toBe(reason);
    controller.abort(reason);
    await result;

    gate.resolve(1);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(started).toEqual([0]);
  });

  it("任务会收到 options.signal,abort 时运行中的任务能感知到取消", async () => {
    const controller = new AbortController();
    const received: AbortSignal[] = [];
    const gate = deferred<number>();
    const reason = new Error("stop");
    const result = expect(
      createStepTask(
        [
          (signal) => {
            received.push(signal);
            return gate.promise;
          },
        ],
        { limit: 1, signal: controller.signal },
      ),
    ).rejects.toBe(reason);
    expect(received[0]).toBe(controller.signal);
    expect(received[0]?.aborted).toBe(false);
    controller.abort(reason);
    await result;
    expect(received[0]?.aborted).toBe(true);
    gate.resolve(1);
  });

  it("没有传入 signal 时,任务收到的是一个永不 abort 的 AbortSignal", async () => {
    const received: AbortSignal[] = [];
    await createStepTask(
      [
        (signal) => {
          received.push(signal);
          return 1;
        },
      ],
      { limit: 1 },
    );
    expect(received[0]).toBeInstanceOf(AbortSignal);
    expect(received[0]?.aborted).toBe(false);
  });

  it("signal 已 aborted 时不会启动任何任务", async () => {
    const task = vi.fn(() => 1);
    const reason = new Error("already");
    await expect(
      createStepTask([task], { limit: 1, signal: AbortSignal.abort(reason) }),
    ).rejects.toBe(reason);
    expect(task).not.toHaveBeenCalled();
  });
});
