import { OldGraph } from '../deprecated/OldGraph'
import { Node } from '../deprecated/Node'
import assert from 'assert'
import { OldEdge } from '../deprecated/OldEdge'
import { pairs } from '../lib/Types'

export type Rank = number

export class Ranking {
  rank_to_nodes: Map<Rank, (Node)[]> = new Map()
  node_to_rank: Map<Node, Rank> = new Map()
  position_in_rank: Map<Node, number> = new Map()

  constructor() { }

  copy() {
    const copied_ranking = new Ranking()

    for(const [ rank, nodes ] of this.rank_to_nodes.entries()) {
      copied_ranking.rank_to_nodes.set(rank, [...nodes])
    }

    for(const [node, rank] of this.node_to_rank.entries()) {
      copied_ranking.node_to_rank.set(node, rank)
    }

    for(const [node, position] of this.position_in_rank.entries()) {
      copied_ranking.position_in_rank.set(node, position)
    }

    return copied_ranking
  }

  reset() {
    this.rank_to_nodes = new Map()
    this.node_to_rank = new Map()
    this.position_in_rank = new Map()
  }

  getRanks(): Rank[] {
    const ranks: Rank[] = []
    for(const rank of this.rank_to_nodes.keys()) {
      ranks.push(rank)
    }
    ranks.sort()
    return ranks
  }

  getRankSize(rank: Rank): number {
    if(this.rank_to_nodes.has(rank)) {
      return this.rank_to_nodes.get(rank)!.length
    } else {
      return 0
    }
  }

  getNodeInfo(node: Node): [Rank|undefined, number|undefined] {
    return [ this.getRank(node), this.getRankPosition(node) ]
  }

  getNodes(rank: Rank) {
    return this.rank_to_nodes.get(rank) ?? []
  }

  getRank(node: Node): Rank|undefined {
    return this.node_to_rank.get(node)
  }

  private deleteAtPos(nodes: Node[], node: Node, pos: number) {
    for(let n = pos+1; n < nodes.length; n++) {
      const other_node = nodes[n]
      assert(other_node)

      const other_pos = this.position_in_rank.get(other_node)
      assert(other_pos != null)

      this.position_in_rank.set(other_node, other_pos-1)
    }

    nodes.splice(pos, 1)
    this.node_to_rank.delete(node)
    this.position_in_rank.delete(node)
  }

  setRank(node: Node, new_rank?: Rank) {
    const [ rank, pos ] = this.getNodeInfo(node)

    if(rank === new_rank) {
      return
    }

    if(rank != null) {
      const nodes = this.rank_to_nodes.get(rank)
      assert(nodes)

      assert(pos != null)
      this.deleteAtPos(nodes, node, pos)

      if(nodes.length === 0) {
        this.rank_to_nodes.delete(rank)
      }
    }

    if(new_rank != null) {
      const new_nodes = this.rank_to_nodes.get(new_rank) ?? []
      this.rank_to_nodes.set(new_rank, new_nodes)
      new_nodes.push(node)
      this.node_to_rank.set(node, new_rank)
      this.position_in_rank.set(node, new_nodes.length-1)
    }
  }

  getRankPosition(node: Node): number|undefined {
    return this.position_in_rank.get(node)
  } 

  setRankPosition(node: Node, new_pos: number) {
    const [ rank, pos ] = this.getNodeInfo(node)
    assert((rank != null && pos != null) || (rank == null && pos == null))

    if(pos === new_pos) {
      return
    }

    if(rank != null && pos != null) {
      const nodes = this.rank_to_nodes.get(rank)
      assert(nodes)

      this.deleteAtPos(nodes, node, pos)
    }

    if(new_pos != null) {
      assert(rank != null)

      const new_nodes = this.rank_to_nodes.get(rank) ?? [] 
      this.rank_to_nodes.set(rank, new_nodes)

      for(let n = new_pos+1;n < new_nodes.length;n++) {
        // TODO: this seems to be a bug, but is present in the original...
        const other_node = new_nodes[new_pos]
        assert(other_node)
        
        const other_pos = this.position_in_rank.get(other_node)
        assert(other_pos != null)

        this.position_in_rank.set(other_node, other_pos+1)
      }

      new_nodes.push(node)
      this.node_to_rank.set(node, rank)
      this.position_in_rank.set(node, new_pos)
    }
  }

