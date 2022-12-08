import assert from 'assert'
import { Tuple } from '../util/types/utilityTypes'
import { Bezier } from '../lib/Bezier'
import { Transformation } from '../lib/Transform'
import { Coordinate, ICoordinate } from './Coordinate'
import { Edge } from './Edge'
import { appendArc, appendArcTo } from './Path_arced'

const eps = 0.0001

export interface IBoundingBox { max_x: number, min_x: number, max_y: number, min_y: number }

type LazyCoordinate = Coordinate | ((edge?: Edge) => Coordinate)

type PathAction = "lineto" | "closepath" | "curveto" | "moveto"
type PathCommand = PathAction | LazyCoordinate

type PathIntersection = { time: number, point: Coordinate }
type IndexedPathIntersection = PathIntersection & { index: number }

type Tail<T extends any[]> = ((...args: T) => void) extends (head: any, ...tail: infer U) => any ? U : never;

type PathActionData = { action: 'lineto'|'closepath', from: Coordinate, to: Coordinate }|{
  action: 'moveto',
  to: Coordinate
}
|{
  action: 'curveto',
  from: Coordinate,
  to: Coordinate,
  support_1: Coordinate,
  support_2: Coordinate,
}

/*
 * A Path models a path in the plane.
 *
 * Following the PostScript/\textsc{pdf}/\textsc{svg} convention, a
 * path consists of a series of path segments, each of which can be
 * closed or not. Each path segment, in turn, consists of a series of
 * Bézier curves and straight line segments; see
 * Section~\ref{section-paths} for an introduction to paths in
 * general.
 *
 * A |Path| object is a table whose array part stores
 * |Coordinate| objects, |strings|, and |function|s that
 * describe the path of the edge. The following strings are allowed in
 * this array:
 * %
 * \begin{itemize}
 *   \item |"moveto"| The line's path should stop at the current
 *     position and then start anew at the next coordinate in the array.
 *   \item |"lineto"| The line should continue from the current position
 *     to the next coordinate in the array.
 *   \item |"curveto"| The line should continue form the current
 *     position with a Bézier curve that is specified by the next three
 *     |Coordinate| objects (in the usual manner).
 *   \item |"closepath"| The line's path should be ``closed'' in the sense
 *     that the current subpath that was started with the most recent
 *     moveto operation should now form a closed curve.
 * \end{itemize}
 *
 * Instead of a |Coordinate|, a |Path| may also contain a function. In
 * this case, the function, when called, must return the |Coordinate|
 * that is ``meant'' by the position. This allows algorithms to
 * add coordinates to a path that are still not fixed at the moment
 * they are added to the path.
 */
export class Path {
  /**
   * https://javascript.plainenglish.io/deep-clone-an-object-and-preserve-its-type-with-typescript-d488c35e5574
   */
  private static deepCopy<T>(source: T): T {
    return Array.isArray(source)
      ? source.map(item => Path.deepCopy(item))
      : source instanceof Date
        ? new Date(source.getTime())
        : source instanceof Coordinate
          ? source.clone()
          : source && typeof source === 'object'
            ? Object.getOwnPropertyNames(source).reduce((o, prop) => {
              Object.defineProperty(o, prop, Object.getOwnPropertyDescriptor(source, prop)!);
              o[prop] = Path.deepCopy((source as { [key: string]: any })[prop]);
              return o;
            }, Object.create(Object.getPrototypeOf(source)))
            : source as T;
  }

  _commands: PathCommand[] = []

  private pushCommands(...commands: PathCommand[]) {
    this._commands.push(...commands)
  }

  *[Symbol.iterator]() {
    yield *this._commands
  }

  entries() {
    return this._commands.entries()
  }

  get length() {
    return this._commands.length
  }

  constructor(...initial: (PathAction|number|LazyCoordinate)[]) {
    if (initial) {
      const cmds: PathCommand[] = []
      let i = 0
      let count = 0

      while (i < initial.length) {
        const e = initial[i]

        if (typeof e == "string") {
          assert(count === 0, "illformed path")

          if (e === "moveto") {
            count = 1
          } else if (e === "lineto") {
            count = 1
          } else if (e === "closepath") {
            count = 0
          } else if (e === "curveto") {
            count = 3
          } else {
            throw new Error("unknown path command " + e)
          }

          cmds.push(e)
        } else if (typeof e === 'number') {
          if (count == 0) {
            cmds.push("lineto")
          } else {
            count = count - 1
          }
          const _v = initial[i+1]
          assert(typeof _v === 'number')

          cmds.push(new Coordinate(e, _v))
          i = i + 1
        } else if (typeof e === 'object' || typeof e === 'function') {
          if (count == 0) {
            cmds.push("lineto")
          }
          else {
            count = count - 1
          }
          cmds.push(e)
        } else {
          throw new Error("invalid object on path")
        }

        i = i + 1
      }

      this._commands = cmds
    } else { }
  }

