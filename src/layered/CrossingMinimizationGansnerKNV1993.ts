import assert from "assert"
import { Node } from "../deprecated/Node"
import { OldEdge } from "../deprecated/OldEdge"
import { AbstractGraphAlgorithm } from "../lib/Algorithm"
import { DepthFirstSearch } from "../lib/DepthFirstSearch"
import { denull, find } from "../lib/Types"
import { Rank, Ranking } from "./Ranking"

export class CrossingMinimizationGansnerKNV1993 extends AbstractGraphAlgorithm<Ranking> {
  run() {
    assert(this.ranking)
    const og_ranking = this.ranking

    this.computeInitialRankOrdering()

    let best_ranking = this.ranking.copy()
    let best_crossings = this.countRankCrossings(best_ranking)

    for (let iteration = 1; iteration <= 24; iteration++) {
      const direction = (iteration % 2 === 0) ? 'down' : 'up'

      this.orderByWeightedMedian(direction)
      this.transpose(direction)

      const current_crossings = this.countRankCrossings(this.ranking)

      if(current_crossings < best_crossings) {
        best_ranking = this.ranking.copy()
        best_crossings = current_crossings
      }
    }

    this.ranking = best_ranking.copy()

    return this.ranking
  }

  computeInitialRankOrdering() {
    assert(this.ranking)

    let best_ranking = this.ranking.copy()
    let best_crossings = this.countRankCrossings(best_ranking)
    let _i = 0

    for (const direction of ['down', 'up'] as const) {
      new DepthFirstSearch<Node>(
        //init
        (search) => {
          [...denull(this.graph).nodes].reverse().forEach(node => {
            if (node[direction === 'down' ? 'getInDegree' : 'getOutDegree']() === 0) {
              search.push(node)
              search.setDiscovered(node)
            }
          })
        },
        // visit
        (search, node) => {
          assert(this.ranking)

          search.setVisited(node, true)

          const rank = denull(this.ranking.getRank(node))
          const pos = this.ranking.getRankSize(rank) - 1
          this.ranking.setRankPosition(node, pos)

          const edges = node[direction === 'down' ? 'getOutgoingEdges' : 'getIncomingEdges']()
          ;[...edges].reverse().forEach(edge => {
            const neighbour = edge.getNeighbour(node)
            if (!search.getDiscovered(neighbour)) {
              search.push(neighbour)
              search.setDiscovered(neighbour)
            }
          })
        }
      ).run()

      const crossings = this.countRankCrossings(this.ranking)

      if (crossings < best_crossings) {
        best_ranking = this.ranking.copy()
        best_crossings = crossings
      }
    }

    this.ranking = best_ranking.copy()
  }

  private countRankCrossings(ranking: Ranking) {
    let crossings = 0

    const ranks = ranking.getRanks()

    for (let rank_index = 1; rank_index < ranks.length; rank_index++) {
      const nodes = ranking.getNodes(ranks[rank_index])

      for (let i = 0; i < nodes.length - 2; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const v = nodes[i]
          const w = nodes[j]

          const cn_vw = this.countNodeCrossings(ranking, v, w, 'down')

          crossings += cn_vw
        }
      }
    }

