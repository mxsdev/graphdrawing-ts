import { algPhaseFunc, optFunc, WithOptions } from '../lib/Options'
import { removeEl } from '../lib/Types'
import { Vertex } from '../model/Vertex'
import { AlgorithmRegister, AlgorithmRegistrable } from './AlgorithmRegistrable'
import { OldEdge } from './OldEdge'
import { OldGraph } from './OldGraph'
import { Vector } from './Vector'

type IOldGraphAlgorithm = { graph: OldGraph }

type NodeOptions = {}

export interface TeXNodeInfo {
  texNode?: any
  maxX?: number
  minX?: number
  maxY?: number
  minY?: number
  shape?: string
}
 
type NodeKind = 'node'|'dummy'

interface INode {
  name?: string
  tex: TeXNodeInfo
  edges: OldEdge[]
  kind: NodeKind
  pos: Vector
  index?: number
  event_index?: number
  orig_node?: Node
  weight?: number
  subnodes?: Node[]
  subnode_edge?: OldEdge
  level?: number
  fixed?: boolean
}

type NodeAlgorithmData = { }

export class Node implements WithOptions<NodeOptions>, INode, AlgorithmRegistrable<NodeAlgorithmData> {
  _options: NodeOptions
  _options_proxy?: NodeOptions

  tex: TeXNodeInfo
  kind: NodeKind
  pos: Vector
  edges: OldEdge[]
  name?: string

  index?: number
  event_index?: number

  orig_vertex?: Vertex
  orig_node?: Node
  aux_node?: Node
  orig_edge?: OldEdge

  weight?: number
  subnodes?: Node[]
  subnode_edge?: OldEdge
  level?: number
  fixed?: boolean
  
  constructor({fixed, level, subnode_edge, subnodes, weight, tex = {}, kind = 'node', edges = [], name, pos, index, event_index, orig_node }: Partial<INode> = { }) {
    this.tex = tex
    this.kind = kind
    this.edges = edges
    this.pos = pos ?? new Vector(2)
    this.name = name

    this.index = index
    this.event_index = event_index

    this.orig_node = orig_node
    this.weight = weight
    this.subnodes = subnodes
    this.subnode_edge = subnode_edge
    this.level = level
    this.fixed = fixed

    this._options = { }
  }

  option = optFunc<NodeOptions>()
  option_algorithm_phase = algPhaseFunc<NodeOptions>()

  algorithm_register: AlgorithmRegister<NodeAlgorithmData> = new WeakMap()

  registerAlgorithm(algorithm: IOldGraphAlgorithm): void {
    this.algorithm_register.set(algorithm, this.algorithm_register.get(algorithm) ?? {})
  }

  getAlgorithmRecord(algorithm: IOldGraphAlgorithm): NodeAlgorithmData|undefined {
    return this.algorithm_register.get(algorithm)
  }

  getTexWidth() {
    return Math.abs((this.tex.maxX ?? 0) - (this.tex.minX ?? 0))
  }

  getTexHeight() {
    return Math.abs((this.tex.maxY ?? 0) - (this.tex.minY ?? 0))
  } 

  addEdge(edge: OldEdge) {
    this.edges.push(edge)
  }

  removeEdge(edge: OldEdge) {
    removeEl(this.edges, edge, false)
  }

  getDegree() {
    return this.edges.length
  }

  getEdges() {
    return this.edges
  }

  getIncomingEdges(ignore_reversed?: boolean): OldEdge[] {
    return this.edges.filter(e => e.isHead(this, ignore_reversed))
  }

  getOutgoingEdges(ignore_reversed?: boolean): OldEdge[] {
    return this.edges.filter(e => e.isTail(this, ignore_reversed))
  }

  getInDegree(ignore_reversed?: boolean) {
    return this.getIncomingEdges(ignore_reversed).length
  }

  getOutDegree(ignore_reversed?: boolean) {
    return this.getOutgoingEdges(ignore_reversed).length
  }

  copy(): Node {
    const result = new Node(this)

    result.edges = []

    result._options = this._options
    result._options_proxy = this._options_proxy

    return result
  }

  equals(node: Node) {
    if(this === node) return true

    return this.name === node.name
  }

  /**
   * @internal
   */
  __debug() {
    return [ this.name, this.pos.x, this.pos.y ]
  }
}