  clone() {
    const res = new Path()

    res._commands = Path.deepCopy(this._commands)

    return res
  }

  reversed() {
    type SubPath = {
      start?: Coordinate,
      actions: PathActionData[]
    }
    // First, build segments
    const subpaths: SubPath[] = []
    let subpath: SubPath = { actions: [] }

    const closepath = () => {
      if (subpath.start) {
        subpaths.push(subpath)
        subpath = { actions: [] }
      }
    }

    let prev: Coordinate | undefined = undefined
    let start: Coordinate | undefined = undefined

    let i = 0
    while (i < this._commands.length) {
      const x = this._commands[i]

      if (x === 'lineto') {
        assert(prev)
        const _to = this._commands[i+1]
        assert(_to instanceof Coordinate)

        subpath.actions.push({
          action: 'lineto',
          from: prev,
          to: _to
        })
        prev = _to
        i += 2
      } else if (x === 'moveto') {
        closepath()
        const _prev = this._commands[i + 1]
        assert(_prev instanceof Coordinate)

        prev = _prev
        start = prev
        subpath.start = prev
        i = i + 2
      } else if (x === "closepath") {
        assert(prev)
        assert(start)

        subpath.actions.push({
          action: "closepath",
          from: prev,
          to: start,
        })
        prev = undefined
        start = undefined
        closepath()
        i += 1
      } else if (x === 'curveto') {
        const [s1, s2, to] = [this._commands[i + 1], this._commands[i + 2], this._commands[i + 3]]
        assert(s1 instanceof Coordinate)
        assert(s2 instanceof Coordinate)
        assert(to instanceof Coordinate)
        assert(prev)

        subpath.actions.push({
          action: 'curveto',
          from: prev,
          to: to,
          support_1: s1,
          support_2: s2,
        })
      } else {
        throw new Error(`illegal path command '${x}'`)
      }
    }

    closepath()

    const newPath = new Path()

    for (const sp of subpaths) {
      if(sp.actions.length === 0) {
        assert(sp.start)
        // A subpath that consists of only a moveto:
        newPath.appendMoveto(sp.start)
      } else {
        const _end = subpath.actions[subpath.actions.length - 1]
        assert(_end)

        // We start with a moveto to the end point:
        newPath.appendMoveto(_end.to)

        // Now walk backwards:
        for(let i = sp.actions.length - 1; i >= 0; i--) {
          const a = subpath.actions[i]

          if(a.action === 'lineto') {
            newPath.appendLineto(a.from)
          } else if(a.action === 'closepath') {
            newPath.appendLineto(a.from)
          } else if(a.action === 'curveto') {
            newPath.appendCurveto(
              a.support_2,
              a.support_1,
              a.from
            )
          } else {
            throw new Error('Illegal path command')
          }
        }

        // Append a closepath, if necessary
        if(_end.action === 'closepath') {
          newPath.appendClosepath()
        }
      }
    }

    return newPath
  }

  private applyToCoords(func: (cmd: Coordinate) => void) {
    this._commands.forEach((cmd) => {
      if (cmd instanceof Coordinate) {
        func(cmd)
      }
    })
  }

  transform(t: Transformation) {
    this.applyToCoords((cmd) => cmd.apply(t))
  }

  shift(x: number, y: number) {
    this.applyToCoords((cmd) => cmd.shift(x, y))
  }

  shiftByCoordinate(x: ICoordinate) {
    this.applyToCoords((cmd) => cmd.shiftByCoordinate(x))
  }

  clear() {
    this._commands = []
  }

  appendMoveto(x: number, y: number): void
  appendMoveto(x: LazyCoordinate): void
  appendMoveto(x: number | LazyCoordinate , y?: number) {
    this.pushCommands("moveto", y ? new Coordinate(x as number, y) : x as Coordinate)
  }

  appendLineto(x: number, y: number): void
  appendLineto(x: LazyCoordinate): void
  appendLineto(x: number | LazyCoordinate, y?: number) {
    // assert((!!y && typeof x === 'number') || (!y && x instanceof Coordinate))
    this.pushCommands("lineto", y ? new Coordinate(x as number, y) : x as Coordinate)
  }

  appendClosepath() {
    this.pushCommands("closepath")
  }

  appendCurveto(...coords: Tuple<Coordinate, 3> | Tuple<number, 6>) {
    this.pushCommands("curveto")

    const [a, b, c, d, e, f] = coords

    if (f) {
      this.pushCommands(
        new Coordinate(a as number, b as number),
        new Coordinate(c as number, d as number),
        new Coordinate(e as number, f as number),
      )
    } else {
      this.pushCommands(a as Coordinate, b as Coordinate, c as Coordinate)
    }
  }

