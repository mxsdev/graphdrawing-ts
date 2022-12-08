import assert from 'assert'
import { Node } from '../deprecated/Node'
import { OldEdge } from '../deprecated/OldEdge'
import { OldGraph } from '../deprecated/OldGraph'
import { DepthFirstSearch } from '../lib/DepthFirstSearch'
import { denull } from '../lib/Types'
import { Ranking } from './Ranking'

export enum NetworkSimplexBalancing {
  BALANCE_TOP_BOTTOM,
  BALANCE_LEFT_RIGHT,
}

export class NetworkSimplex {
  private search_index: number = 1
  private cut_value: WeakMap<OldEdge, number> = new WeakMap()

  private lim: WeakMap<Node, number> = new WeakMap()
  private low: WeakMap<Node, number> = new WeakMap()
  private parent_edge: WeakMap<Node, OldEdge> = new WeakMap()
  ranking: Ranking = new Ranking()

  private tree?: OldGraph
  private orig_node?: WeakMap<Node, Node>
  private tree_node?: WeakMap<Node, Node>
  private orig_edge?: WeakMap<OldEdge, OldEdge>
  private tree_edge?: WeakMap<OldEdge, OldEdge>

  constructor(
    private graph: OldGraph,
    private balancing: NetworkSimplexBalancing
  ) { }

  run() {
    assert(this.graph.nodes.length > 0, "graph must contain at least one node")

    this.search_index = 1

    this.cut_value = new WeakMap()
    for (const edge of this.graph.edges) {
      this.cut_value.set(edge, 0)
    }

    this.lim = new WeakMap()
    this.low = new WeakMap()
    this.parent_edge = new WeakMap()
    this.ranking = new Ranking()

    if (this.graph.nodes.length === 1) {
      this.ranking.setRank(this.graph.nodes[0], 1)
    } else {
      this.rankNodes()
    }
  }

  rankNodes() {
    this.constructFeasibleTree()

    let leave_edge = this.findNegativeCutEdge()
    while (leave_edge) {
      const enter_edge = this.findReplacementEdge(leave_edge)

      assert(enter_edge, `no non-tree edge to replace leave_edge could be found`)

      this.exchangeTreeEdges(leave_edge, enter_edge)

      leave_edge = this.findNegativeCutEdge()
    }

    if (this.balancing === NetworkSimplexBalancing.BALANCE_TOP_BOTTOM) {
      this.ranking.normalizeRanks()

      this.balanceRanksTopBottom()
    } else if (this.balancing === NetworkSimplexBalancing.BALANCE_LEFT_RIGHT) {
      this.balanceRanksLeftRight()
    }
  }

  constructFeasibleTree() {
    this.computeInitialRanking()

    while (this.findTightTree() < this.graph.nodes.length) {
      assert(this.tree_edge && this.tree_node && this.orig_node)

      let min_slack_edge: OldEdge | undefined

      for (const node of this.graph.nodes) {
        const out_edges = node.getOutgoingEdges()

        for (const edge of out_edges) {
          if (!this.tree_edge.get(edge) && this.isIncidentToTree(edge)) {
            if (!min_slack_edge || this.edgeSlack(edge) < this.edgeSlack(min_slack_edge)) {
              min_slack_edge = edge
            }
          }
        }
      }

      if (min_slack_edge) {
        let delta = this.edgeSlack(min_slack_edge)

        if (delta > 0) {
          const head = min_slack_edge.getHead()
          const tail = min_slack_edge.getTail()

          if (this.tree_node.get(head)) {
            delta *= -1
          }

          assert(this.tree)
          for (const node of this.tree.nodes) {
            const node_orig = denull(this.orig_node.get(node))
            const rank = denull(this.ranking.getRank(node_orig))
            this.ranking.setRank(node_orig, rank + delta)
          }
        }
      }
    }

    this.initializeCutValues()
  }

  findNegativeCutEdge() {
    let minimum_edge: OldEdge | undefined

    assert(this.tree)
    for (const _ of this.tree.edges) {
      const index = this.nextSearchIndex()

      const edge = this.tree.edges[index]
      assert(edge)

      const edge_cut_value = this.cut_value.get(edge)
      assert(edge_cut_value != null)
      if (edge_cut_value < 0) {
        if (minimum_edge) {
          const min_cut_value = this.cut_value.get(minimum_edge)
          assert(min_cut_value != null)

          if (min_cut_value > edge_cut_value) {
            minimum_edge = edge
          }
        } else {
          minimum_edge = edge
        }
      }
    }

    return minimum_edge
  }