  normalizeRanks() {
    const ranks = this.getRanks()

    const min_rank = ranks[0]
    assert(min_rank != null)

    this.rank_to_nodes = new Map()

    for(const node of this.position_in_rank.keys()) {
      const [ rank, pos ] = this.getNodeInfo(node)
      assert(rank != null && pos != null)

      const new_rank = rank - (min_rank - 1)

      const new_nodes = this.rank_to_nodes.get(new_rank) ?? [] 
      this.rank_to_nodes.set(new_rank, new_nodes)
      new_nodes[pos] = node

      this.node_to_rank.set(node, new_rank)
    }
  }

  switchPositions(left_node: Node, right_node: Node) {
    const left_rank = this.node_to_rank.get(left_node)
    const right_rank = this.node_to_rank.get(right_node)

    assert(left_rank != null && right_rank != null)
    assert(left_rank === right_rank, "only positions of nodes in the same rank can be switched")

    const left_pos = this.position_in_rank.get(left_node)
    const right_pos = this.position_in_rank.get(right_node)

    assert(left_pos != null && right_pos != null)

    const left_nodes = this.rank_to_nodes.get(left_rank)
    assert(left_nodes)

    left_nodes[left_pos] = right_node
    left_nodes[right_pos] = left_node

    this.position_in_rank.set(left_node, right_pos)
    this.position_in_rank.set(right_node, left_pos)
  }

  reorderRank(rank: Rank, get_index_func: ReorderIndexFunc<Node>, is_fixed_func: ReorderFixedFunc<Node>) {
    const nodes = this.rank_to_nodes.get(rank)
    assert(nodes)

    reorderTable(nodes, get_index_func, is_fixed_func)

    for(let n = 0; n < nodes.length; n++) {
      this.position_in_rank.set(nodes[n], n)
    }
  }

  _debug() {
    return [ ...this.rank_to_nodes.entries() ].reduce((prev, [a, b]) => ({...prev, [a]: b.map(v => v.name)}), {})
  }
}

type ReorderFunc<T, R> = (n: number, val: T) => R
type ReorderIndexFunc<T> = ReorderFunc<T, number>
type ReorderFixedFunc<T> = ReorderFunc<T, boolean>

function reorderTable<T>(input: T[], get_index_func: ReorderIndexFunc<T>, is_fixed_func: ReorderFixedFunc<T>) {
  const allowed_indices: number[] = []
  for(let n = 0; n < input.length; n++) {
    if(!is_fixed_func(n, input[n])) {
      allowed_indices.push(n)
    }
  }

  const desired_to_real_indices: Record<number, number[]> = {}
  const sort_indices: number[] = []
  for(let n = 0; n < input.length; n++) {
    if(!is_fixed_func(n, input[n])) {
      const index = get_index_func(n, input[n])
      if(!desired_to_real_indices[index]) {
        desired_to_real_indices[index] = []
        sort_indices.push(index)
      }
      desired_to_real_indices[index].push(n)
    }
  }

  sort_indices.sort()

  const final_indices: Record<number, number> = {}
  let n = 0
  for(const index of sort_indices) {
    const real_indices = desired_to_real_indices[index]
    for(const real_index of real_indices) {
      assert(allowed_indices[n] != null)

      final_indices[real_index] = allowed_indices[n]
      n += 1
    }
  }

  const input_copy = [...input]

  for(const [old_index, new_index] of pairs(final_indices)) {
    assert(input_copy[old_index])
    input[new_index] = input_copy[old_index]
  }
}
