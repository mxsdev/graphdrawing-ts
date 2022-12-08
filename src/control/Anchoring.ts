const Declare = {
//-
"desired at": {
  // key: "desired at",
  type: "coordinate",
  documentation_in: "pgf.gd.control.doc"
},

//-
"anchor node": {
  // key: "anchor node",
  type: "string",
  documentation_in: "pgf.gd.control.doc"
},


//-
"anchor at": {
  // key: "anchor at",
  type: "canvas coordinate",
  initial: "(0pt,0pt)",
  documentation_in: "pgf.gd.control.doc"
},


//-
"anchor here": {
  // key: "anchor here",
  type: "boolean",
  documentation_in: "pgf.gd.control.doc"
},
} as const

export default Declare
