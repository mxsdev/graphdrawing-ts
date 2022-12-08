import assert from "assert";
import { Node } from "../deprecated/Node";
import { OldEdge } from "../deprecated/OldEdge";
import { OldGraph } from "../deprecated/OldGraph";
import { RandomGenerator, randomPermutation } from "../lib/Random";
import { denull } from "../lib/Types";

export enum CoarseScheme {
  COARSEN_INDEPENDENT_EDGES,
  COARSEN_INDEPENDENT_NODES,
  COARSEN_HYBRID,
}

export class CoarseGraph {
  level: number = 0
  ratio: number = 0

  constructor(private random: RandomGenerator, private graph: OldGraph, private scheme: CoarseScheme = CoarseScheme.COARSEN_INDEPENDENT_EDGES) { }

  coarsen() {
    this.level++

    const old_graph_size = this.graph.nodes.length

    if (this.scheme === CoarseScheme.COARSEN_INDEPENDENT_EDGES) {
      const [matching, unmatched_nodes] = this.findMaximalMatching()

      for(const edge of matching) {
        const u = edge.nodes[0]
        const v = edge.nodes[1]

        assert(u && v && u !== v, `the edge ${edge.toString()} is a loop. loops are not supported by this algorithm`)
        assert(u.weight != null && v.weight != null)

        // create a supernode
        const supernode = new Node({
          name: `(${u.name}:${v.name})`,
          weight: u.weight + v.weight,
          subnodes: [u, v],
          subnode_edge: edge,
          level: this.level,
        })

        this.graph.addNode(supernode)

        const u_neighbours = u.edges.reduce((prev, edge) => {
          const node = edge.getNeighbour(u)
          if(node !== v) prev.set(node, edge)

          return prev
        }, new Map<Node, OldEdge>())

        const v_neighbours = v.edges.reduce((prev, edge) => {
          const node = edge.getNeighbour(v)
          if(node !== u) prev.set(node, edge)

          return prev
        }, new Map<Node, OldEdge>())

        const common_neighbors = [...u_neighbours.entries()].reduce((prev, [node, edge]) => {
          if(v_neighbours.get(node) != null) {
            prev.set(node, [edge, v_neighbours.get(node)!])
          }

          return prev
        }, new Map<Node, [OldEdge, OldEdge]>())

        ;[...u_neighbours.keys()].forEach(node => {
          if(common_neighbors.get(node)) {
            u_neighbours.delete(node)
          }
        })

        ;[...v_neighbours.keys()].forEach(node => {
          if(common_neighbors.get(node)) {
            v_neighbours.delete(node)
          }
        })

        const disjoint_neighbours = custom_merge(u_neighbours, v_neighbours)

        for(const [ neighbour, edge ] of pairs_by_sorted_keys(disjoint_neighbours, (n, m) => denull(n.index) < denull(m.index))) {
          const superedge = new OldEdge({
            direction: edge.direction,
            weight: edge.weight,
            subedges: [ edge ],
            level: this.level,
          })

          if(u_neighbours.get(neighbour)) {
            superedge.addNode(neighbour)
            superedge.addNode(supernode)
          } else {
            superedge.addNode(supernode)
            superedge.addNode(neighbour)
          }

          this.graph.addEdge(superedge)
          this.graph.deleteEdge(edge)
        }

        for(const [ neighbour, edges ] of pairs_by_sorted_keys(common_neighbors, (n, m) => denull(n.index) < denull(m.index))) {
          let weights = 0
          for(const _ of edges) {
            weights += denull(edge.weight)
          }

          const superedge = new OldEdge({
            direction: '--',
            weight: weights,
            subedges: edges,
            level: this.level, 
          })

          superedge.addNode(supernode)
          superedge.addNode(neighbour)

          this.graph.addEdge(superedge)
          for(const edge of edges) {
            this.graph.deleteEdge(edge)
          }
        }

        assert(u.edges.length === 1, `node ${u.name} is part of a multiedge`)
        assert(v.edges.length === 1, `node ${v.name} is part of a multiedge`)
        this.graph.deleteNode(u)
        this.graph.deleteNode(v)
      }
    } else {
      assert(false, 'schemes other than COARSEN_INDEPENDENT_EDGES are not implemented yet')
    }

    this.ratio = this.graph.nodes.length / old_graph_size
  }

