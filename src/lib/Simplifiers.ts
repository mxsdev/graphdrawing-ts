import assert from 'assert'
import { OldEdge } from '../deprecated/OldEdge'
import { OldGraph } from '../deprecated/OldGraph'
import { Node } from '../deprecated/Node'
import { IGraphAlgorithm,  } from './Algorithm'

type IOldGraphAlgorithm = { graph: OldGraph }

export namespace Simplifiers {
  export function classifyEdges(graph: OldGraph): [tree_and_forward_edges: OldEdge[], cross_edges: OldEdge[], back_edges: OldEdge[]] {
    const discovered: WeakSet<Node> = new WeakSet()
    const visited: WeakSet<Node> = new WeakSet()
    const recursed: WeakSet<Node> = new WeakSet()
    const completed: WeakSet<Node> = new WeakSet()

    const tree_and_forward_edges: OldEdge[] = []
    const cross_edges: OldEdge[] = []
    const back_edges: OldEdge[] = []

    const stack: Node[] = []

    const initial_nodes = graph.nodes

    ;[...initial_nodes].reverse().forEach(node => {
      stack.push(node)
      discovered.add(node)
    })

    while (stack.length > 0) {
      const node = stack[stack.length - 1]
      const edges_to_traverse: OldEdge[] = []

      visited.add(node)

      if (!recursed.has(node)) {
        recursed.add(node)

        const out_edges = node.getOutgoingEdges()
        for (const edge of out_edges) {
          const neighbour = edge.getNeighbour(node)

          if (!discovered.has(neighbour)) {
            tree_and_forward_edges.push(edge)
            edges_to_traverse.push(edge)
          } else {
            if (!completed.has(neighbour)) {
              if (!visited.has(neighbour)) {
                tree_and_forward_edges.push(edge)
                edges_to_traverse.push(edge)
              } else {
                back_edges.push(edge)
              }
            } else {
              cross_edges.push(edge)
            }
          }
        }

        if (edges_to_traverse.length === 0) {
          completed.add(node)
          stack.pop()
        } else {
          [...edges_to_traverse].reverse().forEach(e => {
            const neighbour = e.getNeighbour(node)
            discovered.add(neighbour)
            stack.push(neighbour)
          })
        }
      } else {
        completed.add(node)
        stack.pop()
      }
    }

    return [tree_and_forward_edges, cross_edges, back_edges]
  }

  export function removeLoopsOldModel(algorithm: {graph: OldGraph}) {
    const { graph } = algorithm

    const loops: OldEdge[] = []

    for (const edge of graph.edges) {
      if (edge.getHead() === edge.getTail()) {
        loops.push(edge)
      }
    }

    for (let i = 0; i < loops.length; i++) {
      graph.deleteEdge(loops[i])
    }

    const alg_data = graph.getAlgorithmRecord(algorithm)
    assert(alg_data)

    alg_data.loops = loops
  }

  export function restoreLoopsOldModel(algorithm: IOldGraphAlgorithm) {
    const { graph } = algorithm

    const alg_data = graph.getAlgorithmRecord(algorithm)
    assert(alg_data)

    assert(alg_data.loops)
    for (const edge of alg_data.loops) {
      graph.addEdge(edge)
      edge.getTail().addEdge(edge)
    }

    delete alg_data.loops
  }

  export function collapseMultiedgesOldModel(algorithm: { graph: OldGraph }, collapse_action?: (neighbour: OldEdge, edge: OldEdge, graph: OldGraph) => void) {
    const { graph } = algorithm
    const collapsed_edges: Map<OldEdge, OldEdge[]> = new Map()
    const node_processed: WeakSet<Node> = new WeakSet()

    for (const node of graph.nodes) {
      node_processed.add(node)

      const multiedge: Map<Node, OldEdge> = new Map()

      const handle_edge = (edge: OldEdge) => {
        const neighbour = edge.getNeighbour(node)

        if (!node_processed.has(neighbour)) {
          if (!multiedge.get(neighbour)) {
            const new_edge = new OldEdge({ direction: '->' })
            multiedge.set(neighbour, new_edge)
            collapsed_edges.set(new_edge, [])
          }

          if (collapse_action) {
            collapse_action(multiedge.get(neighbour)!, edge, graph)
          }

          const medge = multiedge.get(neighbour)
          assert(medge)

          collapsed_edges.get(medge)!.push(edge)
        }
      }

      for (const edge of node.getIncomingEdges()) {
        handle_edge(edge)
      }

      for (const edge of node.getOutgoingEdges()) {
        handle_edge(edge)
      }

      for (const [neighbour, medge] of multiedge.entries()) {
        const medge_collapsed = collapsed_edges.get(medge)
        assert(medge_collapsed)

        if (medge_collapsed.length <= 1) {
          collapsed_edges.delete(medge)
        } else {
          for (const subedge of medge_collapsed) {
            graph.deleteEdge(subedge)
          }

          medge.addNode(node)
          medge.addNode(neighbour)

          graph.addEdge(medge)
        }
      }
    }

    graph.getAlgorithmRecord(algorithm)!.collapsed_edges = collapsed_edges
  }

  export function expandMultiedgesOldModel(algorithm: IOldGraphAlgorithm) {
    const { graph } = algorithm

    const alg_data = graph.getAlgorithmRecord(algorithm)
    assert(alg_data)

    assert(alg_data.collapsed_edges)
    for (const [multiedge, subedges] of alg_data.collapsed_edges.entries()) {
      assert(subedges.length >= 2)

      graph.deleteEdge(multiedge)

      for (const edge of subedges) {
        for(const p of multiedge.bend_points) {
          edge.bend_points.push(p.copy())
        }

        // copy algorithmically_generated_options omitted

        for(const node of edge.nodes) {
          node.addEdge(edge)
        }

        graph.addEdge(edge)
      }
    }

    delete alg_data.collapsed_edges
  }
}
