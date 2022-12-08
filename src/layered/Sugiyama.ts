import assert from "assert"
import util from 'util'
import { topologicallySorted } from "../deprecated/Iterators"
import { Node } from "../deprecated/Node"
import { OldEdge } from "../deprecated/OldEdge"
import { Vector } from "../deprecated/Vector"
import { AbstractGraphAlgorithm, GraphAlgorithm } from "../lib/Algorithm"
import { GDOptions } from "../lib/Options"
import { Simplifiers } from "../lib/Simplifiers"
import { denull } from "../lib/Types"
import { Vertex } from "../model/Vertex"
import type Declarations from './library'
import { Ranking } from "./Ranking"

type Decl = typeof Declarations

class Sugiyama extends AbstractGraphAlgorithm {
  run() {
    assert(this.graph)

    if (this.graph.nodes.length <= 1) {
      return
    }

    // const algorithm_phases = this.digraph.option_algorithm_phase

    const cycle_removal_algorithm_class = denull(this.digraph.option_algorithm_phase<Decl, 'cycle removal'>('cycle removal'))
    const node_ranking_algorithm_class = denull(this.digraph.option_algorithm_phase<Decl, 'node ranking'>('node ranking')) as GraphAlgorithm<Ranking>
    const crossing_minimization_algorithm_class = denull(this.digraph.option_algorithm_phase<Decl, 'crossing minimization'>('crossing minimization')) as GraphAlgorithm<Ranking>
    const node_positioning_algorithm_class = denull(this.digraph.option_algorithm_phase<Decl, 'node positioning'>('node positioning'))
    const edge_routing_algorithm_class = denull(this.digraph.option_algorithm_phase<Decl, 'layer edge routing'>('layer edge routing'))

    this.preprocess()

    const collapse = (m: OldEdge, e: OldEdge) => {
      assert(e.weight != null)
      assert(e.minimum_levels != null)

      m.weight = (m.weight ?? 0) + e.weight
      m.minimum_levels = Math.max((m.minimum_levels ?? 0), e.minimum_levels)
    }

    const cluster_subalgorithm = { graph: this.graph }
    this.graph.registerAlgorithm(cluster_subalgorithm)

    this.mergeClusters()

    Simplifiers.removeLoopsOldModel(cluster_subalgorithm)
    Simplifiers.collapseMultiedgesOldModel(cluster_subalgorithm, collapse)

    const algorithm_args = {
      ...this,
      main_algorithm: this,
      graph: this.graph,
    }

    new cycle_removal_algorithm_class.constructor(algorithm_args).run()

    this.ranking = new node_ranking_algorithm_class.constructor(algorithm_args).run()
    assert(this.ranking instanceof Ranking)
    algorithm_args.ranking = this.ranking

    this.restoreCycles()

    Simplifiers.expandMultiedgesOldModel(cluster_subalgorithm)
    Simplifiers.restoreLoopsOldModel(cluster_subalgorithm)

    this.expandClusters()

    Simplifiers.collapseMultiedgesOldModel(cluster_subalgorithm, collapse)
    new cycle_removal_algorithm_class.constructor(algorithm_args).run()
    this.insertDummyNodes()

    new crossing_minimization_algorithm_class.constructor(algorithm_args).run()
    new node_positioning_algorithm_class.constructor(algorithm_args).run()

    this.removeDummyNodes()
    Simplifiers.expandMultiedgesOldModel(cluster_subalgorithm)
    new edge_routing_algorithm_class.constructor(algorithm_args).run()
    this.restoreCycles()
  }

  preprocess() {
    assert(this.graph)

    for (const edge of this.graph.edges) {
      edge.weight = edge.option('weight')
      edge.minimum_levels = edge.option<Decl, 'minimum layers'>('minimum layers')

      assert(edge.minimum_levels >= 0, `the edge ${edge.toString()} needs to have a minimum layers value greater than or equal to 0`)
    }
  }

  dummy_nodes: Node[] = []
  original_edges: OldEdge[] = []

