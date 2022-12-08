import assert from "assert"
import { Node } from "../deprecated/Node"
import { OldGraph } from "../deprecated/OldGraph"
import { PriorityQueue } from "./PriorityQueue"
import { denull } from "./Types"

export namespace PathLengths {
  export function dijkstra(graph: OldGraph, source: Node): [WeakMap<Node, number>, Map<number, Node[]>, WeakMap<Node, Node>] {
    const distance = new WeakMap<Node, number>()
    const levels = new Map<number, Node[]>()
    const parent = new WeakMap<Node, Node>()

    const queue = new PriorityQueue<Node>()

    for (const node of graph.nodes) {
      if (node === source) {
        distance.set(node, 0)
        parent.delete(node)
        assert(distance.has(node))
        queue.enqueue(node, distance.get(node)!)
      } else {
        distance.set(node, graph.nodes.length + 1)
        assert(distance.has(node))
        queue.enqueue(node, distance.get(node)!)
      }
    }

    while (!queue.isEmpty()) {
      const u = queue.dequeue()!

      const u_dist = denull(distance.get(u))

      assert(u_dist < graph.nodes.length + 1, `the graph is not connected, Dijkstra will not work`)

      if (u_dist > 0) {
        const u_dist_levels = levels.get(u_dist) ?? []
        levels.set(u_dist, u_dist_levels)
        u_dist_levels.push(u)
      }

      for (const edge of u.edges) {
        const v = edge.getNeighbour(u)
        const alternative = denull(distance.get(u)) + 1
        if (alternative < denull(distance.get(v))) {
          distance.set(v, alternative)
          parent.set(v, u)

          queue.updatePriority(v, alternative)
        }
      }
    }

    return [distance, levels, parent]
  }

  export function floydWarshall(graph: OldGraph) {
    const distance = new WeakMap<Node, WeakMap<Node, number>>()

    for(const i of graph.nodes) {
      const i_arr = new WeakMap<Node, number>()
      distance.set(i, i_arr)
      for(const j of graph.nodes) {
        i_arr.set(j, Number.POSITIVE_INFINITY)
      }
    }

    for(const i of graph.nodes) {
      for(const edge of i.edges) {
        const j = edge.getNeighbour(i)
        denull(distance.get(i)).set(j, edge.weight ?? 1)
      }
    }

    for(const k of graph.nodes) {
      for(const i of graph.nodes) {
        for(const j of graph.nodes) {
          const dist_i = denull(distance.get(i))
          const dist_k = denull(distance.get(k))

          const dist_ij = denull(dist_i.get(j))
          const dist_ik = denull(dist_i.get(k))
          const dist_kj = denull(dist_k.get(j))

          dist_i.set(j, Math.min(dist_ij, dist_ik + dist_kj))
        }
      }
    }

    return distance
  }

  export function pseudoDiameter(graph: OldGraph): [ number, Node, Node ] { 
    assert(graph.nodes.length >= 1)

    let start_node = graph.nodes[0]
    for(const node of graph.nodes) {
      if(node.getDegree() < start_node.getDegree()) {
        start_node = node
      }
    }

    assert(start_node)

    let old_diameter = 0
    let diameter = 0
    let end_node: Node|undefined

    while(true) {
      const [_, levels] = PathLengths.dijkstra(graph, start_node)

      old_diameter = diameter
      diameter = levels.size

      const level_at_size = denull(levels.get(levels.size))
      const smallest_deg_node = denull(level_at_size[0])

      if(diameter === old_diameter) {
        end_node = smallest_deg_node
        break
      }

      start_node = smallest_deg_node
      for(const node of level_at_size) {
        if(node.getDegree() < start_node.getDegree()) {
          start_node = node
        }
      }

      assert(start_node)
    }

    assert(start_node)
    assert(end_node)

    return [ diameter, start_node, end_node ]
  }
}