  makeRigid() {
    this._commands = this._commands.map((cmd) => rigid(cmd))
  }

  coordinates() {
    return this._commands.reduce<Coordinate[]>((prev, curr) => {
      if (typeof curr === 'object') {
        return [...prev, curr]
      } else if (typeof curr === 'function') {
        return [...prev, curr()]
      } else {
        return prev
      }
    }, [])
  }

  boundingBox(): Tuple<number, 6> {
    if (this._commands.length > 0) {
      let min_x = Number.POSITIVE_INFINITY
      let min_y = min_x

      let max_x = Number.NEGATIVE_INFINITY
      let max_y = max_x

      for (const _c of this._commands) {
        const c = rigid(_c)
        if (typeof c === 'object') {
          const { x, y } = c
          if (x < min_x) min_x = x
          if (y < min_y) min_y = y
          if (x > max_x) max_x = x
          if (y > max_y) max_y = y
        }
      }

      if (isFinite(min_x)) {
        return [min_x, min_y, max_x, max_y, (min_x + max_x) / 2, (min_y + max_y) / 2]
      }
    }

    return [0, 0, 0, 0, 0, 0]
  }

  intersectionsWith(path: Path): IndexedPathIntersection[] {
    const p1    = segmentize(this._commands)
    const memo1 = prepare_memo(p1)
    const p2    = segmentize(path._commands)
    const memo2 = prepare_memo(p2)

    const intersections: IndexedPathIntersection[] = []

    const intersect_segments = (i1: number, i2: number) => {
      const s1 = p1[i1]
      const s2 = p2[i2]
      const r: IndexedPathIntersection[] = []

      if (s1.action === 'lineto' && s2.action === 'lineto') {
        const a = s2.to.x - s2.from.x
        const b = s1.from.x - s1.to.x
        const c = s2.from.x - s1.from.x
        const d = s2.to.y - s2.from.y
        const e = s1.from.y - s1.to.y
        const f = s2.from.y - s1.from.y

        const det = a*e - b*d

        if (Math.abs(det) > eps*eps) {
          const [t, s] = [(c*d - a*f)/det, (b*f - e*c)/det]

          if (t >= 0 && t<=1 && s>=0 && s <= 1) {
            const p = s1.from.clone()
            p.moveTowards(s1.to, t)
            return [ { time: t, point: p } ]
          }
        }
      } else if (s1.action === 'lineto' && s2.action === 'curveto') {
        intersect_curves (0, 1,
                          s1.from.x, s1.from.y,
                          s1.from.x*2/3+s1.to.x*1/3, s1.from.y*2/3+s1.to.y*1/3,
                          s1.from.x*1/3+s1.to.x*2/3, s1.from.y*1/3+s1.to.y*2/3,
                          s1.to.x, s1.to.y,
                          s2.from.x, s2.from.y,
                          s2.support_1.x, s2.support_1.y,
                          s2.support_2.x, s2.support_2.y,
                          s2.to.x, s2.to.y,
                          r)
      } else if (s1.action === 'curveto' && s2.action === 'lineto') {
        intersect_curves (0, 1,
                          s1.from.x, s1.from.y,
                          s1.support_1.x, s1.support_1.y,
                          s1.support_2.x, s1.support_2.y,
                          s1.to.x, s1.to.y,
                          s2.from.x, s2.from.y,
                          s2.from.x*2/3+s2.to.x*1/3, s2.from.y*2/3+s2.to.y*1/3,
                          s2.from.x*1/3+s2.to.x*2/3, s2.from.y*1/3+s2.to.y*2/3,
                          s2.to.x, s2.to.y,
                          r)
      } else {
        assert(s1.action === 'curveto')
        assert(s2.action === 'curveto')

        intersect_curves (0, 1,
                          s1.from.x, s1.from.y,
                          s1.support_1.x, s1.support_1.y,
                          s1.support_2.x, s1.support_2.y,
                          s1.to.x, s1.to.y,
                          s2.from.x, s2.from.y,
                          s2.support_1.x, s2.support_1.y,
                          s2.support_2.x, s2.support_2.y,
                          s2.to.x, s2.to.y,
                          r)
      }

      return r
    }

    const intersect = (i1: number, j1: number, i2: number, j2: number) => {
      if (i1 > j1 || i2 > j2) {
        return
      }

      const bb1 = bb(i1, j1, memo1)
      const bb2 = bb(i2, j2, memo2)

      if (boxes_intersect(bb1, bb2)) {
        // Ok, need to do something
        if (i1 == j1 && i2 == j2) {
          const intersects = intersect_segments (i1, i2)
          for(const t of intersects) {
            intersections.push({
              time: t.time,
              index: p1[i1].path_pos,
              point: t.point
            })
          }
        } else if (i1 == j1) {
          const m2 = Math.floor((i2 + j2) / 2)
          intersect(i1, j1, i2, m2)
          intersect(i1, j1, m2+1, j2)
        } else if (i2 == j2) {
          const m1 = Math.floor((i1 + j1) / 2)
          intersect(i1, m1, i2, j2)
          intersect(m1+1, j1, i2, j2)
        } else {
          const m1 = Math.floor((i1 + j1) / 2)
          const m2 = Math.floor((i2 + j2) / 2)
          intersect(i1, m1, i2, m2)
          intersect(m1+1, j1, i2, m2)
          intersect(i1, m1, m2+1, j2)
          intersect(m1+1, j1, m2+1, j2)
        }
      }
    }

    // Run the recursion
    intersect(0, p1.length-1, 0, p2.length-1)

    // Sort
    // FIXME: this probably won't work in JS...
    intersections.sort((a, b) => {
      return (a.index < b.index ||
              a.index == b.index && a.time < b.time) ? 1 : -1
    })

    if(intersections.length === 0) return []

    // Remove duplicates
    const remains: IndexedPathIntersection[] = []
    remains[0] = intersections[0]

    for(let i = 1; i < intersections.length; i++) {
      const next = intersections[i]
      const prev = remains[remains.length - 1]
      if (Math.abs(next.point.x - prev.point.x) + Math.abs(next.point.y - prev.point.y) > eps) {
        remains.push(next)
      }
    }

    return remains
  }

