import assert from "assert"
import { OldGraph } from "../deprecated/OldGraph"
import { Node } from "../deprecated/Node"
import { Vector } from "../deprecated/Vector"
import { AbstractGraphAlgorithm } from "../lib/Algorithm"
import { PathLengths } from "../lib/PathLengths"
import { randomBounded } from "../lib/Random"
import { CoarseGraph } from "./CoarseGraph"
import type Declarations from "./library"
import { denull } from "../lib/Types"

type Decl = typeof Declarations

type SpringGrowthDirection = 'fixed'

type StepUpdateFunc = (step_length: number, cooling_factor: number, energy: number, old_energy: number, progress: number) => [ step_length: number, progress: number ]

const conservative_step_update: StepUpdateFunc = (step, cooling_factor, energy, old_energy, progress) => {
  return [cooling_factor * step, progress]
}

const adaptive_step_update: StepUpdateFunc = (step, cooling_factor, energy, old_energy, progress) => {
  if(energy < old_energy) {
    progress++
    if(progress >= 5) {
      progress = 0
      step /= cooling_factor
    }
  } else {
    progress = 0
    step *= cooling_factor
  }
  return [ step, progress ]
}

class SpringHu2006 extends AbstractGraphAlgorithm {
  iterations!: number
  cooling_factor!: number
  initial_step_length!: number
  convergence_tolerance!: number

  natural_spring_length!: number

  coarsen!: boolean
  downsize_ratio!: number
  minimum_graph_size!: number

  graph_size!: number
  graph_density!: number

  growth_direction?: SpringGrowthDirection

  run() {
    assert(this.graph)

    const option = this.digraph.option.bind(this.digraph)

    this.iterations = option<Decl, 'iterations'>('iterations')
    this.cooling_factor = option<Decl, 'cooling factor'>('cooling factor')
    this.initial_step_length = option<Decl, 'initial step length'>('initial step length')
    this.convergence_tolerance = option<Decl, 'convergence tolerance'>('convergence tolerance')

    this.natural_spring_length = option<Decl, 'node distance'>('node distance')

    this.coarsen = option<Decl, 'coarsen'>('coarsen')
    this.downsize_ratio = option<Decl, 'downsize ratio'>('downsize ratio')
    this.minimum_graph_size = option<Decl, 'minimum coarsening size'>('minimum coarsening size')

    this.downsize_ratio = Math.max(0, Math.min(1, Number(this.downsize_ratio)))

    this.graph_size = this.graph.nodes.length
    this.graph_density = (2 * this.graph.edges.length) / (this.graph.nodes.length * (this.graph.nodes.length - 1))

    assert(this.iterations >= 0, `iterations (value: ${this.iterations}) needs to be greater than 0`)
    assert(this.cooling_factor >= 0 && this.cooling_factor <= 1, `the cooling factor (value: ${this.cooling_factor}) needs to be greater than or equal to 0`)
    assert(this.initial_step_length >= 0, `the initial step length (value: ${this.initial_step_length}) needs to be greater than or equal to 0`)
    assert(this.convergence_tolerance >= 0, `the convergence tolerance (value: ${this.convergence_tolerance}) needs to be greater than or equal to 0`)
    assert(this.natural_spring_length >= 0, `the convergence tolerance (value: ${this.natural_spring_length}) needs to be greater than or equal to 0`)
    assert(this.downsize_ratio >= 0 && this.downsize_ratio <= 1, `the convergence tolerance (value: ${this.downsize_ratio}) needs to be between 0 and 1`)
    assert(this.minimum_graph_size >= 2, `the convergence tolerance (value: ${this.minimum_graph_size}) needs to be greater than 2`)

    for (const node of this.graph.nodes) {
      node.weight = 1
    }

    for (const edge of this.graph.edges) {
      edge.weight = 1
    }

    const coarse_graph = new CoarseGraph(this.random, this.graph)

    if (this.coarsen) {
      while (coarse_graph.getSize() > this.minimum_graph_size && coarse_graph.getRatio() <= (1 - this.downsize_ratio)) {
        coarse_graph.coarsen()
      }
    }

    if (this.coarsen) {
      let spring_length = this.natural_spring_length

      this.computeInitialLayout(coarse_graph.getGraph(), spring_length)

      spring_length = 0
      for (const edge of coarse_graph.getGraph().edges) {
        assert(edge.nodes.length >= 2)
        spring_length += edge.nodes[0].pos.minus(edge.nodes[1].pos).norm()
      }
      spring_length /= coarse_graph.getGraph().edges.length

      if (coarse_graph.getSize() > 2) {
        this.computeForceLayout(coarse_graph.getGraph(), spring_length, adaptive_step_update)
      }

      let ct = 0
      while(coarse_graph.getLevel() > 0) {
        const [parent_diameter] = PathLengths.pseudoDiameter(coarse_graph.getGraph())

        coarse_graph.interpolate()

        const [current_diameter] = PathLengths.pseudoDiameter(coarse_graph.getGraph())

        // This code is unreachable in the original version, for some reason...
        // for(const node of coarse_graph.getGraph().nodes) {
        //   node.pos.update((_, value) => value * (current_diameter / parent_diameter))
        // }

        this.computeForceLayout(coarse_graph.getGraph(), spring_length, conservative_step_update)
        ct++
      }
    } else {
      this.computeInitialLayout(coarse_graph.getGraph(), this.natural_spring_length)

      let spring_length = 0
      for(const edge of coarse_graph.getGraph().edges) {
        assert(edge.nodes.length >= 2)
        spring_length += edge.nodes[0].pos.minus(edge.nodes[1].pos).norm()
      }
      spring_length /= coarse_graph.getGraph().edges.length

      this.computeForceLayout(coarse_graph.getGraph(), spring_length, adaptive_step_update)
    }

    let avg_spring_length =0
    for(const edge of this.graph.edges) {
      assert(edge.nodes.length >= 2)
      avg_spring_length += edge.nodes[0].pos.minus(edge.nodes[1].pos).norm()
    }
    avg_spring_length /= this.graph.edges.length
  }