  insertDummyNodes() {
    assert(this.ranking && this.graph)

    let dummy_id = 1

    for(const node of topologicallySorted(this.graph)) {
      const in_edges = node.getIncomingEdges()

      for(const edge of in_edges) {
        const neighbour = edge.getNeighbour(node)
        const dist = denull(this.ranking.getRank(node)) - denull(this.ranking.getRank(neighbour))

        if(dist > 1) {
          const dummies: Node[] = []

          for(let i = 1; i <= dist-1; i++) {
            const rank = denull(this.ranking.getRank(neighbour)) + i

            const dummy = new Node({
              pos: new Vector(),
              name: `dummy@${neighbour.name}@to@${node.name}@at@${rank}`,
              kind: 'dummy',
            })
            dummy.orig_vertex = new Vertex()

            dummy_id += 1

            this.graph.addNode(dummy)
            this.ugraph.add(dummy.orig_vertex)

            this.ranking.setRank(dummy, rank)

            this.dummy_nodes.push(dummy)
            edge.bend_nodes.push(dummy)

            dummies.push(dummy)
          }

          dummies.unshift(neighbour)
          dummies.push(node)

          for(let i = 1; i <= dummies.length-1; i++) {
            const source = dummies[i-1]
            const target = dummies[i]

            const dummy_edge = new OldEdge({
              direction: '->',
              reversed: false,
              weight: edge.weight,
            })

            dummy_edge.addNode(source)
            dummy_edge.addNode(target)

            this.graph.addEdge(dummy_edge)
          }

          this.original_edges.push(edge)
        }
      }
    }

    for(const edge of this.original_edges) {
      this.graph.deleteEdge(edge)
    }
  }

  removeDummyNodes() {
    assert(this.graph)

    for(const node of this.dummy_nodes) {
      this.graph.deleteNode(node)
    }

    for(const edge of this.original_edges) {
      this.graph.addEdge(edge)

      for(const node of edge.nodes) {
        node.addEdge(edge)
      }

      for(const bend_node of edge.bend_nodes) {
        const point = bend_node.pos.copy()
        edge.bend_points.push(point)
      }

      if(edge.reversed) {
        const bp = edge.bend_points
        for(let i = 0; i < (bp.length / 2) - 1; i++) {
          const j = bp.length + 1 - i

          const temp = bp[i]
          bp[i] = bp[j]
          bp[j] = temp
        }
      }

      edge.bend_nodes = []
    }
  }

  cluster_nodes: Node[] = []
  cluster_node: WeakMap<Node, Node> = new WeakMap()
  cluster_edges: OldEdge[] = []
  // cluster_edge: WeakMap<OldEdge, OldEdge> = new WeakMap()
  cluster_original_edges: OldEdge[] = []
  original_nodes: Node[] = []

  mergeClusters() {
    assert(this.graph)

    for (const cluster of this.graph.clusters) {
      assert(cluster.nodes.length > 0)

      const cluster_node = cluster.nodes[0]
      this.cluster_nodes.push(cluster_node)

      for (let n = 1; n < cluster.nodes.length; n++) {
        const other_node = cluster.nodes[n]
        this.cluster_node.set(other_node, cluster_node)
        this.original_nodes.push(other_node)
      }
    }

    for (const edge of this.graph.edges) {
      const tail = edge.getTail()
      const head = edge.getHead()

      const tail_cluster = this.cluster_node.get(tail)
      const head_cluster = this.cluster_node.get(head)

      if (tail_cluster || head_cluster) {
        const cluster_edge = new OldEdge({
          direction: '->',
          weight: edge.weight,
          minimum_levels: edge.minimum_levels,
        })

        if (tail_cluster) {
          cluster_edge.addNode(tail_cluster)
        } else {
          cluster_edge.addNode(tail)
        }

        if (head_cluster) {
          cluster_edge.addNode(head_cluster)
        } else {
          cluster_edge.addNode(head)
        }

        this.cluster_edges.push(cluster_edge)
        this.cluster_original_edges.push(edge)
      }
    }

    for (let n = 0; n < this.cluster_nodes.length - 2; n++) {
      const first_node = this.cluster_nodes[n]
      const second_node = this.cluster_nodes[n + 1]

      const edge = new OldEdge({
        direction: '->',
        weight: 1, minimum_levels: 1,
      })

      edge.addNode(first_node)
      edge.addNode(second_node)

      this.cluster_edges.push(edge)
    }

    for (const node of this.original_nodes) {
      this.graph.deleteNode(node)
    }

    for (const edge of this.cluster_edges) {
      this.graph.addEdge(edge)
    }

    for (const edge of this.cluster_original_edges) {
      this.graph.deleteEdge(edge)
    }
  }

