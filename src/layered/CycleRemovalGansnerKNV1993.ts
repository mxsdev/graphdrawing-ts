import assert from 'assert'
import { AbstractGraphAlgorithm } from '../lib/Algorithm'
import { Simplifiers } from '../lib/Simplifiers'

export class CycleRemovalGansnerKNV1993 extends AbstractGraphAlgorithm {
  run() {
    assert(this.graph)

    const [tree_or_forward_edges, cross_edges, back_edges] = Simplifiers.classifyEdges(this.graph)

    for(const edge of back_edges) {
      edge.reversed = true
    }
  }
}
