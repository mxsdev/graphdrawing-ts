import assert from "assert"
import { Vector } from "../deprecated/Vector"
import { find } from "../lib/Types"

type InteractionCellTestFunc = (cell: Cell, particle: IParticle) => boolean

interface IParticle {
  pos: Vector,
  mass: number,
  subparticles: IParticle[],
}

class Particle implements IParticle {
  subparticles: Particle[] = []
  constructor(public pos: Vector, public mass: number) { }
}

interface ICell {
  x: number, y: number,
  width: number, height: number,
  max_particles: number,
  subcells: ICell[], particles: IParticle[],
  center_of_mass?: Vector,
  mass: number
}

class Cell implements ICell {
  subcells: Cell[] = []
  particles: Particle[] = []
  center_of_mass?: Vector
  mass: number = 0

  constructor(public x: number, public y: number, public width: number, public height: number, public max_particles: number = 1) { }

  containsParticle(particle: IParticle) {
    return particle.pos.x >= this.x && particle.pos.x <= this.x + this.width &&
      particle.pos.y >= this.y && particle.pos.y <= this.y + this.height
  }

  findSubcell(particle: IParticle) {
    return find(this.subcells, cell => cell.containsParticle(particle))
  }

  createSubcells() {
    assert(this.subcells.length === 0)
    assert(this.particles.length <= this.max_particles)

    if (this.subcells.length === 0) {
      for (const x of [this.x, this.x + this.width / 2]) {
        for (const y of [this.y, this.y + this.height / 2]) {
          const cell = new Cell(x, y, this.width / 2, this.height / 2, this.max_particles)
          this.subcells.push(cell)
        }
      }
    }
  }

  insert(particle: Particle) {
    const [found] = find(this.particles, (other) => other.pos.equals(particle.pos))

    if (found) {
      found.subparticles.push(particle)
    } else {
      if (this.subcells.length === 0 && this.particles.length < this.max_particles) {
        this.particles.push(particle)
      } else {
        if (this.subcells.length === 0) {
          this.createSubcells()
        }

        // move particles to the new subcells
        for (const existing of this.particles) {
          const [cell] = this.findSubcell(existing)
          assert(cell, `failed to find a cell for particle ${existing.pos.toString()}`)
          cell.insert(existing)
        }

        this.particles = []

        const [cell] = this.findSubcell(particle)
        assert(cell)
        cell.insert(particle)
      }
    }

    this.updateMass()
    this.updateCenterOfMass()

    assert(this.mass != null)
    assert(this.center_of_mass != null)
  }

  updateMass() {
    this.mass = 0

    if (this.subcells.length === 0) {
      for (const particle of this.particles) {
        this.mass += particle.mass
        for (const subparticle of particle.subparticles) {
          this.mass += subparticle.mass
        }
      }
    } else {
      for (const subcell of this.subcells) {
        this.mass += subcell.mass
      }
    }
  }

  updateCenterOfMass() {
    delete this.center_of_mass

    if(this.subcells.length === 0) {
      this.center_of_mass = new Vector(2)
      for(const p of this.particles) {
        for(const sp of p.subparticles) {
          this.center_of_mass = this.center_of_mass.plus(sp.pos.timesScalar(sp.mass))
        }
        this.center_of_mass = this.center_of_mass.plus(p.pos.timesScalar(p.mass))
      }
      this.center_of_mass = this.center_of_mass.dividedByScalar(this.mass)
    } else {
      this.center_of_mass = new Vector(2)
      for(const sc of this.subcells) {
        if(sc.center_of_mass) {
          this.center_of_mass = this.center_of_mass.plus(sc.center_of_mass.timesScalar(sc.mass))
        } else {
          assert(sc.mass === 0)
        }
      }
      this.center_of_mass = this.center_of_mass.dividedByScalar(this.mass)
    }
  }

  findInteractionCells(particle: IParticle, test_func: InteractionCellTestFunc, cells: ICell[]) {
    if(this.subcells.length === 0 || test_func(this, particle)) {
      cells.push(this)
    } else {
      for(const subcell of this.subcells) {
        subcell.findInteractionCells(particle, test_func, cells)
      }
    }
  }

  toString() {
    return `((${this.x}, ${this.y}) to (${this.x + this.width}, ${this.y + this.height}))${this.center_of_mass && `mass ${this.mass} at ${this.center_of_mass.toString()}`}`
  }
}

export class QuadTree {
  root_cell: Cell

  constructor(x: number, y: number, width: number, height: number, max_particles?: number) {
    this.root_cell = new Cell(x, y, width, height, max_particles)
  }

  insert(particle: Particle) {
    this.root_cell.insert(particle)
  }

  findInteractionCells(particle: IParticle, test_func?: InteractionCellTestFunc, cells?: ICell[]) {
    cells = cells ?? []

    this.root_cell.findInteractionCells(particle, test_func ?? (() => true), cells)

    return cells
  }
}
