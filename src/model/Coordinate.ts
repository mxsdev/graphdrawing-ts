import assert from "assert"
import { Transformation } from "../lib/Transform"

/**
 * Basic interface for coordinate type
 */
export interface ICoordinate {
  /**
   * @type {number}
   */
  x: number,
  /**
   * @type {number}
   */
  y: number,
}

/**
 * A Coordinate models a position on the drawing canvas.
 *  
 * It has an |x| field and a |y| field, which are numbers that will be
 * interpreted as \TeX\ points (1/72.27th of an inch). The $x$-axis goes
 * right and the $y$-axis goes up.
 *  
 * There is also a static field called |origin| that is always equal to the origin.
 */
export class Coordinate implements ICoordinate {
  static origin: Coordinate = new Coordinate(0, 0)

  /**
   * Creates a new coordinate.
   * 
   * @param {number} The $x$ value
   * @param {number} The $y$ value
   */
  constructor(public x: number, public y: number) { }

  /**
   * Creates a new coordinate that is a copy of an existing one.
   *
   * @return A new coordinate at the same location as |self|
   */
  clone(): Coordinate {
    return new Coordinate(this.x, this.y)
  }

  /**
   *- Apply a transformation matrix to a coordinate,
   * see |pgf.gd.lib.Transform| for details.
   *
   * @param t A transformation.
    */
  apply(t: Transformation) {
    const x = this.x
    const y = this.y
    this.x = t[0] * x + t[1] * y + t[4]
    this.y = t[2] * x + t[3] * y + t[5]
  }

  /**
   *- Shift a coordinate
   *
   * @param a An $x$ offset
   * @param b A $y$ offset
   */
  shift(a: number, b: number) {
    this.x += a
    this.y += b
  }

  /**
   * ``Unshift'' a coordinate (which is the same as shifting by the
   * inversed coordinate; only faster).
   *
   * @param a An $x$ offset
   * @param b A $y$ offset
   */
  unshift(a: number, b: number) {
    this.x -= a
    this.y -= b
  }

  /**
   * Like |shift|, only for coordinate parameters.
   *
   * @param c Another coordinate. The $x$- and $y$-values of |self| are
   * increased by the $x$- and $y$-values of this coordinate.
   */
  shiftByCoordinate(c: ICoordinate) {
    this.x += c.x
    this.y += c.y
  }

  /**
   * Like |unshift|, only for coordinate parameters.
   *
   * @param c Another coordinate.
   */
  unshiftByCoordinate(c: ICoordinate) {
    this.x -= c.x
    this.y -= c.y
  }

  /**
   * Moves the coordinate a fraction of |f| along a straight line to |c|.
   *
   * @param c Another coordinate
   * @param f A fraction
   */
  moveTowards(c: ICoordinate, f: number) {
    this.x = this.x + f * (c.x - this.x)
    this.y = this.y + f * (c.y - this.y)
  }

  /**
   *- Scale a coordinate by a factor
   *
   * @param s A factor.
   */
  scale(s: number) {
    this.x *= s
    this.y *= s
  }

  /**
   * Normalize a vector: Ensure that it has length 1. If the vector used
   * to be the 0-vector, it gets replaced by (1,0).
   */
  normalize() {
    const { x, y } = this
    if (x === 0 && y === 0)
      this.x = 1
    else {
      const norm = Math.sqrt(x * x + y * y)
      this.x = x / norm
      this.y = y / norm
    }
  }

  /**
   * The norm function. Returns the norm of a coordinate.
   *
   * @param a A coordinate
   * @return The norm of the coordinate
   */
  norm() {
    return Math.sqrt(
      this.x * this.x + this.y * this.y
    )
  }

  /**
   * Normalized version of a vector: Like |normalize|, only the result is
   * returned in a new vector.
   *
   * @return Normalized version of |self|
   */
  normalized() {
    const { x, y } = this
    if (x === 0 && y === 0) {
      return new Coordinate(1, 0)
    } else {
      const norm = Math.sqrt(x * x + y * y)
      return new Coordinate(x / norm, y / norm)
    }
  }

  /**
   * Compute a bounding box around an array of coordinates
   *
   * @param array An array of coordinates
   *
   * @return |min_x| The minimum $x$ value of the bounding box of the array
   * @return |min_y| The minimum $y$ value
   * @return |max_x|
   * @return |max_y|
   * @return |center_x| The center of the bounding box
   * @return |center_y|
   */
  static boundingBox(array: ICoordinate[]): [number, number, number, number, number, number] {
    let min_x = Number.POSITIVE_INFINITY, min_y = Number.POSITIVE_INFINITY
    let max_x = Number.NEGATIVE_INFINITY, max_y = Number.NEGATIVE_INFINITY

    for (const c of array) {
      const x = c.x
      const y = c.y
      if (x < min_x) min_x = x
      if (y < min_y) min_y = y
      if (x > max_x) max_x = x
      if (y > max_y) max_y = y
    }

    return [min_x, min_y, max_x, max_y, (min_x + max_x) / 2, (min_y + max_y) / 2]
  }
  
  toString() {
    return `(${this.x}pt, ${this.y}}pt)`
  }

  /**
   * Add two coordinates, yielding a new coordinate. Note that it will
   * be a lot faster to call shift, whenever this is possible.
   *
   * @param a A coordinate
   * @param b A coordinate
   */
  static add(a: ICoordinate, b: ICoordinate): Coordinate {
    return new Coordinate(
      a.x + b.x,
      a.y + b.y
    )
  }

  /**
   * Subtract two coordinates, yielding a new coordinate. Note that it will
   * be a lot faster to call unshift, whenever this is possible.
   *
   * @param a A coordinate
   * @param b A coordinate
   */
  static sub(a: ICoordinate, b: ICoordinate): Coordinate {
    return new Coordinate(
      a.x - b.x,
      a.y - b.y
    )
  }

  /**
   * The unary minus (mirror the coordinate against the origin).
   *
   * @param a A coordinate
   */
  static unm(a: ICoordinate): Coordinate {
    return new Coordinate(-a.x, -a.y)
  }

  /**
   * The multiplication operator. Its effect depends on the parameters:
   * If both are coordinates, their dot-product is returned. If exactly
   * one of them is a coordinate and the other is a number, the scalar
   * multiple of this coordinate is returned.
   *
   * @param a A coordinate or a scalar
   * @param b A coordinate or a scalar
   * @return The dot product or scalar product.
   */
  static mul(a: ICoordinate, b: ICoordinate): number
  static mul(a: ICoordinate, b: number): Coordinate
  static mul(a: number, b: ICoordinate): Coordinate
  static mul(a: ICoordinate | number, b: ICoordinate | number): Coordinate | number {
    if (typeof a !== 'number') {
      if (typeof b !== 'number') {
        return a.x * b.x + a.y * b.y
      } else {
        return new Coordinate(a.x * b, a.y * b)
      }
    } else {
      if (typeof b !== 'number') {
        return new Coordinate(a * b.x, a * b.y)
      } else {
        return a * b
      }
    }
  }

  /**
   * The division operator. Returns the scalar division of a coordinate
   * by a scalar.
   *
   * @param a A coordinate
   * @param b A scalar (not equal to zero).
   * @return The scalar product or a * (1/b).
   */
  static div(a: ICoordinate, b: number): Coordinate {
    return new Coordinate(a.x / b, a.y / b)
  }

  static fromInterface(coord: ICoordinate): Coordinate {
    return new Coordinate(coord.x, coord.y)
  }
}
