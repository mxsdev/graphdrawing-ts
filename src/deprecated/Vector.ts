import assert from 'assert'

export interface IVector {
  dimension(): number
  at(index: number): number

  x: number
  y: number
}

export class Vector implements IVector {
  private dim: number
  private array: number[]
  
  constructor(n: number|number[] = 2, fill_function?: (index: number) => number) {
    if(typeof n === 'object') {
      this.dim = n.length
      this.array = [...n]
    } else {
      assert(Number.isInteger(n), "Vector size must be integer")
      assert( n >= 0, "Vector size must be non-negative" )

      this.dim = n

      this.array = Array.from(
        {length: this.dim},
        (_, index: number) => fill_function?.(index+1) ?? 0
      )
    }
  }

  at(index: number) {
    this.validateIndex(index)
    return this.array[index-1]
  }

  get x() { return this.at(1) }
  get y() { return this.at(2) }

  set x(val: number) { this.array[0] = val }
  set y(val: number) { this.array[1] = val }
  
  copy() {
    return new Vector(this.array)
  } 

  plus(other: Vector) { 
    assert(this.dimension() === other.dimension())
    return new Vector(this.dim, (n) => this.at(n) + other.at(n))
  }

  minus(other: Vector) {
    return this.plus(other.timesScalar(-1))
  }

  dividedByScalar(scalar: number) {
    return new Vector(this.dimension(), (n) => this.at(n) / scalar)
  }

  timesScalar(scalar: number) {
    return new Vector(this.dimension(), (n) => scalar * this.at(n))
  }

  dotProduct(other: Vector) {
    assert(this.dimension() === other.dimension())

    return this.array.reduce((prev, curr, i) => prev + (curr*other.at(i+1)), 0)
  }

  norm() {
    return Math.sqrt(this.dotProduct(this))
  }

  normalized() {
    const norm = this.norm()
    if(norm === 0) {
      return this.copy()
    } else {
      return this.dividedByScalar(norm)
    }
  }

  update(update_function: (index: number, value: number) => number) {
    for(let i = 1; i <= this.dimension(); i++) {
      this.array[i-1] = update_function(i, this.array[i-1])
    }
  }

  limit(limit_function: (index: number) => [min: number, max: number]) {
    for(let i = 1; i <= this.dimension(); i++) {
      const [ min, max ] = limit_function(i)
      this.array[i-1] = Math.max(min, Math.min(max, this.array[i-1]))
    }
  }

  equals(other: Vector): boolean {
    if(this.dimension() !== other.dimension()) {
      return false
    }

    return this.array.every((v, i) => v === other.at(i+1))
  }

  toString() {
    return `(${this.array.map(n => n.toString()).join(", ")})`
  }

  *[Symbol.iterator]() { 
    yield *this.array
  }

  private validateIndex(index: number) {
    assert(Number.isInteger(index), "Vector index must be integral")
    assert(index >= 1 && index <= this.dim, "Vector index must obey size constraints")
  }

  dimension() { return this.dim }
} 