  findReplacementEdge(leave_edge: OldEdge) {
    const tail = leave_edge.getTail()
    const head = leave_edge.getHead()

    let v: Node
    let direction: 'in' | 'out'

    const lim_tail = this.lim.get(tail)
    const lim_head = this.lim.get(head)
    assert(lim_tail != null && lim_head != null)

    if (lim_tail < lim_head) {
      v = tail
      direction = 'in'
    } else {
      v = head
      direction = 'out'
    }

    const search_root = v
    let enter_edge: OldEdge | undefined
    let slack = Number.POSITIVE_INFINITY

    const find_edge = (v: Node, direction: 'in' | 'out') => {
      const _get_edges = (out?: boolean) => out ? 'getOutgoingEdges' : 'getIncomingEdges'
      const _get_end = (out?: boolean) => out ? 'getHead' : 'getTail'

      const get_edges = _get_edges(direction === 'out')
      const get_end = _get_end(direction === 'out')

      const get_edges_inv = _get_edges(direction === 'in')
      const get_end_inv = _get_end(direction === 'in')

      const out_in_edges = this.orig_node?.get(v)?.[get_edges]()
      assert(out_in_edges)

      for (const edge of out_in_edges) {
        const end = edge[get_end]()
        const tree_end = this.tree_node?.get(end)

        assert(end && tree_end)

        assert(this.tree_edge)
        if (!this.tree_edge.get(edge)) {
          if (!this.inTailComponentOf(tree_end, search_root)) {
            const e_slack = this.edgeSlack(edge)
            if (e_slack < slack || !enter_edge) {
              enter_edge = edge
              slack = e_slack
            }
          }
        } else {
          const lim_tree_end = this.lim.get(tree_end)
          const lim_v = this.lim.get(v)
          assert(lim_tree_end != null && lim_v != null)

          if (lim_tree_end < lim_v) {
            find_edge(tree_end, direction)
          }
        }
      }

      for (const edge of v[get_edges_inv]()) {
        if (slack <= 0) {
          break
        }

        const end = edge[get_end_inv]()

        const lim_end = this.lim.get(end)
        const lim_v = this.lim.get(v)
        assert(lim_end != null && lim_v != null)

        if (lim_end < lim_v) {
          find_edge(end, direction)
        }
      }
    }

    find_edge(v, direction)

    return enter_edge
  }

  exchangeTreeEdges(leave_edge: OldEdge, enter_edge: OldEdge) {
    this.rerankBeforeReplacingEdge(leave_edge, enter_edge)

    assert(this.tree_node)

    const cutval = denull(this.cut_value.get(leave_edge))
    const head = denull(this.tree_node.get(enter_edge.getHead()))
    const tail = denull(this.tree_node.get(enter_edge.getTail()))

    const ancestor = this.updateCutValuesUpToCommonAncestor(tail, head, cutval, true)
    const other_ancestor = this.updateCutValuesUpToCommonAncestor(head, tail, cutval, false)

    assert(ancestor.equals(other_ancestor))

    this.removeEdgeFromTree(leave_edge)

    const tree_edge = this.addEdgeToTree(enter_edge)

    this.cut_value.set(tree_edge, -cutval)

    const ancestor_parent_edge = this.parent_edge.get(ancestor)
    const ancestor_low = denull(this.low.get(ancestor))
    this.calculateDFSRange(ancestor, ancestor_parent_edge, ancestor_low)
  }