  private _moveBack(cut_path: Path) {
    for(let i = 0; i < cut_path._commands.length; i++) {
      this._commands[i] = cut_path._commands[i]
    }

    this._commands.splice(cut_path._commands.length)
  }

  cutAtBeginning(index: number, time: number) {
    const cut_path = new Path ()

    const _before = this._commands[index - 1]

    // Ok, first, we need to find the segment *before* the current
    // one. Usually, this will be a moveto or a lineto, but things could
    // be different.
    assert (typeof _before === 'object' ||typeof _before === 'function',
            "segment before intersection does not end with a coordinate")

    const from   = rigid(_before)
    const action = this._commands[index]

    // Now, depending on the type of segment, we do different things:
    if (action === "lineto") {
      // Ok, compute point:
      const to = rigid(this._commands[index+1])
      assert(to instanceof Coordinate)

      from.moveTowards(to, time)

      // Ok, this is easy: We start with a fresh moveto ...
      cut_path._commands[0] = "moveto"
      cut_path._commands[1] = from

      // ... and copy the rest
      for(let i = index; i < this._commands.length; i++) {
        cut_path.pushCommands(this._commands[i]) 
      }
    } else if (action === "curveto") {
      const to = rigid(this._commands[index+3])
      const s1 = rigid(this._commands[index+1])
      const s2 = rigid(this._commands[index+2])

      assert(to instanceof Coordinate)
      assert(s1 instanceof Coordinate)
      assert(s2 instanceof Coordinate)

      // Now, compute the support vectors and the point at time:
      from.moveTowards(s1, time)
      s1.moveTowards(s2, time)
      s2.moveTowards(to, time)

      from.moveTowards(s1, time)
      s1.moveTowards(s2, time)

      from.moveTowards(s1, time)

      // Ok, this is easy: We start with a fresh moveto ...
      cut_path._commands[0] = "moveto"
      cut_path._commands[1] = from
      cut_path._commands[2] = "curveto"
      cut_path._commands[3] = s1
      cut_path._commands[4] = s2
      cut_path._commands[5] = to

      // ... and copy the rest
      for(let i = index+4; i < this._commands.length; i++) {
        cut_path.pushCommands(this._commands[i])
      }
    } else if (action === "closepath") {
      // Let us find the start point:
      let found: number|null = null

      for(let i = index; i >= 0; i--) {
        if (this._commands[i] === 'moveto') {
          found = i
        }
      }

      assert(found, "no moveto found in path")

      const to = rigid(this._commands[found+1])
      assert(to instanceof Coordinate)

      from.moveTowards(to,time)

      cut_path._commands[0] = "moveto"
      cut_path._commands[1] = from
      cut_path._commands[2] = "lineto"
      cut_path._commands[3] = to

      // ... and copy the rest
      for(let i = index+1; i < this._commands.length; i++) {
        cut_path.pushCommands(this._commands[i])
      }
    } else {
      throw new Error ("wrong path operation")
    }

    // Move cut_path back:
    // for(let i = 0; i < cut_path._commands.length; i++) {
    //   this._commands[i] = cut_path._commands[i]
    // }
    //
    // this._commands.splice(cut_path._commands.length)
    this._moveBack(cut_path)
  }

