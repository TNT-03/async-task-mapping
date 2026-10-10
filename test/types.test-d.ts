import { assertType, describe, expectTypeOf, it } from "vitest";
import {
  TaskClearedError,
  TaskTimeoutError,
  createStepTask,
  createTaskList,
  createTaskOrder,
} from "../src/index";
import type {
  StepTaskOptions,
  TaskList,
  TaskListOptions,
  TaskListResult,
  TaskListStatus,
  TaskOrder,
  TaskOrderOptions,
  TaskOrderStatus,
} from "../src/index";

describe("createTaskList 类型", () => {
  it("泛型贯穿 pushResolve、request 与 await 结果", async () => {
    const task = createTaskList<number>();
    expectTypeOf(task).toEqualTypeOf<TaskList<number>>();
    expectTypeOf(task.pushResolve).parameter(0).toEqualTypeOf<number>();
    expectTypeOf(task.pushResolve)
      .parameter(1)
      .toEqualTypeOf<string | undefined>();
    expectTypeOf(task.request()).resolves.toEqualTypeOf<
      TaskListResult<number>
    >();
    expectTypeOf(await task).toEqualTypeOf<TaskListResult<number>>();
    expectTypeOf(task).toExtend<PromiseLike<TaskListResult<number>>>();
    expectTypeOf(task.getStatus()).toEqualTypeOf<TaskListStatus>();
    expectTypeOf<TaskListResult<number>["list"]>().toEqualTypeOf<
      readonly number[]
    >();
    expectTypeOf<TaskListResult<number>["dataMap"]>().toEqualTypeOf<
      Readonly<Record<string, number>>
    >();
  });

  it("不指定泛型时数据类型为 unknown", () => {
    expectTypeOf(createTaskList()).toEqualTypeOf<TaskList<unknown>>();
  });

  it("then / catch / finally 的返回类型", () => {
    const task = createTaskList<string>();
    expectTypeOf(task.then((result) => result.list.length)).toEqualTypeOf<
      Promise<number>
    >();
    expectTypeOf(task.catch(() => 0)).toEqualTypeOf<
      Promise<TaskListResult<string> | number>
    >();
    expectTypeOf(task.finally()).toEqualTypeOf<
      Promise<TaskListResult<string>>
    >();
  });

  it("错误用法会产生类型错误", () => {
    const task = createTaskList<number>();
    // @ts-expect-error 数据必须是 number 类型
    task.pushResolve("text");
    // @ts-expect-error name 必须是 string 类型
    task.pushResolve(1, 2);
    // @ts-expect-error taskCount 必须是 number 类型
    createTaskList({ taskCount: "2" });
    // @ts-expect-error 不存在的选项名会报错
    createTaskList({ unknown: true });
    // @ts-expect-error signal 必须是 AbortSignal 类型
    createTaskList({ signal: {} });
    assertType<TaskListOptions>({ ordered: false, taskCount: 2, timeout: 100 });
  });
});

describe("createTaskOrder 类型", () => {
  it("泛型贯穿 pushResolve、request 与 getLastCompletedTask", async () => {
    const order = createTaskOrder<string>();
    expectTypeOf(order).toEqualTypeOf<TaskOrder<string>>();
    expectTypeOf(order.pushResolve).parameters.toEqualTypeOf<[data: string]>();
    expectTypeOf(order.request()).resolves.toEqualTypeOf<string>();
    expectTypeOf(await order).toEqualTypeOf<string>();
    expectTypeOf(order.getLastCompletedTask()).toEqualTypeOf<string | null>();
    expectTypeOf(order.getStatus()).toEqualTypeOf<TaskOrderStatus>();
    expectTypeOf<TaskOrderStatus>().toEqualTypeOf<{
      pendingRequests: number;
      pendingResolve: number;
    }>();
  });

  it("错误用法会产生类型错误", () => {
    const order = createTaskOrder<string>();
    // @ts-expect-error 数据必须是 string 类型
    order.pushResolve(1);
    // @ts-expect-error timeout 必须是 number 类型
    createTaskOrder({ timeout: "100" });
    assertType<TaskOrderOptions>({ timeout: 100 });
  });
});

describe("createStepTask 类型", () => {
  it("从任务返回值推导结果类型", () => {
    const result = createStepTask([() => Promise.resolve(1), () => 2], {
      limit: 2,
    });
    expectTypeOf(result).toEqualTypeOf<
      Promise<PromiseSettledResult<number>[]>
    >();
  });

  it("onComplete 的参数与结果类型一致", () => {
    void createStepTask([() => "a"], {
      limit: 1,
      onComplete: (settled) => {
        expectTypeOf(settled).toEqualTypeOf<PromiseSettledResult<string>[]>();
      },
    });
    assertType<StepTaskOptions<string>>({ limit: 1 });
    // @ts-expect-error limit 是必填项
    assertType<StepTaskOptions<string>>({});
  });
});

describe("错误类型", () => {
  it("自定义错误继承自 Error", () => {
    expectTypeOf<TaskClearedError>().toExtend<Error>();
    expectTypeOf<TaskTimeoutError>().toExtend<Error>();
    expectTypeOf<
      TaskClearedError["name"]
    >().toEqualTypeOf<"TaskClearedError">();
  });
});