  revertSuperedge(superedge: OldEdge) {
    assert(superedge.subedges)

    for(const subedge of superedge.subedges) {
      for(const index of [0, 1]) {
        if(!this.graph.findNode(subedge.nodes[index].name)[0]) {
          this.graph.addNode(subedge.nodes[index])
        }
      }

      if(!this.graph.findEdge(subedge)[0]) {
        subedge.nodes[0].addEdge(subedge)
        subedge.nodes[1].addEdge(subedge)
        this.graph.addEdge(subedge)
      }

      if(subedge.level != null && subedge.level >= this.level) {
        this.revertSuperedge(subedge)
      }
    }
  }

  interpolate() {
    const nodes = [...this.graph.nodes]

    for(const supernode of nodes) {
      assert(supernode.level == null || supernode.level <= this.level)

      if(supernode.level != null && supernode.level === this.level) {
        assert(supernode.subnodes && supernode.subnodes.length >= 1)

        for(const i of [0, 1]) {
          const sn = supernode.subnodes[i]

          sn.pos.x = supernode.pos.x
          sn.pos.y = supernode.pos.y

          if(!this.graph.findNode(sn.name)[0]) {
            this.graph.addNode(sn)
          }
        }

        assert(supernode.subnode_edge)
        if(!this.graph.findEdge(supernode.subnode_edge)[0]) {
          supernode.subnodes[0].addEdge(supernode.subnode_edge)
          supernode.subnodes[1].addEdge(supernode.subnode_edge)
          this.graph.addEdge(supernode.subnode_edge)
        }

        const superedges = [...supernode.edges]

        for(const superedge of superedges) {
          this.revertSuperedge(superedge)
        }

        this.graph.deleteNode(supernode)
      }
    }

    const compareFn = (a: {index?: number}, b: {index?: number}) => (denull(a.index) - denull(b.index))
    this.graph.nodes.sort(compareFn)
    this.graph.edges.sort(compareFn)
    for(const n of this.graph.nodes) {
      n.edges.sort(compareFn)
    }

    this.level--
  }

  getSize() {
    return this.graph.nodes.length
  }

  getRatio() {
    return this.ratio
  }

  getLevel() {
    return this.level
  }

  getGraph() {
    return this.graph
  }

  findMaximalMatching(): [ matching: OldEdge[], unmatched_nodes: Node[] ] {
    const matching: OldEdge[] = []
    const matched_nodes = new WeakSet<Node>()
    const unmatched_nodes: Node[] = []

    const perm = randomPermutation(this.random, this.graph.nodes.length)
    for (const j of perm) {
      const node = this.graph.nodes[j]
      assert(node)

      if (!matched_nodes.has(node)) {
        matched_nodes.add(node)

        const edges = node.edges.filter(e => !matched_nodes.has(e.getNeighbour(node)))

        if (edges.length > 0) {
          edges.sort((a, b) => denull(a.getNeighbour(node).weight) - denull(b.getNeighbour(node).weight))

          matched_nodes.add(edges[0].getNeighbour(node))
          matching.push(edges[0])
        }
      }
    }

    for (const j of randomPermutation(this.random, this.graph.nodes.length)) {
      const node = this.graph.nodes[j]
      assert(node)

      if(!matched_nodes.has(node)) {
        unmatched_nodes.push(node)
      }
    }

    return [ matching, unmatched_nodes ]
  }
}

// adapted from the original `custom_merge` function
function custom_merge<K, V>(table1: Map<K, V>, table2: Map<K, V>) {
  return [...table1.entries(), ...table2.entries()].reduce((prev, [key, value]) => {
    prev.set(key, value)
    return prev
  }, new Map<K, V>())
}

function pairs_by_sorted_keys<K, V>(t: Map<K, V>, f: (a: K, b: K) => boolean) {
  // FIXME: this may not work in JS...
  return [...t.entries()].sort(([a], [b]) => f(a, b) ? 1 : -1)
}
