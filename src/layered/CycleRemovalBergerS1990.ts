import { AbstractGraphAlgorithm } from "../lib/Algorithm"
import { OldEdge } from "../deprecated/OldEdge"
import assert from "assert"
import { OldGraph } from "../deprecated/OldGraph"
import { Node } from "../deprecated/Node"

export abstract class CycleRemovalBergerS1990 extends AbstractGraphAlgorithm {
  abstract nodeOrder(graph: OldGraph): Node[]

  run() {
    assert(this.graph)

    const removed: WeakSet<OldEdge> = new WeakSet()
    const reverse: Set<OldEdge> = new Set()

    for (const node of this.nodeOrder(this.graph)) {
      assert(node)

      const out_edges = node.getOutgoingEdges().filter(e => !removed.has(e))

      const in_edges = node.getIncomingEdges().filter(e => !removed.has(e))

      if (out_edges.length >= in_edges.length) {
        for(const edge of out_edges) {
          removed.add(edge)
        }
        for(const edge of in_edges) {
          reverse.add(edge)
          removed.add(edge)
        }
      } else {
        for(const edge of out_edges) {
          reverse.add(edge)
          removed.add(edge)
        }
        for(const edge of in_edges) {
          removed.add(edge)
        }
      }
    }

    for(const edge of reverse) {
      edge.reversed = true
    }

  } 
}
