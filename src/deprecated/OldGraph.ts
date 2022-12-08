import { Event } from '../lib/Event'
import { algPhaseFunc, optFunc, WithOptions } from "../lib/Options"
import { find } from "../lib/Types"
import { Digraph } from '../model/Digraph'
import { EdgeDirection } from '../model/Edge'
import { AlgorithmRegister, AlgorithmRegistrable } from './AlgorithmRegistrable'
import { Cluster } from "./Cluster"
import { Node } from './Node'
import { OldEdge, OldEdgeOptions, OldEdgeTikzOptions } from "./OldEdge"

type IOldGraphAlgorithm = { graph: OldGraph }

type OldGraphOptions = {}

interface IOldGraph {
  nodes: Node[]
  edges: OldEdge[]
  clusters: Cluster[]
  events: Event[]
}

type GraphAlgorithmData = {
  loops?: OldEdge[],
  collapsed_edges?: Map<OldEdge, OldEdge[]>,
}

export class OldGraph implements WithOptions<OldGraphOptions>, IOldGraph, AlgorithmRegistrable<GraphAlgorithmData> {
  nodes: Node[]
  edges: OldEdge[]
  clusters: Cluster[]
  events: Event[]

  orig_digraph?: Digraph

  _options: OldGraphOptions
  _options_proxy?: OldGraphOptions

  constructor({
    nodes, edges, clusters, events
  }: Partial<IOldGraph> = {}) {
    this.nodes = nodes ?? []
    this.edges = edges ?? []
    this.clusters = clusters ?? []
    this.events = events ?? []

    this._options = {}
  }

  option = optFunc<OldGraphOptions>()
  option_algorithm_phase = algPhaseFunc<OldGraphOptions>()

  algorithm_register: AlgorithmRegister<GraphAlgorithmData> = new WeakMap()

  registerAlgorithm(algorithm: IOldGraphAlgorithm): void {
    this.algorithm_register.set(algorithm, this.algorithm_register.get(algorithm) ?? {})

    for(const node of this.nodes) {
      node.registerAlgorithm(algorithm)
    }

    for(const edge of this.edges) {
      edge.registerAlgorithm(algorithm)
    }
  }

  getAlgorithmRecord(algorithm: IOldGraphAlgorithm): GraphAlgorithmData|undefined {
    return this.algorithm_register.get(algorithm)
  }

  copy() {
    const result = new OldGraph({ events: this.events })

    result._options = this._options
    result._options_proxy = this._options_proxy

    return result
  }

  addNode(node: Node) {
    if (!this.findNode(node.name)[0]) {
      if (node.index == null) {
        node.index = this.nodes.length
      }

      this.nodes.push(node)
    }
  }

  removeNode(node: Node) {
    const [_, index] = find(this.nodes, other => other.name === node.name)

    if (index != null) {
      this.nodes.splice(index, 1)
      return node
    } else {
      return null
    }
  }

  findNode(name?: string) {
    return this.findNodeIf(node => node.name === name)
  }

  findNodeIf(test: (node: Node) => boolean) {
    return find(this.nodes, test)
  }

  deleteNode(node: Node) {
    const n = this.removeNode(node)

    if (n) {
      for (const edge of n.edges) {
        this.removeEdge(edge)
        for (const other_node of edge.nodes) {
          if (other_node.name !== n.name) {
            other_node.removeEdge(edge)
          }
        }
      }
      n.edges = []
    }

    return n
  }

  findEdge(edge: OldEdge) {
    return find(this.edges, other => other === edge)
  }

  addEdge(edge: OldEdge) {
    if (!edge.index) {
      edge.index = this.edges.length
    }

    this.edges.push(edge)
  }

  removeEdge(edge: OldEdge) {
    const [_, index] = find(this.edges, other => other === edge)
    if(index != null) {
      this.edges.splice(index, 1)
      return edge
    } else {
      return null
    }
  }

  deleteEdge(edge: OldEdge) {
    const e = this.removeEdge(edge)
    if(e) {
      for(const node of e.nodes) {
        node.removeEdge(edge)
      }
    } 
    return e
  } 

  deleteEdgeBetweenNodes(from: Node, to: Node) {
    const [ edge ] = find(this.edges, edge => edge.nodes[0] === from && edge.nodes[1] === to)

    if(edge) {
      return this.deleteEdge(edge)
    } else {
      return null
    }
  }

  createEdge(
    first_node: Node, second_node: Node,
    direction: EdgeDirection,
    edge_nodes?: string,
    options?: OldEdgeOptions,
    options_proxy?: OldEdgeOptions,
    tikz_options?: OldEdgeTikzOptions,
  ) {
    const edge = new OldEdge({ direction, edge_nodes, tikz_options })
    if(options) edge._options = options
    edge._options_proxy = options_proxy

    edge.addNode(first_node)
    edge.addNode(second_node)
    this.addEdge(edge)
    
    return edge
  }

  findClusterByName(name: string) {
    return find(this.clusters, cluster => cluster.name === name)
  }

  addCluster(cluster: Cluster) {
    if(!this.findClusterByName(cluster.name)) {
      this.clusters.push(cluster)
    }
  }

  /**
   * @internal
   */
  __debug() {
    return {
      nodes: this.nodes.map(n => n.__debug()),
      edges: this.edges.map(e => e.__debug()),
    }
  }
}
