import { AbstractGraphAlgorithm } from "../lib/Algorithm"
import { OldEdge } from "../deprecated/OldEdge"
import assert from "assert"
import { randomPermutation } from "../lib/Random"
import { CycleRemovalBergerS1990 } from "./CycleRemovalBergerS1990"
import { Node } from "../deprecated/Node"
import { OldGraph } from "../deprecated/OldGraph"

export class CycleRemovalBergerS1990b extends CycleRemovalBergerS1990 {
  nodeOrder(graph: OldGraph): Node[] {
    return randomPermutation(
      this.random,
      graph.nodes.length
    ).map(i => graph.nodes[i])
  }
}
