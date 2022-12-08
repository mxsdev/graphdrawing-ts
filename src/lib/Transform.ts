export type Transformation = [ number, number, number, number, number, number ]

/**
 * The |Transform| table provides a set of static methods for
 * creating and handling canvas transformation matrices. Such a matrix
 * is actually just an array of six numbers. The idea is that
 * ``applying'' an array { a, b, c, d, e, f } a vector $(x,y)$ will
 * yield the new vector $(ax+by+e,cx+dy+f)$. For details on how such
 * matrices work, see Section~\ref{section-transform-cm}
 */
export namespace Transform { 

  /**
   * Creates a new transformation array.
   *
   * @param a First component
   * @param b Second component
   * @param c Third component
   * @param d Fourth component
   * @param x The x shift
   * @param y The y shift
   *
   * @return A transformation object.
   */
  export function create(a: number, b: number, c: number, d: number, x: number, y: number): Transformation {
    return [ a, b, c, d, x, y ]
  }

  /**
   * Creates a new transformation object that represents a shift.
   *
   * @param x An x-shift
   * @param y A y-shift
   *
   * @return A transformation object
   */
  export function new_shift(x: number, y: number): Transformation {
    return [ 1, 0, 0, 1, x, y ]
  }

  /**
   * Creates a new transformation object that represents a scaling.
   *
   * @param x The horizontal scaling
   * @param y The vertical scaling (if missing, the horizontal scaling is used)
   *
   * @return A transformation object
   *
   */
  export function new_rotation(angle: number): Transformation {
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    return [ c, -s, s, c, 0, 0 ]
  }

  /**
   *- Creates a new transformation object that represents a scaling.
   *
   * @param x The horizontal scaling
   * @param y The vertical scaling (if missing, the horizontal scaling is used)
   *
   * @return A transformation object
   */
  export function new_scaling(x_scale: number, y_scale?: number): Transformation {
    return [ x_scale, 0, 0, y_scale ?? x_scale, 0, 0]
  }

  /**
   * Concatenate two transformation matrices, returning the new one.
   *
   * @param a The first transformation
   * @param b The second transformation
   *
   * @return The transformation representing first applying |b| and then
   * applying |a|.
   */
  export function concat(a: Transformation, b: Transformation): Transformation {
    const [a1, a2, a3, a4, a5, a6, b1, b2, b3, b4, b5, b6 ]=[a[0], a[1], a[2], a[3], a[4], a[5], b[0], b[1], b[2], b[3], b[4], b[5]]
    return [ a1*b1 + a2*b3,  a1*b2 + a2*b4,
             a3*b1 + a4*b3,  a3*b2 + a4*b4,
             a1*b5 + a2*b6 + a5,  a3*b5 + a4*b6 + a6 ]
  }

  /**
   * Inverts a transformation matrix.
   *
   * @param t The transformation.
   *
   * @return The inverted transformation
   */
  export function invert(t: Transformation): Transformation {
    const [ t1, t2, t3, t4 ] = [ t[0], t[1], t[2], t[3] ]
    const idet = 1/(t1*t4 - t2*t3)

    return [ t4*idet, -t2*idet, -t3*idet, t1*idet, -t[4], -t[5] ]
  }
}
