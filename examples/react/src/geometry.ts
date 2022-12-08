type Coordinate = { x: number, y: number }

function sub(c1: Coordinate, c2: Coordinate): Coordinate {
    return { x: c1.x - c2.x, y: c1.y - c2.y }
}

function add(c1: Coordinate, c2: Coordinate): Coordinate {
    return { x: c1.x + c2.x, y: c1.y + c2.y }
}

function mul(c: number, coord: Coordinate): Coordinate {
    return { x: c * coord.x, y: c * coord.y }
}

function len(c1: Coordinate): number {
  return Math.sqrt(c1.x*c1.x + c1.y*c1.y)
}

function distance(c1: Coordinate, c2: Coordinate) {
  return len(sub(c1, c2))
}

export function lerp(c1: Coordinate, c2: Coordinate, fac: number): Coordinate {
  return add(
    c1, 
    mul(
      fac,
      sub(c2, c1)
    )
  )
}

export function lerpDist(c1: Coordinate, c2: Coordinate, dist: number): Coordinate {
    return lerp(c1, c2, distToLerpFac(c1, c2, dist))
}

function distToLerpFac(c1: Coordinate, c2: Coordinate, dist: number): number {
    return dist/distance(c1, c2)
}