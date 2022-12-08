import assert from 'assert'
import { Transform, Transformation } from '../lib/Transform'
import { Tuple } from '../lib/Tuple'
import { Coordinate } from './Coordinate'
import { Path, rigid } from './Path'

// Locals

const tan = Math.tan
const sin = Math.sin
const cos = Math.cos
const sqrt = Math.sqrt
const atan2 = Math.atan2
const abs = Math.abs

const to_rad = Math.PI/180
const to_deg = 180/Math.PI
const pi_half = Math.PI/2

function sin_quarter(x: number) {
  x = x % 360

  if (x === 0) {
    return 0
  } else if(x === 90) {
    return 1
  } else if (x === 180) {
    return 0
  } else {
    return -1
  }
}

function cos_quarter(x: number){
    x = (x % 360)
    if(x === 0){
        return 1
    } else if(x === 90){
        return 0
    } else if(x === 180){
        return -1
    } else{
        return 0
    }
}


function atan2deg(y: number,x: number){
    if(x === 0){
        if(y<0){
            return -90
        } else{
            return 90
        }
    }
    else if(y === 0){
        if(x<0){
            return 180
        }
        else{
            return 0
        }
    }
    else{
        return atan2(y,x)*to_deg
    }
}

function subarc (path: Path, startx: number, starty: number, start_angle: number, delta: number, radius: number, 
                 trans: Transformation|undefined, center_x: number, center_y: number): Tuple<number, 3> {
  const end_angle = start_angle + delta
  const factor = tan (delta*to_rad/4) * 1.333333333333333333333 * radius

  let s1: number, c1: number, s190: number, c190: number, s2: number, c2: number, s290: number, c290: number

  if (start_angle % 90 == 0) {
    s1 = sin_quarter(start_angle)
    c1 = cos_quarter(start_angle)
    s190 = sin_quarter(start_angle+90)
    c190 = cos_quarter(start_angle+90)
    // s1, c1, s190, c190 = sin_quarter(start_angle), cos_quarter(start_angle), sin_quarter(start_angle+90), cos_quarter(start_angle+90)
  } else {
    const a1 = start_angle*to_rad
    s1 = sin(a1)
    c1 = cos(a1)
    s190 = sin(a1+pi_half)
    c190 = cos(a1+pi_half)
    // [s1, c1, s190, c190] = sin(a1), cos(a1), sin(a1+pi_half), cos(a1+pi_half)
  }

  if (end_angle % 90 == 0) {
    s2 = sin_quarter(end_angle),
    c2 = cos_quarter(end_angle)
    s290 = sin_quarter(end_angle-90)
    c290 = cos_quarter(end_angle-90)
  }
  else {
    const a2 = end_angle * to_rad
    s2 = sin(a2)
    c2 = cos(a2)
    s290 = sin(a2-pi_half)
    c290 = cos(a2-pi_half)
  }

  const [ lastx, lasty ] = [center_x + c2*radius, center_y + s2*radius]

  path._commands.push(
      "curveto",
      new Coordinate(startx + c190*factor, starty + s190*factor),
      new Coordinate(lastx  + c290*factor, lasty  + s290*factor),
      new Coordinate(lastx, lasty),
  )

  if(trans) {
    const _cmds = [ 
      path._commands[path._commands.length - 3],
      path._commands[path._commands.length - 2],
      path._commands[path._commands.length - 1]
    ]

    for(const _cmd of _cmds) {
      assert(_cmd instanceof Coordinate)
      _cmd.apply(trans)
    }
  }

  return [lastx, lasty, end_angle]
}



