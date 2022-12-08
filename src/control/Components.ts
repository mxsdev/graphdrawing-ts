const Declare = {
"componentwise": {
  // key: "componentwise",
  type: "boolean",

  summary: `"
    For algorithms that also support drawing unconnected graphs, use
    this key to enforce that the components of the graph are,
    nevertheless, laid out individually. For algorithms that do not
    support laying out unconnected graphs, this option has no effect
    rather it works as if this option were always set.
  "`,
  examples: [`"
    \tikz \graph [simple necklace layout]
      {
        a // b // c // d // a,
        1 // 2 // 3 // 1
      }
    "`,`",
    \tikz \graph [simple necklace layout, componentwise]
      {
        a // b // c // d // a,
        1 // 2 // 3 // 1
      }
  "`
  ]
},
} as const

export default Declare
