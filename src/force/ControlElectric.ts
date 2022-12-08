const Declare = {
  "electric charge": {
    // key: "electric charge",
    type: "number",
    initial: 1,

    summary: `"
      Defines the electric charge of the node. The stronger the
      |electric charge| of a node the stronger the repulsion between the
      node and others in the graph. A negative |electric charge| means that
      other nodes are further attracted to the node rather than repulsed,
      although in theory this effect strongly depends on how the
      |spring electrical layout| algorithm works.
      Two typical effects of increasing the |electric charge| are distortion
      of symmetries and an upscaling of the drawings.
    "`,
    // examples: [
    //   {
    //     options: `"preamble={\\usetikzlibrary{graphs,graphdrawing} \\usegdlibrary{force}}"`,
    //     code: `"
    //       \\tikz \\graph [spring electrical layout, horizontal=0 to 1]
    //         { 0 [electric charge=1] // subgraph C_n [n=10] }
    //     "`
    //   },{
    //     code: `"
    //       \\tikz \\graph [spring electrical layout, horizontal=0 to 1]
    //         { 0 [electric charge=5] // subgraph C_n [n=10] }
    //     "`
    //   },{
    //     code: `"
    //       \\tikz \\graph [spring electrical layout, horizontal=0 to 1]
    //         { [clique] 1 [electric charge=5], 2, 3, 4 }
    //     "`
    //   }
    // ]
  },


  //-

  "electric force order": {
    // key: "electric force order",
    type: "number",
    initial: "1",

    summary: `"
      Sometimes, when drawing symmetric and mesh-like graphs, the
      peripheral distortion caused by long-range electric forces may be
      undesired. Some electric force models allow to reduce long-range
      forces and distortion effects by increasing
      the order (exponent) of electric forces. Values between 0 and 1
      increase long-range electric forces and the scaling of the
      generated layouts. Value greater than 1 decrease long-range
      electric forces and results in shrinking drawings.
    "`
  },


  //-

  "approximate remote forces": {
    // key: "approximate remote forces",
    type: "boolean",

    summary: `"
      Force based algorithms often need to compute a force for each pair
      of vertices, which, for larger numbers of vertices, can lead to a
      significant time overhead. This problem can be addressed by
      approximating these forces: For a vertex far removed from a cluster
      of vertices, instead of computing the force contribution of each
      vertex of the cluster individually, we form a sort of
      \`\`supervertex'' at the \`\`gravitational center'' of the cluster and
      then compute only the force between this supervertex and the single
      vertex.

      \\emph{Remark:} Currently, the implementation seems to be broken, at
      least the results are somewhat strange when this key is used.
    "`
    }
} as const

export default Declare