  cutAtEnd(index: number, time: number) {
    const cut_path = new Path()

    const _before = this._commands[index - 1]

    // Ok, first, we need to find the segment *before* the current
    // one. Usually, this will be a moveto or a lineto, but things could
    // be different.
    assert (typeof _before === 'object' ||typeof _before === 'function',
            "segment before intersection does not end with a coordinate")

    const from   = rigid(_before)
    const action = this._commands[index]

    // Now, depending on the type of segment, we do different things:
    if (action === "lineto") {
      // Ok, compute point:
      const to = rigid(this._commands[index+1])
      assert(to instanceof Coordinate)

      to.moveTowards(from, 1-time)

      for(let i = 0; i < index; i++) {
        cut_path._commands[i] = this._commands[i]
      }
      cut_path._commands[index+1] = to
    } else if (action === "curveto") {
      const s1 = rigid(this._commands[index+1])
      const s2 = rigid(this._commands[index+2])
      const to = rigid(this._commands[index+3])

      assert(s1 instanceof Coordinate)
      assert(s2 instanceof Coordinate)
      assert(to instanceof Coordinate)

      // Now, compute the support vectors and the point at time:
      to.moveTowards(s2, 1-time)
      s2.moveTowards(s1, 1-time)
      s1.moveTowards(from, 1-time)

      to.moveTowards(s2, 1-time)
      s2.moveTowards(s1, 1-time)

      to.moveTowards(s2, 1-time)

      // ... and copy the rest
      for(let i = 0; i < index; i++) {
        cut_path._commands[i] = this._commands[i]
      }

      cut_path._commands[index+1] = s1
      cut_path._commands[index+2] = s2
      cut_path._commands[index+3] = to
    } else if (action === "closepath") {
      // Let us find the start point:
      let found: number|null = null

      for(let i = index; i >= 0; i--) {
        if(this._commands[i] === 'moveto') {
          found = i
        }
      }

      assert(found, "no moveto found in path")

      const _to = this._commands[found+1]
      assert(_to instanceof Coordinate)

      // const to = rigid(this._commands[found+1]:clone())
      // WARN: this is slightly different than above
      const to = rigid(_to).clone()
      to.moveTowards(from,1-time)

      for(let i = 0; i < index - 1; i++) {
        cut_path._commands[i] = this._commands[i]
      }

      cut_path._commands[index] = 'lineto'
      cut_path._commands[index+1] = to
    } else {
      throw new Error ("wrong path operation")
    }

    // Move cut_path back:
    this._moveBack(cut_path)
  }

