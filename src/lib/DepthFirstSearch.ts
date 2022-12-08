import { Stack } from './Stack'

type InitFunc<T extends object> = (dfs: DepthFirstSearch<T>) => void
type VisitFunc<T extends object> = (dfs: DepthFirstSearch<T>, data: T) => void
type CompleteFunc<T extends object> = (dfs: DepthFirstSearch<T>, data: T) => void

export class DepthFirstSearch<T extends object> {
  private stack: Stack<T> = new Stack()
  private discovered: WeakSet<T> = new WeakSet()
  private visited: WeakSet<T> = new WeakSet()
  private completed: WeakSet<T> = new WeakSet()

  constructor(
    private init_func: InitFunc<T>, 
    private visit_func?: VisitFunc<T>, 
    private complete_func?: CompleteFunc<T>,
  ) { }

  run() {
    this.reset()
    this.init_func(this)

    while(this.stack.getSize() > 0) {
      const data = this.stack.peek()

      if(!this.getVisited(data)) {
        this.visit_func?.(this, data)
      } else {
        this.complete_func?.(this, data)
        this.setCompleted(data, true)
        this.stack.pop()
      }
    }
  }

  reset() {
    this.discovered = new WeakSet()
    this.visited = new WeakSet()
    this.completed = new WeakSet()
    this.stack = new Stack()
  }

  setDiscovered(data: T, discovered: boolean = false) {
    if(discovered) {
      this.discovered.add(data)
    } else {
      this.discovered.delete(data)
    }
  }

  getDiscovered(data: T) {
    return this.discovered.has(data)
  }

  setVisited(data: T, visited: boolean = false) {
    if(visited) {
      this.visited.add(data)
    } else {
      this.visited.delete(data)
    }
  }

  getVisited(data: T) {
    return this.visited.has(data)
  }

  setCompleted(data: T, completed: boolean = false) {
    if(completed) {
      this.completed.add(data)
    } else {
      this.completed.delete(data)
    }
  }

  getCompleted(data: T) {
    return this.completed.has(data)
  }

  push(...data: T[]) {
    this.stack.push(...data)
  }
}
