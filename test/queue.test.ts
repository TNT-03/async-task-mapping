import { describe, expect, it } from "vitest";
import { Queue } from "../src/taskOrder/queue";

describe("Queue", () => {
  it("先进先出", () => {
    const queue = new Queue<number>();
    queue.push(1);
    queue.push(2);
    expect(queue.size).toBe(2);
    expect(queue.shift()?.value).toBe(1);
    expect(queue.shift()?.value).toBe(2);
    expect(queue.shift()).toBeNull();
    expect(queue.size).toBe(0);
  });

  it("可以按节点移除队首、队中、队尾,且只能移除一次", () => {
    const queue = new Queue<string>();
    const a = queue.push("a");
    const b = queue.push("b");
    const c = queue.push("c");
    expect(queue.remove(b)).toBe(true);
    expect(queue.remove(b)).toBe(false);
    expect(queue.remove(a)).toBe(true);
    expect(queue.remove(c)).toBe(true);
    expect(queue.size).toBe(0);
    expect(queue.shift()).toBeNull();

    queue.push("d");
    expect(queue.drain()).toEqual(["d"]);
  });

  it("不能移除属于其他队列的节点,出队后的节点不再引用队列", () => {
    const first = new Queue<number>();
    const second = new Queue<number>();
    const node = first.push(1);
    expect(second.remove(node)).toBe(false);
    first.shift();
    expect(node.owner).toBeNull();
    expect(node.prev).toBeNull();
    expect(node.next).toBeNull();
  });

  it("drain 按入队顺序返回所有值并清空队列", () => {
    const queue = new Queue<number>();
    [1, 2, 3].forEach((value) => queue.push(value));
    expect(queue.drain()).toEqual([1, 2, 3]);
    expect(queue.size).toBe(0);
  });
});
