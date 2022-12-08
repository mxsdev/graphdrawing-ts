import assert from "assert"
import { Node } from '../deprecated/Node'
import { denull, popEl } from "./Types"

let nodect = 0

class FibonacciHeapNode {
  id: number = nodect++

  children: FibonacciHeapNode[] = []
  marked: boolean = false

  root: FibonacciHeapNode
  parent: FibonacciHeapNode

  constructor(public value: number, root?: FibonacciHeapNode, parent?: FibonacciHeapNode) {
    if(root) {
      assert(parent)
      this.root = root
      this.parent = parent
    } else {
      this.root = this
      this.parent = this
    }
  }

  addChild(value: number) {
    const child = new FibonacciHeapNode(value, this.root, this)
    this.children.push(child)
  }

  getDegree() {
    return this.children.length
  }

  setRoot(root: FibonacciHeapNode) {
    this.root = root

    if (root === this) {
      this.parent = root
    }

    if (this.children.length > 0) {
      for (const child of this.children) {
        child.root = root
      }
    }
  }

  isRoot() {
    return this.root === this
  }
}

class FibonacciHeap {
  trees: FibonacciHeapNode[] = []
  minimum?: FibonacciHeapNode

  constructor() { }

  insert(value: number) {
    const node = new FibonacciHeapNode(value)
    const heap = new FibonacciHeap()
    heap.trees.push(node)
    this.merge(heap)
    return node
  }

  merge(other: FibonacciHeap) {
    for(const tree of other.trees) {
      this.trees.push(tree)
    }
    this.updateMinimum()
  }

  extractMinimum() {
    if(this.minimum) {

      // TODO: ensure that table.remove modifies the original array, and doesnt make copy
      const minimum = popEl(this.trees, this.minimum)
      assert(minimum)

      for(const child of minimum.children) {
        child.root = child
        this.trees.push(child)
      }

      let same_degrees_found = true
      while (same_degrees_found) {
        same_degrees_found = false

        const degrees = new Map<number, FibonacciHeapNode>()

        for(const root of this.trees) {
          const degree = root.getDegree()

          const deg_node = degrees.get(degree)

          if(deg_node) {
            if(root.value < deg_node.value) {
              this.linkRoots(root, deg_node)
            } else {
              this.linkRoots(deg_node, root)
            }

            degrees.delete(degree)
            same_degrees_found = true
            break
          } else {
            degrees.set(degree, root)
          }
        } 
      }

      this.updateMinimum()

      return minimum
    }
  }

  updateValue(node: FibonacciHeapNode, value: number) {
    const old_value = node.value
    const new_value = value

    if(new_value <= old_value) {
      this.decreaseValue(node, value)
    } else {
      assert(false, 'FibonacciHeap.increaseValue is not implemented yet')
    }
  }

  decreaseValue(node: FibonacciHeapNode, value: number) {
    assert(value <= node.value)

    node.value = value

    if (node.value < node.parent.value) {
      const parent = node.parent
      this.cutFromParent(node)

      if(!parent.isRoot()) {
        if(parent.marked) {
          this.cutFromParent(parent)
        } else {
          parent.marked = true
        }
      }
    }

    assert(this.minimum)
    if(node.value < this.minimum.value) {
      this.minimum = node
    }
  }

  delete(node: FibonacciHeapNode) {
    this.decreaseValue(node, Number.NEGATIVE_INFINITY)
    this.extractMinimum()
  }

  updateMinimum() {
    this.minimum = this.trees[0]

    for(const root of this.trees) {
      if(root.value < this.minimum.value) {
        this.minimum = root
      }
    }
  }

  linkRoots(root: FibonacciHeapNode, child: FibonacciHeapNode) {
    child.root = root
    child.parent = root

    child = popEl(this.trees, child)
    assert(child)
    root.children.push(child)

    return root
  } 

  cutFromParent(node: FibonacciHeapNode) {
    const parent = node.parent

    node.root = node
    node.parent = node
    node.marked = false

    node = popEl(parent.children, node)
    assert(node)
    this.trees.push(node)
  }
}

export class PriorityQueue<Value extends object> {
  heap: FibonacciHeap = new FibonacciHeap()
  nodes = new WeakMap<Value, FibonacciHeapNode>()
  values = new WeakMap<FibonacciHeapNode, Value>()

  enqueue(value: Value, priority: number) {
    const node = this.heap.insert(priority)
    this.nodes.set(value, node)
    this.values.set(node, value)
  }

  dequeue() {
    const node = this.heap.extractMinimum()

    if(node) {
      const value = denull(this.values.get(node))
      this.nodes.delete(value)
      this.values.delete(node)
      return value
    } else {
      return null
    }
  }

  updatePriority(value: Value, priority: number) {
    const node = this.nodes.get(value)
    assert(node, `updating the priority of ${value.toString()} failed because it is not in the priority queue`)
    this.heap.updateValue(node, priority)
  }

  isEmpty() {
    return this.heap.trees.length === 0
  }
}
