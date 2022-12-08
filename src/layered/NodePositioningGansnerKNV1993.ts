import assert from "assert"
import { Node } from "../deprecated/Node"
import { OldEdge } from "../deprecated/OldEdge"
import { OldGraph } from "../deprecated/OldGraph"
import { layered } from "../layered"
import { AbstractGraphAlgorithm } from "../lib/Algorithm"
import { Storage } from "../lib/Storage"
import { denull } from "../lib/Types"
import { Vertex } from "../model/Vertex"
import { NetworkSimplex, NetworkSimplexBalancing } from "./NetworkSimplex"
import util from 'util'

export class NodePositioningGansnerKNV1993 extends AbstractGraphAlgorithm {
  run() {
    const auxiliary_graph = this.constructAuxiliaryGraph()

    const simplex = new NetworkSimplex(auxiliary_graph, NetworkSimplexBalancing.BALANCE_LEFT_RIGHT)
    simplex.run()
    const x_ranking = simplex.ranking

    const layers: Storage<Vertex, number> = new WeakMap()

    assert(this.ranking)

    const ranks = this.ranking.getRanks()
    for(const rank of ranks) {
      const nodes = this.ranking.getNodes(rank)
      for(const node of nodes) {
        assert(node.aux_node)
        assert(node.orig_vertex)

        node.pos.x = denull(x_ranking.getRank(node.aux_node))
        layers.set(node.orig_vertex, rank)
      }
    }

    assert(this.main_algorithm && this.main_algorithm.adjusted_bb && this.main_algorithm.ugraph)
    layered.arrange_layers_by_baselines(layers, this.main_algorithm.adjusted_bb, this.main_algorithm.ugraph)

    for(const rank of ranks) {
      const nodes = this.ranking.getNodes(rank)
      for(const node of nodes) {
        assert(node.orig_vertex)
        node.pos.y = node.orig_vertex.pos.y
      }
    }
  }

  constructAuxiliaryGraph(): OldGraph {
    const aux_graph = new OldGraph()

    assert(this.graph)

    for(const node of this.graph.nodes) {
      const copy = new Node({
        name: node.name,
        orig_node: node,
      })

      node.aux_node = copy
      aux_graph.addNode(copy)
    }

    ;[...this.graph.edges].reverse().forEach(edge => {
      const node = new Node({
        name: `{${edge.toString()}}`,
      })

      aux_graph.addNode(node)

      node.orig_edge = edge

      const head = edge.getHead()
      const tail = edge.getTail()

      assert(tail.aux_node && head.aux_node)

      const tail_edge = new OldEdge({
        direction: '->',
        minimum_levels: 0,
        weight: denull(edge.weight) * this.getOmega(edge)
      })
      tail_edge.addNode(node)
      tail_edge.addNode(tail.aux_node)
      aux_graph.addEdge(tail_edge)

      const head_edge = new OldEdge({
        direction: '->',
        minimum_levels: 0,
        weight: denull(edge.weight) * this.getOmega(edge)
      })
      head_edge.addNode(node)
      head_edge.addNode(head.aux_node)
      aux_graph.addEdge(head_edge)
    })

    assert(this.ranking)
    const ranks = this.ranking.getRanks()
    for(const rank of ranks) {
      const nodes = this.ranking.getNodes(rank)
      for(let n = 0; n <= nodes.length-2; n++) {
        const v = nodes[n]
        const w = nodes[n+1]

        assert(v.aux_node)
        assert(w.aux_node)

        const separator_edge = new OldEdge({
          direction: '->',
          minimum_levels: this.getDesiredHotizontalDistance(v, w),
          weight: 0,
        })
        separator_edge.addNode(v.aux_node)
        separator_edge.addNode(w.aux_node)
        aux_graph.addEdge(separator_edge)
      }
    }

    return aux_graph
  }

  getOmega(edge: OldEdge) {
    assert(edge.nodes.length >= 2)
    
    const node1 = edge.nodes[0]
    const node2 = edge.nodes[1]

    if((node1.kind === 'dummy') && (node2.kind === 'dummy')) {
      return 8
    } else if(node1.kind === 'dummy' || node2.kind === 'dummy') {
      return 2
    } else {
      return 1
    }
  }

  getDesiredHotizontalDistance(v: Node, w: Node) {
    assert(this.main_algorithm)
    assert(this.main_algorithm.adjusted_bb)
    assert(this.graph)
    assert(this.graph.orig_digraph)
    assert(v.orig_vertex && w.orig_vertex)

    return layered.ideal_sibling_distance(this.main_algorithm.adjusted_bb, this.graph.orig_digraph, v.orig_vertex, w.orig_vertex)
  }
}