  computeInitialLayout(graph: OldGraph, spring_length: number) {
    this.fixateNodes(graph)

    if (graph.nodes.length === 2) {
      const n1 = graph.nodes[0]
      const n2 = graph.nodes[1]
      if (!(n1.fixed && n2.fixed)) {
        const fixed_index = n2.fixed ? 1 : 0
        const loose_index = n2.fixed ? 0 : 1

        if (!n1.fixed && !n2.fixed) {
          n1.pos.x = 0
          n1.pos.y = 0
        }

        const direction = new Vector([
          randomBounded(this.random, 1, spring_length),
          randomBounded(this.random, 1, spring_length),
        ])

        const distance = 1.8 * spring_length * this.graph_density * Math.sqrt(this.graph_size) / 2
        const displacement = direction.normalized().timesScalar(distance)

        graph.nodes[loose_index].pos = graph.nodes[fixed_index].pos.plus(displacement)
      } else { }
    } else {
      const positioning_func = () => {
        const radius = 2 * spring_length * this.graph_density * Math.sqrt(this.graph_size) / 2
        return randomBounded(this.random, -radius, radius)
      }

      for (const node of graph.nodes) {
        if (!node.fixed) {
          node.pos.x = positioning_func()
          node.pos.y = positioning_func()
        }
      }
    }
  }

  computeForceLayout(graph: OldGraph, spring_length: number, step_update_func: StepUpdateFunc) {
    const repulsive_force = (distance: number, graph_distance: number, weight?: number) =>
      (distance - (spring_length * graph_distance))

    this.fixateNodes(graph)

    let step_length = this.initial_step_length === 0 ? spring_length : this.initial_step_length

    let converged = false
    let energy = Number.POSITIVE_INFINITY
    let iteration = 0
    let progress = 0 

    const distances = PathLengths.floydWarshall(graph)

    while(!converged && iteration < this.iterations) {
      const old_positions = graph.nodes.reduce((prev, node) => {
        prev.set(node, node.pos.copy())
        return prev
      }, new WeakMap<Node, Vector>())

      let old_energy = energy
      energy = 0

      for(const v of graph.nodes) {
        if(!v.fixed) {
          let d = new Vector(2)

          for(const u of graph.nodes) {
            if(v !== u) {
              const delta = u.pos.minus(v.pos)

              if(delta.norm() < 0.1) {
                delta.update(() => 0.1 + randomBounded(this.random) + 0.1)
              }

              const floyd_uv = distances.get(u)?.get(v)
              const graph_distance = floyd_uv ?? graph.nodes.length + 1

              const force = delta.normalized().timesScalar(
                repulsive_force(delta.norm(), graph_distance, v.weight)
              )

              d = d.plus(force)
            }
          }

          v.pos = v.pos.plus(d.normalized().timesScalar(step_length))

          energy += Math.pow(d.norm(), 2)
        }
      }

      ;[ step_length, progress ] = step_update_func(step_length, this.cooling_factor, energy, old_energy, progress)

      let max_movement = 0
      for(const x of graph.nodes) {
        const delta = x.pos.minus(denull(old_positions.get(x)))
        max_movement = Math.max(delta.norm(), max_movement)
      }

      if(max_movement < spring_length * this.convergence_tolerance) {
        converged = true
      }

      iteration++
    }
  }

  fixateNodes(graph: OldGraph) {
    let number_of_fixed_nodes = 0

    for (const node of graph.nodes) {
      const coordinate = node.option('desired at')

      if (coordinate) {
        node.pos.x = coordinate.x
        node.pos.y = coordinate.y

        node.fixed = true

        number_of_fixed_nodes++
      }
    }

    if (number_of_fixed_nodes > 1) {
      this.growth_direction = 'fixed'
    }
  }
}

const Declare = {
  "spring Hu 2006 layout": {
    // key      : "spring Hu 2006 layout",
    algorithm: SpringHu2006,

    preconditions: {
      connected: true,
      loop_free: true,
      simple: true,
    },

    old_graph_model: true,

    summary: `"
      Implementation of a spring graph drawing algorithm based on
      a paper by Hu.
    "`,
    documentation: `"
      \\begin{itemize}
        \\item
          Y. Hu.
          \\newblock Efficient, high-quality force-directed graph drawing.
          \\newblock \\emph{The Mathematica Journal}, 2006.
      \\end{itemize}

      There are some modifications compared to the original algorithm,
      see the Diploma thesis of Pohlmann for details.
    "`
  },
} as const

export default Declare