  expandClusters() {
    assert(this.graph && this.ranking)

    for (const node of this.original_nodes) {
      const clnode = denull(this.cluster_node.get(node))
      const clrank = denull(this.ranking.getRank(clnode))

      this.ranking.setRank(node, clrank)
      this.graph.addNode(node)
    }

    for (const edge of this.cluster_original_edges) {
      for (const node of edge.nodes) {
        node.addEdge(edge)
      }
      this.graph.addEdge(edge)
    }

    for (const edge of this.cluster_edges) {
      this.graph.deleteEdge(edge)
    }
  }

  restoreCycles() {
    denull(this.graph).edges.forEach(edge => { edge.reversed = false })
  }
}

const Declare = {
  "layered layout": {
    // key      : "layered layout",
    algorithm: Sugiyama,

    preconditions: {
      connected: true,
      loop_free: true,
    },

    postconditions: {
      upward_oriented: true
    },

    old_graph_model: true,

    summary: `"
    The |layered layout| is the key used to select the modular Sugiyama
    layout algorithm.
  "`,
    documentation: `"
    This algorithm consists of five consecutive steps, each of which can be
    configured independently of the other ones (how this is done is
    explained later in this section). Naturally, the \`\`best'' heuristics
    are selected by default, so there is typically no need to change the
    settings, but what is the \`\`best'' method for one graph need not be
    the best one for another graph.

    As can be seen in the first example, the algorithm will not only
    position the nodes of a graph, but will also perform an edge
    routing. This will look visually quite pleasing if you add the
    |rounded corners| option:
  "`,
    examples: [`"
    \\tikz \\graph [layered layout, sibling distance=7mm]
    {
      a -> {
        b,
        c -> { d, e, f }
      } ->
      h ->
      a
    }
  "`, `"
    \\tikz [rounded corners] \\graph [layered layout, sibling distance=7mm]
    {
      a -> {
        b,
        c -> { d, e, f }
      } ->
      h ->
      a
    }
  "`
    ]
  },

  //-

  "minimum layers": {
    // key: "minimum layers",
    type: "number",
    initial: "1",

    summary: `"
    The minimum number of levels that an edge must span. It is a bit of
    the opposite of the |weight| parameter: While a large |weight|
    causes an edge to become shorter, a larger |minimum layers| value
    causes an edge to be longer.
  "`,
    examples: `"
    \\tikz \\graph [layered layout] {
      a // {b [> minimum layers=3], c, d} // e // a
    }
  "`
  },


  //-

  "same layer": {
    // key: "same layer",
    layer: 0,

    summary: `"
    The |same layer| collection allows you to enforce that several nodes
    a on the same layer of a layered layout (this option is also known
    as |same rank|). You use it like this:
  "`,
    examples: [`"
    \\tikz \\graph [layered layout] {
      a // b // c // d // e

      { [same layer] a, b }
      { [same layer] d, e }
    }
  "`, `"
      \\tikz [rounded corners] \\graph [layered layout] {
        1972 -> 1976 -> 1978 -> 1980 -> 1982 -> 1984 -> 1986 -> 1988 -> 1990 -> future

        { [same layer] 1972, Thompson }
        { [same layer] 1976, Mashey, Bourne },
        { [same layer] 1978, Formshell, csh },
        { [same layer] 1980, esh, vsh },
        { [same layer] 1982, ksh, "System-V" },
        { [same layer] 1984, v9sh, tcsh },
        { [same layer] 1986, "ksh-i" },
        { [same layer] 1988, KornShell ,Perl, rc },
        { [same layer] 1990, tcl, Bash },
        { [same layer] "future", POSIX, "ksh-POSIX" },

        Thompson -> { Mashey, Bourne, csh -> tcsh},
        Bourne -> { ksh, esh, vsh, "System-V", v9sh -> rc, Bash},
        { "ksh-i", KornShell } -> Bash,
        { esh, vsh, Formshell, csh } -> ksh,
        { KornShell, "System-V" } -> POSIX,
        ksh -> "ksh-i" -> KornShell -> "ksh-POSIX",
        Bourne -> Formshell,

        { [edge={draw=none}]
          Bash -> tcl,
          KornShell -> Perl
        }
      }
  "`
    ]
  },
} as const

export default Declare
