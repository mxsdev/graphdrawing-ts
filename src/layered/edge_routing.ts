import { EdgeRoutingGansnerKNV1993 } from "./EdgeRoutingGansnerKNV1993"

const Declare = {
  "polyline layer edge routing": {
    // key: "polyline layer edge routing",
    algorithm: EdgeRoutingGansnerKNV1993,
    phase: "layer edge routing",
    phase_default: true,

    summary: `"
      This edge routing algorithm uses polygonal lines to connect nodes.
    "`,
    documentation: `"
      For more details, please see Section~4.1.5 of Pohlmann's Diploma thesis.

      This is the default algorithm for edge routing.
    "`
  },
} as const

export default Declare