  pad(padding: number) {
    const padded = this.clone()
    padded.makeRigid()

    if(padding === 0) return padded

    type SubPath = {
      start_index?: number,
      end_index?: number,
      skipped?: Coordinate,
      coords: Coordinate[],
    }

    // First, decompose the path into subpaths:
    const subpaths: SubPath[] = []
    let subpath: SubPath = { coords: [] }
    let start_index = 1

    const closepath = (end_index: number) => {
      if (subpath.coords.length >= 1) {
        subpath.start_index = start_index
        subpath.end_index   = end_index
        start_index = end_index + 1

        let start = 0
        assert(subpath.coords.length >= 1)

        if(Coordinate.sub(subpath.coords[subpath.coords.length - 1], subpath.coords[0]).norm() < 0.01
          && subpath.coords[1]) {
            start = 1
            subpath.skipped = subpath.coords[0]
          }

        subpath.coords.push( subpath.coords[start] )
        subpath.coords.push( subpath.coords[start+1] )
        subpaths.push(subpath)
        subpath = { coords: [] }
      }
    }

    padded._commands.forEach((p, i) => {
      if(p !== 'closepath') {
        if(typeof p === 'object') {
          subpath.coords.push(p)
        }
      } else {
        closepath(i)
      }
    })

    closepath(padded._commands.length - 1)

    for(const sp of subpaths) {
      const new_coordinates: Coordinate[] = []
      const [__,___,_____,_______,c_x,c_y] = Coordinate.boundingBox(subpath.coords)
      let c = new Coordinate(c_x,c_y)

      // Find out the orientation of the path
      let count = 0
      for(let i = 0; i < subpath.coords.length - 2; i++) {
        const d2 = Coordinate.sub( subpath.coords[i+1], subpath.coords[i] )
        const d1 = Coordinate.sub(subpath.coords[i+2], subpath.coords[i+1])

        const diff = Math.atan2(d2.y,d2.x) - Math.atan2(d1.y,d1.x)

        if (diff < -Math.PI) {
          count = count + 1
        } else if (diff > Math.PI) {
          count = count - 1
        }
      }

      // TODO: check all for loops, i might've gotten all the indices wrong...
      for(let i = 1; i < subpath.coords.length-1; i++) {
        const p = subpath.coords[i]
        const d1 = Coordinate.sub(subpath.coords[i], subpath.coords[i-1])
        const d2 = Coordinate.sub(subpath.coords[i+1], subpath.coords[i])

        const orth1 = new Coordinate(-d1.y, d1.x)
        const orth2 = new Coordinate(-d2.y, d2.x)

        orth1.normalize()
        orth2.normalize()

        if (count < 0) {
          orth1.scale(-1)
          orth2.scale(-1)
        }

        // Ok, now we want to compute the intersection of the lines
        // perpendicular to p + padding*orth1 and p + padding*orth2:

        const det = orth1.x * orth2.y - orth1.y * orth2.x

        // const c
        if (Math.abs(det) < 0.1) {
          c = Coordinate.add(orth1, orth2)
          c.scale(padding/2)
        } else {
          c = new Coordinate(padding*(orth2.y-orth1.y)/det, padding*(orth1.x-orth2.x)/det)
        }

        new_coordinates[i] = Coordinate.add(c,p)
      }

      for(let i = 1; i < subpath.coords.length - 1; i++) {
        const p = subpath.coords[i]
        const new_p = new_coordinates[i]
        p.x = new_p.x
        p.y = new_p.y
      }

      if (subpath.skipped) {
        const p = subpath.coords[1]
        const new_p = new_coordinates[subpath.coords.length - 3]
        p.x = new_p.x
        p.y = new_p.y
      } 

      assert(subpath.start_index)
      assert(subpath.end_index)

      // Now, we need to correct the curveto fields:
      for(let i = subpath.start_index; i < subpath.end_index + 1; i++) {
        if (this._commands[i] === 'curveto') {
          const from = rigid(this._commands[i-1])
          const s1   = rigid(this._commands[i+1])
          const s2   = rigid(this._commands[i+2])
          const to   = rigid(this._commands[i+3])

          assert(from instanceof Coordinate)
          assert(s1 instanceof Coordinate)
          assert(s2 instanceof Coordinate)
          assert(to instanceof Coordinate)

          const [ p1x, p1y, ___________, ________________, h1x, h1y ] =
            Bezier.atTime(from.x, from.y, s1.x, s1.y, s2.x, s2.y,
                          to.x, to.y, 1/3)

          const [p2x, p2y, ____________, _________________, __________, _______, h2x, h2y] =
            Bezier.atTime(from.x, from.y, s1.x, s1.y, s2.x, s2.y,
                          to.x, to.y, 2/3)

          const orth1 = new Coordinate (p1y - h1y, -(p1x - h1x))
          orth1.normalize()
          orth1.scale(-padding)

          const orth2 = new Coordinate (p2y - h2y, -(p2x - h2x))
          orth2.normalize()
          orth2.scale(padding)

          if (count < 0) {
            orth1.scale(-1)
            orth2.scale(-1)
          }

          const _com1 = padded._commands[i-1]
          const _com2 = padded._commands[i+3]

          assert(_com1 instanceof Coordinate)
          assert(_com2 instanceof Coordinate)

          const [new_s1, new_s2] =
            Bezier.supportsForPointsAtTime(_com1,
                                           new Coordinate(p1x+orth1.x,p1y+orth1.y), 1/3,
                                           new Coordinate(p2x+orth2.x,p2y+orth2.y), 2/3,
                                           _com2)

          padded._commands[i+1] = new_s1
          padded._commands[i+2] = new_s2
        }
      }
    }
  }

  appendArc(...args: Tail<Parameters<typeof appendArc>>) {
    return appendArc(this, ...args)
  }

  appendArcTo(...args: Tail<Parameters<typeof appendArcTo>>) {
    return appendArcTo(this, ...args)
  }

  static boundingBoxRect({ min_x, min_y, max_x, max_y }: IBoundingBox) {
    return new Path(
      'moveto',
      min_x, min_y,
      'lineto',
      min_x, max_y,
      'lineto',
      max_x, max_y,
      'closepath',
    )
  }

  static rectPath(width: number, height: number) {
    return Path.boundingBoxRect({ min_x: -width/2, min_y: -height/2, max_x: width/2, max_y: height/2 })
  }

  static squarePath(size: number) {
    return Path.rectPath(size, size)
  }
}

