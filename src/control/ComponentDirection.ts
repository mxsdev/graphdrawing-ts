const Declare = {
"component direction": {
  // key: "component direction",
  type: "direction",
  initial: "0",

  summary: `"
    The \\meta{angle} is used to determine the relative position of each
    component relative to the previous one. The direction need not be a
    multiple of |90|. As usual, you can use texts like |up| or
    |right| instead of a number.
  "`,
  documentation: `"
    As the examples show, the direction only has an influence on the
    relative positions of the components, not on the direction of growth
    inside the components. In particular, the components are not rotated
    by this option in any way. You can use the |grow| option or |orient|
    options to orient individual components.
  "`,
  examples: [`"
    \\tikz \\graph [tree layout, nodes={inner sep=1pt,draw,circle},
                  component direction=left]
      { a, b, c // d // e, f // g }
  "`,`"
    \\tikz \\graph [tree layout, nodes={inner sep=1pt,draw,circle},
                  component direction=10]
      { a, b, c // d // e, f // g }
  "`,`"
    \\tikz \\graph [tree layout, nodes={inner sep=1pt,draw,circle},
                  component direction=up]
       { a, b, c [grow=right] // d // e, f[grow=45] // g }
  "`
  ]
},
} as const

export default Declare
