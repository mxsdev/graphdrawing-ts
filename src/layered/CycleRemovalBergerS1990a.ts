import assert from "assert"
import { OldEdge } from "../deprecated/OldEdge"
import { OldGraph } from "../deprecated/OldGraph"
import { AbstractGraphAlgorithm } from "../lib/Algorithm"
import { CycleRemovalBergerS1990 } from './CycleRemovalBergerS1990'

export class CycleRemovalBergerS1990a extends CycleRemovalBergerS1990 {
  nodeOrder(graph: OldGraph) {
    return graph.nodes
  }
}