function boxes_intersect(bb1: IBoundingBox, bb2: IBoundingBox) {
  return (bb1.max_x >= bb2.min_x - eps * eps &&
    bb1.min_x <= bb2.max_x + eps * eps &&
    bb1.max_y >= bb2.min_y - eps * eps &&
    bb1.min_y <= bb2.max_y + eps * eps)
}

type SegmentizedPath = (PathActionData & {
  path_pos: number,
  bb: IBoundingBox,
})[]

function segmentize(path: PathCommand[]): SegmentizedPath {
  let prev: Coordinate|undefined = undefined
  let start: Coordinate|undefined = undefined
  let s: SegmentizedPath = []

  let i = 0
  while (i < path.length) {

    let x = path[i]

    if (x === "lineto") {
      x = rigid(path[i+1])
      assert(x instanceof Coordinate)
      assert(prev)

      s.push(
      {
        path_pos: i,
        action  : "lineto",
        from    : prev,
        to      : x,
        bb      : {
          min_x: Math.min(prev.x, x.x),
          max_x: Math.max(prev.x, x.x),
          min_y: Math.min(prev.y, x.y),
          max_y: Math.max(prev.y, x.y),
        }
      }
      ) 
      prev = x
      i = i + 2
    } else if (x === "moveto") {
      const _prev = rigid(path[i+1])
      assert(_prev instanceof Coordinate)

      prev = _prev
      start = prev
      i = i + 2
    } else if (x === "closepath") {
      assert(prev)
      assert(start)

      s.push ({
        path_pos: i,
          action  : "lineto",
          from    : prev,
          to      : start,
          bb      : {
          min_x: Math.min(prev.x, start.x),
            max_x: Math.max(prev.x, start.x),
            min_y: Math.min(prev.y, start.y),
            max_y: Math.max(prev.y, start.y),
        }
      })
      prev = undefined
      start = undefined

      i = i + 1
    } else if (x === "curveto") {
      const [s1, s2, to] = [rigid(path[i+1]), rigid(path[i+2]), rigid(path[i+3])]

      assert(s1 instanceof Coordinate)
      assert(s2 instanceof Coordinate)
      assert(to instanceof Coordinate)
      assert(prev)

      s.push({
        action   : "curveto",
          path_pos : i,
          from     : prev,
          to       : to,
          support_1: s1,
          support_2: s2,
          bb       : {
          min_x: Math.min(prev.x, s1.x, s2.x, to.x),
            max_x: Math.max(prev.x, s1.x, s2.x, to.x),
            min_y: Math.min(prev.y, s1.y, s2.y, to.y),
            max_y: Math.max(prev.y, s1.y, s2.y, to.y),
        }
      })
      const _prev = path[i+3]
      assert(_prev instanceof Coordinate)

      prev = _prev
      i = i + 4
    } else {
      throw new Error ("illegal path command '" + x + "'")
    }
  }

  return s
}

type Memo = { base: number, content: (IBoundingBox | undefined)[] }

function prepare_memo(s: { bb: IBoundingBox }[]): Memo {
  const memo: Memo = { base: s.length, content: [] }

  // WARN: this might cause issues later due to indexing mismatch with lua
  for (let i = 1; i < s.length + 1; i++) {
    const e = s[i - 1]
    memo.content[(i) * (s.length) + i - 1] = e.bb
  }

  return memo
}

function bb(i: number, j: number, memo: Memo): IBoundingBox {
  const I = i + 1
  const J = j + 1

  const idx = memo.base * I + J - 1

  let b = memo.content[idx]
  if (!b) {
    assert(i < j, "memorization table filled incorectly")

    const mid = Math.floor((i + j) / 2)
    const bb1 = bb(i, mid, memo)
    const bb2 = bb(mid + 1, j, memo)
    b = {
      min_x: Math.min(bb1.min_x, bb2.min_x),
      max_x: Math.max(bb1.max_x, bb2.max_x),
      min_y: Math.min(bb1.min_y, bb2.min_y),
      max_y: Math.max(bb1.max_y, bb2.max_y)
    }
    memo.content[idx] = b
  }

  return b
}

