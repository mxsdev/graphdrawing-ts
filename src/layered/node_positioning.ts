import { NodePositioningGansnerKNV1993 } from "./NodePositioningGansnerKNV1993"

const Declare = {
  "linear optimization node positioning": {
    // key: "linear optimization node positioning",
    algorithm: NodePositioningGansnerKNV1993,
    phase: "node positioning",
    phase_default: true,

    summary: `"
      This node positioning method, due to Gasner et al., is based on a
      linear optimization problem.
    "`,
    documentation: `"
      For more details, please see Section~4.1.3 of Pohlmann's Diploma thesis.

      This is the default algorithm for layer assignments.
    "`
  },
} as const

export default Declare