  balanceRanksTopBottom() {
    const ranks = this.ranking.getRanks()

    const in_weight = new WeakMap<Node, number>()
    const out_weight = new WeakMap<Node, number>()

    const min_rank = new WeakMap<Node, number>()
    const max_rank = new WeakMap<Node, number>()

    for (const node of this.graph.nodes) {
      assert(ranks.length > 0)

      min_rank.set(node, ranks[0])
      max_rank.set(node, ranks[ranks.length - 1])

      for (const edge of node.getIncomingEdges()) {
        assert(edge.weight != null)
        in_weight.set(node, (in_weight.get(node) ?? 0) + edge.weight)

        const neighbour = edge.getNeighbour(node)
        const neighbour_rank = denull(this.ranking.getRank(neighbour))

        assert(edge.minimum_levels)
        min_rank.set(node, Math.max(
          denull(min_rank.get(node)),
          neighbour_rank + edge.minimum_levels
        ))
      }

      for (const edge of node.getOutgoingEdges()) {
        assert(edge.weight != null)
        out_weight.set(node, (out_weight.get(node) ?? 0) + edge.weight)

        const neighbour = edge.getNeighbour(node)
        const neighbour_rank = denull(this.ranking.getRank(neighbour))

        assert(edge.minimum_levels)
        max_rank.set(node, Math.min(
          denull(max_rank.get(node)),
          neighbour_rank - edge.minimum_levels
        ))
      }

      const node_in_weight = in_weight.get(node)
      const node_out_weight = out_weight.get(node)
      if (node_in_weight === node_out_weight) {
        const first_min_nodes_rank = denull(min_rank.get(node))
        let min_nodes_rank = first_min_nodes_rank
        for (let n = first_min_nodes_rank + 1; n <= denull(max_rank.get(node)); n++) {
          if (this.ranking.getNodes(n).length < this.ranking.getNodes(min_nodes_rank).length) {
            min_nodes_rank = n
          }
        }

        if (min_nodes_rank !== this.ranking.getRank(node)) {
          this.ranking.setRank(node, min_nodes_rank)
        }

      }
    }
  }

  balanceRanksLeftRight() {
    assert(this.tree)

    for (const edge of this.tree.edges) {
      if (this.cut_value.get(edge) === 0) {
        const other_edge = this.findReplacementEdge(edge)

        if (other_edge) {
          const delta = this.edgeSlack(other_edge)

          if (delta > 1) {
            if (denull(this.lim.get(edge.getTail())) < denull(this.lim.get(edge.getHead()))) {
              this.rerank(edge.getTail(), delta / 2)
            } else {
              this.rerank(edge.getHead(), -delta / 2)
            }
          }
        }
      }
    }
  }

  edgeSlack(edge: OldEdge) {
    assert(this.orig_edge)
    assert(edge.minimum_levels != null)

    assert(!this.orig_edge.get(edge))

    const head_rank = this.ranking.getRank(edge.getHead())
    const tail_rank = this.ranking.getRank(edge.getTail())

    assert(head_rank != null && tail_rank != null)

    const length = head_rank - tail_rank
    return length - edge.minimum_levels
  }

  isIncidentToTree(edge: OldEdge): boolean {
    assert(this.orig_edge)
    assert(!this.orig_edge.get(edge))

    const head = edge.getHead()
    const tail = edge.getTail()

    assert(this.tree_node)
    if (this.tree_node.get(head) && !this.tree_node.get(tail)) {
      return true
    } else if (this.tree_node.get(tail) && !this.tree_node.get(head)) {
      return true
    } else {
      return false
    }
  }

  initializeCutValues() {
    assert(this.tree && this.tree.nodes.length > 0)
    this.calculateDFSRange(this.tree.nodes[0], undefined, 1)

    new DepthFirstSearch<{ node: Node, parent_edge?: OldEdge }>(
      // init
      (search) => search.push({ node: denull(this.tree).nodes[0] }),
      // visit
      (search, data) => {
        search.setVisited(data, true)

        const into = data.node.getIncomingEdges()
        const out = data.node.getOutgoingEdges()

        ;[...into].reverse().forEach(edge => {
          if (edge !== data.parent_edge) {
            search.push({ node: edge.getTail(), parent_edge: edge })
          }
        })

        ;[...out].reverse().forEach(edge => {
          if (edge !== data.parent_edge) {
            search.push({ node: edge.getHead(), parent_edge: edge })
          }
        })
      },
      // complete
      (search, data) => {
        if (data.parent_edge) {
          this.updateCutValue(data.parent_edge)
        }
      }
    ).run()
  }

  computeInitialRanking() {
    const queue: Node[] = []

    this.ranking.reset()

    const remaining_edges: WeakMap<Node, number> = new WeakMap()

    for (const node of this.graph.nodes) {
      const edges = node.getIncomingEdges()

      remaining_edges.set(node, edges.length)

      if (edges.length === 0) {
        queue.push(node)
      }
    }

    while (queue.length > 0) {
      const node = queue.shift()!

      const in_edges = node.getIncomingEdges()

      let rank = 1
      for (const edge of in_edges) {
        const neighbour = edge.getNeighbour(node)
        const neighbour_rank = this.ranking.getRank(neighbour)
        if (neighbour_rank != null) {
          assert(edge.minimum_levels != null)
          rank = Math.max(rank, neighbour_rank + edge.minimum_levels)
        }
      }

      this.ranking.setRank(node, rank)

      const out_edges = node.getOutgoingEdges()

      for (const edge of out_edges) {
        const head = edge.getHead()

        const head_remaining_edges = remaining_edges.get(head)
        assert(head_remaining_edges != null)

        remaining_edges.set(head, head_remaining_edges - 1)

        if (head_remaining_edges <= 1) {
          queue.push(head)
        }
      }
    }
  }

