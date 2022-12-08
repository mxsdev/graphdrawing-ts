import { removeEl } from "./Types"

export class OrderedSet<T> implements Omit<Set<T>, 'entries'|'add'> {
  private set: Set<T>
  private array: Array<T>

  constructor(...params: T[]) {
    this.set = new Set(params)
    this.array = params
  }

  at(index: number): T|undefined {
    return this.array[index]
  }

  getArray(): T[] {
    return this.array
  }

  add(value: T): this {
    this.array.push(value)
    this.set.add(value)

    return this
  }
  clear(): void {
    this.set.clear()
    this.array = []
  }
  delete(value: T): boolean {
    removeEl(this.array, value)
    return this.set.delete(value)
  }
  forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: any): void {
    this.set.forEach(callbackfn, thisArg)
  }
  has(value: T): boolean {
    return this.set.has(value)
  }
  entries(): IterableIterator<[number, T]> {
    return this.array.entries()
  }
  *keys() {
    yield* this.array
  }
  *values() {
    yield *this.array
  }
  *[Symbol.iterator](): IterableIterator<T> {
    yield *this.array
  }

  get size() {
    return this.set.size
  }

  get [Symbol.toStringTag]() {
    return this.set[Symbol.toStringTag]
  }

  sort(compareFn?: (a: T, b: T) => number) {
    this.array.sort(compareFn)

    return this
  }
}
