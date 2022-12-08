import { removeEl } from './Types'

export class OrderedMap<K extends object, V> {
  private _values: V[]
  private _map: WeakMap<K, V>

  constructor(iterator?: ConstructorParameters<typeof WeakMap<K, V>>[0]) {
    this._map = new WeakMap()
    this._values = []

    if (iterator) {
      for (const [k, v] of iterator) {
        this.set(k, v)
      }
    }
  }

  get(key: K) {
    return this._map.get(key)
  }

  remove(key: K) {
    const val = this._map.get(key)

    if (val === undefined) return

    removeEl(this._values, val)
    this._map.delete(key)
  }

  *[Symbol.iterator]() {
    yield* this._values
  }

  // keys() {
  //   return this._map.keys()
  // }

  at(index: number) {
    return this._values[index]
  }

  values() {
    return this._values
  }

  _setValue(i: number, value: V) {
    this._values[i] = value
  }   

  set(key: K, value: V) {
    const curr = this._map.get(key)

    if(curr === value) return

    if(curr) {
      const idx = removeEl(this._values, curr)
      this._values.splice(idx, 0, value)
    } else {
      this._values.push(value)
    }

    this._map.set(key, value)
  }

  sort(compareFn: (a: V, b: V) => number) {
    this._values.sort(compareFn)
  }

  get length() {
    return this._values.length
  }
}
