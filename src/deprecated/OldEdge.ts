import { algPhaseFunc, optFunc, WithOptions } from "../lib/Options"
import { find } from "../lib/Types"
import type { Edge, EdgeDirection } from "../model/Edge"
import { AlgorithmRegister, AlgorithmRegistrable } from "./AlgorithmRegistrable"
import { Node } from './Node'
import { OldGraph } from "./OldGraph"
import { Vector } from "./Vector"

type IOldGraphAlgorithm = { graph: OldGraph }

export type OldEdgeOptions = { }
export type OldEdgeTikzOptions = { }

interface IOldEdge {
  nodes: Node[]
  edge_nodes: string
  tikz_options: OldEdgeTikzOptions
  direction: EdgeDirection
  bend_points: Vector[]
  bend_nodes: Node[]
  reversed: boolean
  // algorithmically_generated_options
  index?: number
  event_index?: number
  minimum_levels?: number
  weight?: number
  subedges?: OldEdge[]
  level?: number
}

type EdgeAlgorithmData = { }

export class OldEdge implements WithOptions<OldEdgeOptions>, IOldEdge, AlgorithmRegistrable<EdgeAlgorithmData> {
  nodes: Node[]
  edge_nodes: string
  tikz_options: OldEdgeTikzOptions
  direction: EdgeDirection
  bend_points: Vector[]
  bend_nodes: Node[]
  reversed: boolean
  // algorithmically_generated_options
  index?: number
  event_index?: number
  minimum_levels?: number

  orig_m?: Edge
  weight?: number
  subedges?: OldEdge[]
  level?: number

  _options: OldEdgeOptions
  _options_proxy?: OldEdgeOptions

  constructor({ 
    level, subedges, nodes, edge_nodes, tikz_options, direction, bend_points, bend_nodes, reversed, index, event_index, minimum_levels, weight
    }: Partial<IOldEdge> = { }) {
      this.nodes = nodes ?? []
      this.edge_nodes = edge_nodes ?? ''
      this.tikz_options = tikz_options ?? {}
      this.direction = direction ?? '->'
      this.bend_points = bend_points ?? []
      this.bend_nodes = bend_nodes ?? []
      this.reversed = reversed ?? false

      this.index = index
      this.event_index = event_index
      this.minimum_levels = minimum_levels
      this.weight = weight
      this.subedges = subedges
      this.level = level

      this._options = { }
  }

  option = optFunc<OldEdgeOptions>()
  option_algorithm_phase = algPhaseFunc<OldEdgeOptions>()

  algorithm_register: AlgorithmRegister<EdgeAlgorithmData> = new WeakMap()

  registerAlgorithm(algorithm: IOldGraphAlgorithm): void {
    this.algorithm_register.set(algorithm, this.algorithm_register.get(algorithm) ?? {})
  }

  getAlgorithmRecord(algorithm: IOldGraphAlgorithm): EdgeAlgorithmData|undefined {
    return this.algorithm_register.get(algorithm)
  }

  isLoop() {
    return this.nodes.every((n) => n.equals(this.nodes[0]))
  }

  isHyperedge() {
    return this.getDegree() > 2
  }

  getNodes() {
    return this.nodes
  }

  getDirectedNodes() {
    return this.reversed ? [...this.nodes].reverse() : this.nodes
  }

  containsNode(node: Node) {
    return find(this.nodes, (other) => other === node)
  }

  addNode(node: Node) {
    this.nodes.push(node)
    node.addEdge(this)
  } 

  getNeighbour(node: Node) {
    if(node.equals(this.nodes[0])) {
      return this.nodes[this.nodes.length - 1]
    } else {
      return this.nodes[0]
    }
  }

  getDegree() {
    return this.nodes.length
  }

  getHead() {
    let head_index = (this.direction === '<-') ? 1 : this.nodes.length

    if(this.reversed) {
      head_index = (head_index === 1) ? this.nodes.length : 1 
    }

    return this.nodes[head_index - 1]
  }

  getTail() {
    let tail_index = (this.direction === '<-') ? this.nodes.length : 1

    if(this.reversed) {
      tail_index = (tail_index === 1) ? this.nodes.length : 1
    }

    return this.nodes[tail_index - 1]
  }

  isHead(node: Node, ignore_reversed?: boolean) {
    return this.getHead().name === node.name
  }

  isTail(node: Node, ignore_reversed?: boolean) {
    return this.getTail().name === node.name
  }

  toString(): string {
    const node_strings = this.nodes.map(({name}) => name ?? 'undefined')

    return (this.reversed ? [...node_strings].reverse() : node_strings).join(` ${this.direction} `)
  }

  copy(): OldEdge {
    const result = new OldEdge(this)

    result.nodes = []
    result._options = this._options
    result._options_proxy = this._options_proxy

    return result
  }

  /**
   * @internal
   */
  __debug() {
    return {
      nodes: this.getDirectedNodes().map(n => n.name),
      ...(this.weight != null && { weight: this.weight }),
      ...(this.minimum_levels != null && { minimum_levels: this.minimum_levels }),
    }
  }
}
