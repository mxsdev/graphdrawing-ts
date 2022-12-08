import assert from "assert"
import { AbstractGraphAlgorithm } from "../lib/Algorithm"
import { NetworkSimplex, NetworkSimplexBalancing } from "./NetworkSimplex"
import { Ranking } from "./Ranking"

export class NodeRankingGansnerKNV1993 extends AbstractGraphAlgorithm<Ranking> {
  run() {
    assert(this.graph)

    const simplex = new NetworkSimplex(this.graph, NetworkSimplexBalancing.BALANCE_TOP_BOTTOM)
    simplex.run()
    // this.ranking = simplex.ranking

    return simplex.ranking
  }
}
