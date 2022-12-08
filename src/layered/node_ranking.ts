import { NodeRankingGansnerKNV1993 } from "./NodeRankingGansnerKNV1993"
import { NodeRankingMinimumHeight } from "./NodeRankingMinimumHeight"

const Declare  = {
  "linear optimization layer assignment": {
  // key: "linear optimization layer assignment",
  algorithm: NodeRankingGansnerKNV1993,
  phase: "node ranking",
  phase_default: true,

  summary: `"
    This layer assignment method, due to Gasner et al., is based on a
    linear optimization problem.
  "`,
  documentation: `"
    For more details, please see Section~4.1.2 of Pohlmann's Diploma
    thesis.

    This is the default algorithm for layer assignments.
  "`
},



//-

"minimum height layer assignment": {
  // key: "minimum height layer assignment",
  algorithm: NodeRankingMinimumHeight,
  phase: "node ranking",

  summary: `"
    This layer assignment method minimizes the height of the resulting graph.
  "`,
  documentation: `"
    For more details, please see Section~4.1.3 of Pohlmann's Diploma thesis.
  "`
},
} as const

export default Declare