    return crossings
  }

  private countNodeCrossings(ranking: Ranking, left_node: Node, right_node: Node, sweep_direction: 'down' | 'up'): number {
    const ranks = ranking.getRanks()
    const [_, rank_index] = find(ranks, rank => rank === ranking.getRank(left_node))
    assert(rank_index != null)
    const other_rank_index = (sweep_direction === 'down') ? rank_index - 1 : rank_index + 1

    assert(ranking.getRank(left_node) === ranking.getRank(right_node))
    assert(rank_index >= 1 && rank_index <= ranks.length)

    if (other_rank_index < 1 || other_rank_index > ranks.length) {
      return 0
    }

    const edges_from = (sweep_direction === 'down') ? 'getIncomingEdges' : 'getOutgoingEdges'

    const left_edges = left_node[edges_from]()
    const right_edges = right_node[edges_from]()

    let crossings = 0

    const neighbour_on_other_rank = (edge: OldEdge, direction: 'left' | 'right') => {
      const neighbour = edge.getNeighbour(direction === 'left' ? left_node : right_node)
      return ranking.getRank(neighbour) === ranking.getRanks()[other_rank_index]
    }

    for (const left_edge of left_edges) {
      if (neighbour_on_other_rank(left_edge, 'left')) {
        const left_neighbour = left_edge.getNeighbour(left_node)

        for (const right_edge of right_edges) {
          if (neighbour_on_other_rank(right_edge, 'right')) {
            const right_neighbour = right_edge.getNeighbour(right_node)

            assert(left_neighbour)
            assert(right_neighbour)

            const left_position = ranking.getRankPosition(left_neighbour)
            const right_position = ranking.getRankPosition(right_neighbour)

            assert(left_position != null)
            assert(right_position != null)

            const neighbour_diff = right_position - left_position

            if (neighbour_diff < 0) {
              crossings += 1
            }
          }
        }
      }
    }

    return crossings
  }

  orderByWeightedMedian(direction: 'down' | 'up') {
    let median = new Map<Node, number>()

    const get_index = (_: any, node: Node) => denull(median.get(node))
    const is_fixed = (_: any, node: Node) => denull(median.get(node)) < 0

    assert(this.ranking)
    const ranks = this.ranking.getRanks()

    for (let _rank_index = 1; _rank_index < ranks.length; _rank_index++) {
      const rank_index = _rank_index + (direction === 'down' ? 0 : -1)

      median = new Map()

      const rank = ranks[rank_index]
      assert(rank != null)

      const nodes = this.ranking.getNodes(rank)
      for (const node of nodes) {
        median.set(node, this.computeMedianPosition(node, ranks[rank_index + (direction === 'down' ? -1 : 1)]))
      }

      this.ranking.reorderRank(
        rank, get_index, is_fixed,
      )
    }
  }

  computeMedianPosition(node: Node, prev_rank: Rank) {
    assert(this.ranking)

    const positions = node.edges
      .map(edge => edge.getNeighbour(node))
      .filter(n => denull(this.ranking).getRank(n) === prev_rank)
      .map(n => denull(denull(this.ranking).getRankPosition(n)))

    positions.sort((a, b) => a-b)

    const median = Math.ceil(positions.length / 2) - 1
    let position = -1

    if (positions.length > 0) {
      if (positions.length % 2 === 1) {
        position = positions[median]
      } else if (positions.length === 2) {
        return (positions[0] + positions[1]) / 2
      } else {
        const left = positions[median - 1] - positions[0]
        const right = positions[positions.length - 1] - positions[median]
        position = (positions[median - 1] * right + positions[median] * left) / (left + right)
      }
    }

    assert(position != null)

    return position
  }

  transpose(sweep_direction: 'up' | 'down') {
    const transpose_rank = (rank: Rank) => {
      assert(this.ranking)

      let improved = false

      const nodes = this.ranking.getNodes(rank)

      for(let i = 0; i < nodes.length-1; i++) {
        const v = nodes[i]
        const w = nodes[i+1]

        const cn_vw = this.countNodeCrossings(this.ranking, v, w, sweep_direction)
        const cn_wv = this.countNodeCrossings(this.ranking, w, v, sweep_direction)

        if(cn_vw > cn_wv) {
          improved = true

          this.switchNodePositions(v, w)
        }
      }

      return improved
    }

    assert(this.ranking)
    const ranks = this.ranking.getRanks()

    let improved = false

    do {
      improved = false

      ;(sweep_direction === 'down' ? ranks : [...ranks].reverse()).forEach((rank) => {
        improved = transpose_rank(rank) || improved 
      })
    } while(improved)
  }

  switchNodePositions(left_node: Node, right_node: Node) {
    assert(this.ranking)

    assert(this.ranking.getRank(left_node) === this.ranking.getRank(right_node))

    const left_position = denull(this.ranking.getRankPosition(left_node))
    const right_position = denull(this.ranking.getRankPosition(right_node))
    assert(left_position < right_position)

    this.ranking.switchPositions(left_node, right_node)

    const nodes = this.ranking.getNodes(this.ranking.getRank(left_node)!)
  }
}
