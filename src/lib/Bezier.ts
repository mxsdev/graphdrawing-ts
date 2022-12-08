import { ICoordinate, Coordinate } from "../model/Coordinate";
import { Tuple } from "./Tuple";

/**
 * This library offers a number of methods for working with Bezi\'er
 * curves.
 */
export namespace Bezier {
  /**
   * Compute a point ``along a curve at a time''. You provide the four
   * coordinates of the curve and a time. You get a point on the curve
   * as return value as well as the two support vector for curve
   * before this point and two support vectors for the curve after the
   * point.
   *
   * For speed reasons and in order to avoid superfluous creation of
   * lots of tables, all values are provided and returned as pairs of
   * values rather than as |Coordinate| objects.
   *
   * @param ax The coordinate where the curve starts.
   * @param ay
   * @param bx The first support point.
   * @param by
   * @param cx The second support point.
   * @param cy
   * @param dx The coordinate where the curve ends.
   * @param dy
   * @param t A time (a number).
   *
   * @return The point |p| on the curve at time |t| ($x$-part).
   * @return The point |p| on the curve at time |t| ($y$-part).
   * @return The first support point of the curve between |a| and |p| ($x$-part).
   * @return The first support point of the curve between |a| and |p| ($y$-part).
   * @return The second support point of the curve between |a| and |p| ($x$-part).
   * @return The second support point of the curve between |a| and |p| ($y$-part).
   * @return The first support point of the curve between |p| and |d| ($x$-part).
   * @return The first support point of the curve between |p| and |d| ($y$-part).
   * @return The second support point of the curve between |p| and |d| ($x$-part).
   * @return The second support point of the curve between |p| and |d| ($y$-part).
   */
  export function atTime(
    ax: number, ay: number,
    bx: number, by: number,
    cx: number, cy: number,
    dx: number, dy: number,
    t: number
  ): Tuple<number, 10> {
    const s = 1 - t

    const [ex, ey] = [ax * s + bx * t, ay * s + by * t]
    const [fx, fy] = [bx * s + cx * t, by * s + cy * t]
    const [gx, gy] = [cx * s + dx * t, cy * s + dy * t]

    const [hx, hy] = [ex * s + fx * t, ey * s + fy * t]
    const [ix, iy] = [fx * s + gx * t, fy * s + gy * t]

    const [jx, jy] = [hx * s + ix * t, hy * s + iy * t]

    return [jx, jy, ex, ey, hx, hy, ix, iy, gx, gy]
  }

  /**
   * The ``coordinate version'' of the |atTime| function, where both the
   * parameters and the return values are coordinate objects.
   */
  export function atTimeCoordinates(
    a: ICoordinate,
    b: ICoordinate,
    c: ICoordinate,
    d: ICoordinate,
    t: number
  ): Tuple<Coordinate, 5> {
    const [jx, jy, ex, ey, hx, hy, ix, iy, gx, gy] =
      Bezier.atTime(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y, t)

    return [
      new Coordinate(jx, jy),
      new Coordinate(ex, ey),
      new Coordinate(hx, hy),
      new Coordinate(ix, iy),
      new Coordinate(gx, gy)
    ]
  }

  /**
   * Computes the support points of a Bezier curve based on two points
   * on the curves at certain times.
   *
   * @param from The start point of the curve
   * @param p1 A first point on the curve
   * @param t1 A time when this point should be reached
   * @param p2 A second point of the curve
   * @param t2 A time when this second point should be reached
   * @param to The end of the curve
   *
   * @return sup1 A first support point of the curve
   * @return sup2 A second support point of the curve
  */
  export function supportsForPointsAtTime(
    from: ICoordinate,
    p1: ICoordinate, t1: number,
    p2: ICoordinate, t2: number,
    to: ICoordinate,
  ): Tuple<Coordinate, 2> {
    const s1 = 1 - t1
    const s2 = 1 - t2

    const f1a = s1 ** 3
    const f1b = t1 * s1 ** 2 * 3
    const f1c = t1 ** 2 * s1 * 3
    const f1d = t1 ** 3

    const f2a = s2 ** 3
    const f2b = t2 * s2 ** 2 * 3
    const f2c = t2 ** 2 * s2 * 3
    const f2d = t2 ** 3

    // The system:
    // p1.x - from.x * f1a - to.x * f1d = sup1.x * f1b + sup2.x * f1c
    // p2.x - from.x * f2a - to.x * f2d = sup1.x * f2b + sup2.x * f2c
    //
    // p1.y - from.y * f1a - to.y * f1d = sup1.y * f1b + sup2.y * f1c
    // p2.y - from.y * f2a - to.y * f2d = sup1.y * f2b + sup2.y * f2c

    const a = f1b
    const b = f1c
    let c = p1.x - from.x * f1a - to.x * f1d
    const d = f2b
    const e = f2c
    let f = p2.x - from.x * f2a - to.x * f2d

    let det = a * e - b * d
    const x1 = -(b * f - e * c) / det
    const x2 = -(c * d - a * f) / det

    c = p1.y - from.y * f1a - to.y * f1d
    f = p2.y - from.y * f2a - to.y * f2d

    det = a * e - b * d
    const y1 = -(b * f - e * c) / det
    const y2 = -(c * d - a * f) / det

    return [new Coordinate(x1, y1), new Coordinate(x2, y2)]
  }


}
