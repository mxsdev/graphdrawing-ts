export class Stack<T> {
  private data: T[] = []

  push(...data: T[]) {
    this.data.push(...data)
  }

  peek() {
    return this.data[this.data.length - 1]
  }

  pop() {
    return this.data.pop()
  }

  getSize() {
    return this.data.length
  }
}
