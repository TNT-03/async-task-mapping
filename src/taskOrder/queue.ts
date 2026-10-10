export interface QueueNode<V> {
  readonly value: V;
  prev: QueueNode<V> | null;
  next: QueueNode<V> | null;
  /** 节点出队后置空,便于判断是否仍在队列中,也让节点可以被回收 */
  owner: Queue<V> | null;
}

/** 双向链表队列:O(1) 入队、出队、按节点移除 */
export class Queue<V> {
  #head: QueueNode<V> | null = null;
  #tail: QueueNode<V> | null = null;
  #size = 0;

  get size(): number {
    return this.#size;
  }

  push(value: V): QueueNode<V> {
    const node: QueueNode<V> = {
      value,
      prev: this.#tail,
      next: null,
      owner: this,
    };
    if (this.#tail) {
      this.#tail.next = node;
    } else {
      this.#head = node;
    }
    this.#tail = node;
    this.#size++;
    return node;
  }

  /** 取出队首节点,队列为空时返回 null(value 本身可以是 undefined,所以返回节点) */
  shift(): QueueNode<V> | null {
    const node = this.#head;
    if (node) {
      this.remove(node);
    }
    return node;
  }

  /** 从队列中移除指定节点,节点不在本队列中时返回 false */
  remove(node: QueueNode<V>): boolean {
    if (node.owner !== this) {
      return false;
    }
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.#head = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.#tail = node.prev;
    }
    node.prev = null;
    node.next = null;
    node.owner = null;
    this.#size--;
    return true;
  }

  /** 清空队列并按入队顺序返回所有值 */
  drain(): V[] {
    const values: V[] = [];
    let node = this.shift();
    while (node) {
      values.push(node.value);
      node = this.shift();
    }
    return values;
  }
}
