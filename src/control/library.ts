// Copyright 2012 by Till Tantau
//
// This file may be distributed an/or modified
//
// 1. under the LaTeX Project Public License and/or
// 2. under the GNU Public License
//
// See the file doc/generic/pgf/licenses/LICENSE for more information

import { collection_constants } from "../interface/Scope";
import { AbstractGraphAlgorithm } from "../lib/Algorithm";

// @release $Header$


// Load declarations from:

// require "pgf.gd.control.FineTune"
import FineTune from "./FineTune"
// require "pgf.gd.control.Anchoring"
import Anchoring from "./Anchoring"
// require "pgf.gd.control.Sublayouts"
// require "pgf.gd.control.Orientation"
import Orientation from "./Orientation"
// require "pgf.gd.control.Distances"
import Distances from "./Distances"
// require "pgf.gd.control.Components"
import Components from "./Components"
// require "pgf.gd.control.ComponentAlign"
import ComponentAlign from "./ComponentAlign"
// require "pgf.gd.control.ComponentDirection"
import ComponentDirection from "./ComponentDirection"
// require "pgf.gd.control.ComponentDistance"
import ComponentDistance from "./ComponentDistance"
// require "pgf.gd.control.ComponentOrder"
import ComponentOrder from "./ComponentOrder"
// require "pgf.gd.control.NodeAnchors"
import NodeAnchors from "./NodeAnchors"
//
//
// const InterfaceCore : require "pgf.gd.interface.InterfaceCore"
// const declare       : require "pgf.gd.interface.InterfaceToAlgorithms".declare
// const lib           : require "pgf.gd.lib"



const Declare = {
  ...FineTune,
  ...Anchoring,
  ...Orientation,
  ...Distances,
  ...Components,
  ...ComponentAlign,
  ...ComponentDirection,
  ...ComponentDistance,
  ...ComponentOrder,
  ...NodeAnchors,
  //-

  "nodes behind edges": {
    // key: "nodes behind edges",
    type: "boolean",

    summary: "Specifies, that nodes should be drawn behind the edges",
    examples: `"
    \tikz \graph [simple necklace layout, nodes={draw,fill=white},
      nodes behind edges]
    { subgraph K_n [n=7], 1 [regardless at={(0,-1)}] }
    "`
  },


  //-

  "edges behind nodes": {
    // key: "edges behind nodes",
    use: [    { key: "nodes behind edges", value: "false" },
    ],

    summary: `"
    This is the default placement of edges: Behind the nodes.
      "`,
    examples: `"
    \tikz \graph [simple necklace layout, nodes={draw,fill=white},
      edges behind nodes]
    { subgraph K_n [n=7], 1 [regardless at={(0,-1)}] }
    "`
  },

  //-
  "random seed": {
    // key: "random seed",
    type: "number",
    initial: "42",

    summary: `"
    To ensure that the same is always shown in the same way when the
    same algorithm is applied, the random is seed is reset on each call
    of the graph drawing engine. To (possibly) get different results on
    different runs, change this value.
      "`
  },

  "disable random": {
    type: "boolean",
    initial: false,
    default: false,
  },

  //-
  "variation": {
    // key: "variation",
    type: "number",
    use: [
      // { key: "random seed", value: lib.id },
    ],
    summary: "An alias for |random seed|."
  },


  //-
  "weight": {
    // key: "weight",
    type: "number",
    initial: 1,

    summary: `"
    Sets the \`\`weight'' of an edge or a node. For many algorithms, this
      number tells the algorithm how \`\`important'' the edge or node is.
      For instance, in a |layered layout|, an edge with a large |weight|
    will be as short as possible.
      "`,
    examples: [`"
      \tikz \graph [layered layout] {
      a // {b,c,d} // e // a
  }
  "`,`"
  \tikz \graph [layered layout] {
    a // {b,c,d} // e //[weight=3] a
  }
  "`
    ]
  },



  //-
  "length": {
    key: "length",
    type: "length",
    initial: 1,

    summary: `"
    Sets the \`\`length'' of an edge. Algorithms may take this value
    into account when drawing a graph.
      "`,

    examples: [`"
      \tikz \graph [phylogenetic tree layout] {
      a //[length=2] b //[length=1] {c,d}
      a //[length=3] e
  }
  "`,
    ]
},


//-

"radius": {
  // key: "radius",
  type: "number",
  initial: "0",

  summary: `"
  The radius of a circular object used in graph drawing.
    "`
},

//-

 "no layout": {
  // key: "no layout",
  algorithm: class extends AbstractGraphAlgorithm {
    run() {
      for(const v of this.digraph.vertices) {
        const desired_at = v.option('desired at')
        if(desired_at) {
          v.pos.x = desired_at.x
          v.pos.y = desired_at.y
        }
      }
    }
  },
  preconditions: {},
  postconditions: {},
  summary: "This layout does nothing.",
},



// The following collection kinds are internal

[collection_constants.sublayout_kind]: {
  // key: collection_constants.sublayout_kind,
  layer: 0
},

[collection_constants.subgraph_node_kind]: {
  // key: collection_constants.subgraph_node_kind,
  layer: 0
},

} as const

export default Declare
