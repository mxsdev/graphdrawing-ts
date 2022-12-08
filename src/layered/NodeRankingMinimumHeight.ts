import assert from "assert"
import { topologicallySorted } from "../deprecated/Iterators"
import { AbstractGraphAlgorithm } from "../lib/Algorithm"
import { denull } from "../lib/Types"
import { Ranking } from "./Ranking"

export class NodeRankingMinimumHeight extends AbstractGraphAlgorithm<Ranking> {
  run() {
    assert(this.graph)

    const ranking = new Ranking()

    for(const node of topologicallySorted(this.graph)) {
      const edges = node.getIncomingEdges()

      if(edges.length === 0) {
        ranking.setRank(node, 1)
      } else {
        let max_rank = Number.NEGATIVE_INFINITY
        for(const edge of edges) {
          max_rank = Math.max(
            max_rank,
            denull(ranking.getRank(edge.getNeighbour(node)))
          )
        }

        assert(max_rank >= 1)

        ranking.setRank(node, max_rank + 1)
      }
    }

    return ranking
  }
}