  findTightTree() {
    const marked = new WeakSet<Node>()

    const build_tight_tree = (node: Node) => {
      const out_edges = node.getOutgoingEdges()
      const in_edges = node.getIncomingEdges()

      const edges = [...out_edges, ...in_edges]

      for (const edge of edges) {
        const neighbour = edge.getNeighbour(node)
        if (!marked.has(neighbour) && Math.abs(this.edgeSlack(edge)) < 0.00001) {
          this.addEdgeToTree(edge)

          for (const node of edge.nodes) {
            marked.add(node)
          }

          assert(this.tree)
          if (this.tree.edges.length === this.graph.nodes.length - 1) {
            return true
          }

          if (build_tight_tree(neighbour)) {
            return true
          }
        }
      }

      return false
    }

    for (const node of this.graph.nodes) {
      this.tree = new OldGraph()
      this.tree_node = new WeakMap()
      this.orig_node = new WeakMap()
      this.tree_edge = new WeakMap()
      this.orig_edge = new WeakMap()

      build_tight_tree(node)

      if (this.tree.edges.length > 0) {
        break
      }
    }

    assert(this.tree)

    return this.tree.nodes.length
  }

  inTailComponentOf(node: Node, v: Node) {
    const low_v = this.low.get(v)
    const lim_v = this.lim.get(v)
    const lim_node = this.lim.get(node)

    assert(low_v != null && lim_v != null && lim_node != null)

    return (low_v <= lim_node) && (lim_node <= lim_v)
  }

  nextSearchIndex() {
    let index = 0

    assert(this.tree)
    if (this.search_index > this.tree.edges.length-1) {
      this.search_index = 0
      index = 0
    } else {
      index = this.search_index
      this.search_index++
    }

    return index
  }

  rerank(node: Node, delta: number) {
    new DepthFirstSearch<{ node: Node, delta: number }>(
      (search) => search.push({ node, delta }),
      (search, data) => {
        search.setVisited(data, true)

        assert(this.orig_node)

        const orig_node = denull(this.orig_node.get(data.node))
        this.ranking.setRank(orig_node, denull(this.ranking.getRank(orig_node)) - data.delta)

        const into = data.node.getIncomingEdges()
        const out = data.node.getOutgoingEdges()

        ;[...into].reverse().forEach(edge => {
          if (edge != this.parent_edge.get(data.node)) {
            search.push({ node: edge.getTail(), delta: data.delta })
          }
        })

        ;[...out].reverse().forEach(edge => {
          if (edge != this.parent_edge.get(data.node)) {
            search.push({ node: edge.getHead(), delta: data.delta })
          }
        })
      }
    ).run()
  }

  rerankBeforeReplacingEdge(leave_edge: OldEdge, enter_edge: OldEdge) {
    const delta = this.edgeSlack(enter_edge)

    if (delta > 0) {
      const tail = leave_edge.getTail()

      if (tail.edges.length === 1) {
        this.rerank(tail, delta)
      } else {
        const head = leave_edge.getHead()

        if (head.edges.length === 1) {
          this.rerank(head, -delta)
        } else {
          if (denull(this.lim.get(tail)) < denull(this.lim.get(head))) {
            this.rerank(tail, delta)
          } else {
            this.rerank(head, -delta)
          }
        }
      }
    }
  }

  updateCutValuesUpToCommonAncestor(v: Node, w: Node, cutval: number, dir: boolean) {
    while (!this.inTailComponentOf(w, v)) {
      const edge = this.parent_edge.get(v)
      assert(edge)

      const d: boolean = edge.isTail(v) ? dir : !dir

      this.cut_value.set(
        edge,
        denull(this.cut_value.get(edge)) + (d ? cutval : -cutval)
      )

      if (denull(this.lim.get(edge.getTail())) > denull(this.lim.get(edge.getHead()))) {
        v = edge.getTail()
      } else {
        v = edge.getHead()
      }
    }

    return v
  }

