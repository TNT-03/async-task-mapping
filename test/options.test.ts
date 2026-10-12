import { describe, expect, it } from "vitest";
import { createTaskList, createTaskOrder } from "../src/index";

/** 模拟 JS 调用方传入类型不符的值 */
const bad = (value: unknown): never => value as never;

describe("createTaskList 入参校验", () => {
  it("不传参数、传 undefined 都使用默认值 1", () => {
    expect(() => createTaskList()).not.toThrow();
    expect(() =>
      createTaskList({ taskCount: undefined, resolveCount: undefined }),
    ).not.toThrow();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "taskCount / resolveCount 为 %s 时抛 RangeError",
    (value) => {
      expect(() => createTaskList({ taskCount: value })).toThrow(RangeError);
      expect(() => createTaskList({ resolveCount: value })).toThrow(RangeError);
    },
  );

  it.each([["2"], [null], [true], [{}]])(
    "taskCount / resolveCount 为非数字 %j 时抛 TypeError",
    (value) => {
      expect(() => createTaskList({ taskCount: bad(value) })).toThrow(
        TypeError,
      );
      expect(() => createTaskList({ resolveCount: bad(value) })).toThrow(
        TypeError,
      );
    },
  );

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
    "timeout 为 %s 时抛 RangeError",
    (value) => {
      expect(() => createTaskList({ timeout: value })).toThrow(RangeError);
      expect(() => createTaskOrder({ timeout: value })).toThrow(RangeError);
    },
  );

  it("timeout 等于 setTimeout 上限时允许创建", () => {
    expect(() => createTaskList({ timeout: 2_147_483_647 })).not.toThrow();
    expect(() => createTaskOrder({ timeout: 2_147_483_647 })).not.toThrow();
  });

  it("超过上限的小数同样抛 RangeError,小于 1 的小数毫秒允许创建", () => {
    expect(() => createTaskList({ timeout: 2_147_483_647.5 })).toThrow(
      RangeError,
    );
    expect(() => createTaskOrder({ timeout: 2_147_483_647.5 })).toThrow(
      RangeError,
    );
    expect(() => createTaskList({ timeout: 0.5 })).not.toThrow();
    expect(() => createTaskOrder({ timeout: 0.5 })).not.toThrow();
  });

  it("timeout / signal 类型不对时抛 TypeError", () => {
    expect(() => createTaskList({ timeout: bad("10") })).toThrow(TypeError);
    expect(() => createTaskList({ signal: bad({}) })).toThrow(TypeError);
    expect(() => createTaskOrder({ signal: bad(null) })).toThrow(TypeError);
  });
});
