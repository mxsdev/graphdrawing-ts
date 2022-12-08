//-

const Declare = {
"hyper": {
  // key: "hyper",
  layer: -10,

  summary: `"
    A \\emph{hyperedge} of a graph does not connect just two nodes, but
    is any subset of the node set (although a normal edge is also a
    hyperedge  that happens to contain just two nodes). Internally, a
    collection of kind |hyper| is created. Currently, there is
    no default renderer for hyper edges.
  "`,
  documentation: `"
\\begin{codeexample}[code only]
\\graph {
  % The nodes:
  a, b, c, d

  % The edges:
  {[hyper] a,b,c}
  {[hyper] b,c,d}
  {[hyper] a,c}
  {[hyper] d}
},
\\end{codeexample}
  "`
}
} as const

export default Declare