  calculateDFSRange(root: Node, edge_from_parent: OldEdge | undefined, lowest: number) {
    let lim = lowest

    new DepthFirstSearch<{ node: Node, parent_edge?: OldEdge, low?: number }>(
      // init
      (search) => search.push({ node: root, parent_edge: edge_from_parent, low: lowest }),
      // visit
      (search, data) => {
        search.setVisited(data, true)

        if (data.parent_edge) {
          this.parent_edge.set(data.node, data.parent_edge)
        }

        this.low.set(data.node, lim)

        const into = data.node.getIncomingEdges()
        const out = data.node.getOutgoingEdges()

        ;[...into].reverse().forEach((edge) => {
          if (edge !== data.parent_edge) {
            search.push({ node: edge.getTail(), parent_edge: edge })
          }
        })

        ;[...out].reverse().forEach((edge) => {
          if (edge !== data.parent_edge) {
            search.push({ node: edge.getHead(), parent_edge: edge })
          }
        })
      },
      // complete
      (search, data) => {
        this.lim.set(data.node, lim)
        lim += 1
      }
    ).run()

    const lim_lookup = new Set<number>()
    let min_lim = Number.POSITIVE_INFINITY
    let max_lim = Number.NEGATIVE_INFINITY
    assert(this.tree)
    for (const node of this.tree.nodes) {
      const lim_node = denull(this.lim.get(node))
      assert(this.low.get(node))
      assert(!lim_lookup.has(lim_node))

      lim_lookup.add(lim_node)
      min_lim = Math.min(min_lim, lim_node)
      max_lim = Math.max(max_lim, lim_node)
    }
    for (let n = min_lim; n <= max_lim; n++) {
      assert(lim_lookup.has(n))
    }
  }

  updateCutValue(tree_edge: OldEdge) {
    assert(this.parent_edge && this.orig_node && this.tree_node && this.tree_edge)

    let v: Node
    let dir: number

    if (this.parent_edge.get(tree_edge.getTail()) === tree_edge) {
      v = tree_edge.getTail()
      dir = 1
    } else {
      v = tree_edge.getHead()
      dir = -1
    }

    let sum = 0

    const v_orig = denull(this.orig_node.get(v))

    const out_edges = v_orig.getOutgoingEdges()
    const in_edges = v_orig.getIncomingEdges()
    const edges = [...out_edges, ...in_edges]

    for (const edge of edges) {
      const other = edge.getNeighbour(v_orig)

      let f = 0
      let rv = 0

      if (!this.inTailComponentOf(denull(this.tree_node.get(other)), v)) {
        f = 1
        rv = denull(edge.weight)
      } else {
        f = 0

        const edge_tree_edge = this.tree_edge.get(edge)
        if (edge_tree_edge) {
          rv = denull(this.cut_value.get(edge_tree_edge))
        } else {
          rv = 0
        }

        rv -= denull(edge.weight)
      }

      let d = 0
      
      if(dir > 0) {
        if(edge.isHead(v_orig)) {
          d = 1
        } else {
          d = -1
        }
      } else {
        if(edge.isTail(v_orig)) {
          d = 1
        } else {
          d = -1
        }
      }

      if(f > 0) {
        d *= -1
      }

      if(d < 0) {
        rv *= -1
      }

      sum += rv
    }

    this.cut_value.set(tree_edge, sum)
  }

  addEdgeToTree(edge: OldEdge) {
    assert(this.tree_edge && this.tree && this.orig_edge && this.orig_node && this.tree_node)
    assert(!this.tree_edge.has(edge))

    const tree_edge = edge.copy()
    this.orig_edge.set(tree_edge, edge)
    this.tree_edge.set(edge, tree_edge)

    for (const node of edge.nodes) {
      let tree_node: Node

      const node_tree_node = this.tree_node.get(node)

      if (node_tree_node) {
        tree_node = node_tree_node
      } else {
        tree_node = node.copy()
        this.orig_node.set(tree_node, node)
        this.tree_node.set(node, tree_node)
      }

      this.tree.addNode(tree_node)
      tree_edge.addNode(tree_node)
    }

    this.tree.addEdge(tree_edge)

    return tree_edge
  }

  removeEdgeFromTree(edge: OldEdge) {
    assert(this.tree)
    assert(this.tree_edge)
    assert(this.orig_edge)

    this.tree.deleteEdge(edge)
    this.tree_edge.delete(denull(this.orig_edge.get(edge)))
    this.orig_edge.delete(edge)
  }
}