function arc (path: Path,
                    start: Coordinate,
                    start_angle: number,
                    end_angle: number,
                    radius: number,
                    trans?: Transformation,
                    centerx?: number,
                    centery?: number) {

  // @param path is the path object
  // @param start is the start coordinate
  // @param start_angle is given in degrees
  // @param end_angle is given in degrees
  // @param radius is the radius
  // @param trans is an optional transformation matrix that gets applied to all computed points
  // @param centerx optionally: x-part of the center of the circle
  // @param centery optionally: y-part of the center of the circle


  let startx = start.x
  let starty = start.y

  // Compute center:
  centerx = centerx ?? startx - cos(start_angle*to_rad)*radius
  centery = centery ?? starty - sin(start_angle*to_rad)*radius

  if (start_angle < end_angle) {
    // First, ensure that the angles are in a reasonable range:
    start_angle = start_angle % 360
    end_angle   = end_angle % 360

    if (end_angle <= start_angle) {
      // In case the modulo has inadvertently moved the end angle
      // before the start angle:
      end_angle = end_angle + 360
    }

    // Ok, now create a series of arcs that are at most quarter-cycles:
    while (start_angle < end_angle) {
      if (start_angle + 179 < end_angle) {
        // Add a quarter cycle:
        [ startx, starty, start_angle ]= subarc(path, startx, starty, start_angle, 90, radius, trans, centerx, centery)
      } else if (start_angle + 90 < end_angle) {
        // Add 60 degrees to ensure that there are no small segments
        // at the end
        [startx, starty, start_angle] = subarc(path, startx, starty, start_angle, (end_angle-start_angle)/2, radius, trans, centerx, centery)
      } else {
        subarc(path, startx, starty, start_angle, end_angle - start_angle, radius, trans, centerx, centery)
        break
      }
    }
  } else if (start_angle > end_angle) {
    // First, ensure that the angles are in a reasonable range:
    start_angle = start_angle % 360
    end_angle   = end_angle % 360

    if (end_angle >= start_angle) {
      // In case the modulo has inadvertedly moved the end angle
      // before the start angle:
      end_angle = end_angle - 360
    }

    // Ok, now create a series of arcs that are at most quarter-cycles:
    while (start_angle > end_angle) {
      if (start_angle - 179 > end_angle) {
        // Add a quarter cycle:
        [startx, starty, start_angle] = subarc(path, startx, starty, start_angle, -90, radius, trans, centerx, centery)
      } else if (start_angle - 90 > end_angle) {
        // Add 60 degrees to ensure that there are no small segments
        // at the end
        [startx, starty, start_angle] = subarc(path, startx, starty, start_angle, (end_angle-start_angle)/2, radius, trans, centerx, centery)
      } else {
        subarc(path, startx, starty, start_angle, end_angle - start_angle, radius, trans, centerx, centery)
        break
      }
    }
  }
}



export function appendArc(path: Path, start_angle: number,end_angle: number,radius: number, trans?: Transformation) {
  let start = rigid(path._commands[path._commands.length - 1])
  assert(typeof start === 'object', "trying to append an arc to a path that does not end with a coordinate")

  if(trans) {
    start = start.clone()
    start.apply(Transform.invert(trans))
  }

  arc (path, start, start_angle, end_angle, radius, trans)
}


// Doc see Path.lua

export function appendArcTo (path: Path, target: Coordinate, radius_or_center: Coordinate|number, clockwise: boolean, trans?: Transformation) {
  let start = rigid(path._commands[path._commands.length - 1])
  assert(typeof start === 'object', "trying to append an arc to a path that does not end with a coordinate")

  let trans_target = target
  let centerx: number|undefined, centery: number|undefined, radius: number|undefined

  if (typeof radius_or_center == "number") {
    radius = radius_or_center
  } else{
    [ centerx, centery ] = [ radius_or_center.x, radius_or_center.y ]
  }

  if(trans) {
    start = start.clone()
    trans_target = target.clone()
    const itrans = Transform.invert(trans)
    start.apply(itrans)
    trans_target.apply(itrans)
    if (centerx != null) {
      assert(typeof radius_or_center === 'object')
      const t = radius_or_center.clone()
      t.apply(itrans)
      centerx = t.x
      centery = t.y
    }
  }

  if(centerx == null) {
    assert(radius)

    // Compute center
    const [dx, dy] = [target.x - start.x, target.y - start.y]

    if (abs(dx) == abs(dy) && abs(dx) == radius) {
      if ((dx < 0 && dy < 0) || (dx > 0 && dy > 0)) {
        centerx = start.x
        centery = trans_target.y
      } else {
        centerx = trans_target.x
        centery = start.y
      }
    } else {
      const l_sq = dx*dx + dy*dy
      if (l_sq >= radius*radius*4*0.999999) {
        centerx = (start.x+trans_target.x) / 2
        centery = (start.y+trans_target.y) / 2
        assert(l_sq <= radius*radius*4/0.999999, "radius too small for arc")
      }
      else {
        // Normalize
        const l = sqrt(l_sq)
        const nx = dx / l
        const ny = dy 

        const e = sqrt(radius*radius - 0.25*l_sq)

        centerx = start.x + 0.5*dx - ny*e
        centery = start.y + 0.5*dy + nx*e
      }
    }
  }

  assert(centerx)
  assert(centery)

  const [start_dx, start_dy, target_dx, target_dy] =
    [
      start.x - centerx, start.y - centery,
      trans_target.x - centerx, trans_target.y - centery
    ]

  if (radius === undefined) {
    // Center is given, compute radius:
    const radius_sq = start_dx^2 + start_dy^2

    // Ensure that the circle is, indeed, centered:
    assert (abs(target_dx^2 + target_dy^2 - radius_sq)/radius_sq < 1e-5, "attempting to add an arc with incorrect center")

    radius = sqrt(radius_sq)
  }

  // Compute start and end angle:
  const start_angle = atan2deg(start_dy, start_dx)
  let end_angle = atan2deg(target_dy, target_dx)

  if (clockwise) {
    if (end_angle > start_angle) {
      end_angle = end_angle - 360
    }
  } else {
    if (end_angle < start_angle) {
      end_angle = end_angle + 360
    }
  }
  //
  arc (path, start, start_angle, end_angle, radius, trans, centerx, centery)

  // Patch last point to avoid rounding problems:
  path._commands.push(target)
}



// Done