function intersect_curves(t0: number, t1: number,
  c1_ax: number, c1_ay: number, c1_bx: number, c1_by: number,
  c1_cx: number, c1_cy: number, c1_dx: number, c1_dy: number,
  c2_ax: number, c2_ay: number, c2_bx: number, c2_by: number,
  c2_cx: number, c2_cy: number, c2_dx: number, c2_dy: number,
  intersections: PathIntersection[]) {
  // Only do something, if the bounding boxes intersect:
  const c1_min_x = Math.min(c1_ax, c1_bx, c1_cx, c1_dx)
  const c1_max_x = Math.max(c1_ax, c1_bx, c1_cx, c1_dx)
  const c1_min_y = Math.min(c1_ay, c1_by, c1_cy, c1_dy)
  const c1_max_y = Math.max(c1_ay, c1_by, c1_cy, c1_dy)
  const c2_min_x = Math.min(c2_ax, c2_bx, c2_cx, c2_dx)
  const c2_max_x = Math.max(c2_ax, c2_bx, c2_cx, c2_dx)
  const c2_min_y = Math.min(c2_ay, c2_by, c2_cy, c2_dy)
  const c2_max_y = Math.max(c2_ay, c2_by, c2_cy, c2_dy)

  if (c1_max_x >= c2_min_x &&
    c1_min_x <= c2_max_x &&
    c1_max_y >= c2_min_y &&
    c1_min_y <= c2_max_y) {

    // Everything "near together"?
    if (c1_max_x - c1_min_x < eps && c1_max_y - c1_min_y < eps) {

      // Compute intersection of lines c1_a to c1_d and c2_a to c2_d
      const a = c2_dx - c2_ax
      const b = c1_ax - c1_dx
      const c = c2_ax - c1_ax
      const d = c2_dy - c2_ay
      const e = c1_ay - c1_dy
      const f = c2_ay - c1_ay

      const det = a * e - b * d
      let t = (c * d - a * f) / det

      if (t < 0) {
        t = 0
      } else if (t > 1) {
        t = 1
      }

      intersections.push({
        time: t0 + t * (t1 - t0),
        point: new Coordinate(c1_ax + t * (c1_dx - c1_ax), c1_ay + t * (c1_dy - c1_ay))
      })

    } else {
      // Cut 'em in half!
      const [c1_ex, c1_ey] = [(c1_ax + c1_bx) / 2, (c1_ay + c1_by) / 2]
      const [c1_fx, c1_fy] = [(c1_bx + c1_cx) / 2, (c1_by + c1_cy) / 2]
      const [c1_gx, c1_gy] = [(c1_cx + c1_dx) / 2, (c1_cy + c1_dy) / 2]

      const [c1_hx, c1_hy] = [(c1_ex + c1_fx) / 2, (c1_ey + c1_fy) / 2]
      const [c1_ix, c1_iy] = [(c1_fx + c1_gx) / 2, (c1_fy + c1_gy) / 2]

      const [c1_jx, c1_jy] = [(c1_hx + c1_ix) / 2, (c1_hy + c1_iy) / 2]

      const [c2_ex, c2_ey] = [(c2_ax + c2_bx) / 2, (c2_ay + c2_by) / 2]
      const [c2_fx, c2_fy] = [(c2_bx + c2_cx) / 2, (c2_by + c2_cy) / 2]
      const [c2_gx, c2_gy] = [(c2_cx + c2_dx) / 2, (c2_cy + c2_dy) / 2]

      const [c2_hx, c2_hy] = [(c2_ex + c2_fx) / 2, (c2_ey + c2_fy) / 2]
      const [c2_ix, c2_iy] = [(c2_fx + c2_gx) / 2, (c2_fy + c2_gy) / 2]

      const [c2_jx, c2_jy] = [(c2_hx + c2_ix) / 2, (c2_hy + c2_iy) / 2]

      intersect_curves(t0, (t0 + t1) / 2,
        c1_ax, c1_ay, c1_ex, c1_ey, c1_hx, c1_hy, c1_jx, c1_jy,
        c2_ax, c2_ay, c2_ex, c2_ey, c2_hx, c2_hy, c2_jx, c2_jy,
        intersections)
      intersect_curves(t0, (t0 + t1) / 2,
        c1_ax, c1_ay, c1_ex, c1_ey, c1_hx, c1_hy, c1_jx, c1_jy,
        c2_jx, c2_jy, c2_ix, c2_iy, c2_gx, c2_gy, c2_dx, c2_dy,
        intersections)
      intersect_curves((t0 + t1) / 2, t1,
        c1_jx, c1_jy, c1_ix, c1_iy, c1_gx, c1_gy, c1_dx, c1_dy,
        c2_ax, c2_ay, c2_ex, c2_ey, c2_hx, c2_hy, c2_jx, c2_jy,
        intersections)
      intersect_curves((t0 + t1) / 2, t1,
        c1_jx, c1_jy, c1_ix, c1_iy, c1_gx, c1_gy, c1_dx, c1_dy,
        c2_jx, c2_jy, c2_ix, c2_iy, c2_gx, c2_gy, c2_dx, c2_dy,
        intersections)
    }
  }
}

/**
 * Private function
 */
export function rigid<T>(x: T): T extends { (...args: any[]): any } ? ReturnType<T> : T {
  if (typeof x === 'function') {
    return x()
  } else {
    return x as T extends { (...args: any[]): any } ? ReturnType<T> : T
  }
}

