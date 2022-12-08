const Declare = {
"spring constant": {
  // key: "spring constant",
  type: "number",
  initial: "0.01",

  summary: `"
    The \`\`spring constant'' is a factor from Hooke's law describing the
    \`\`stiffness'' of a spring. This factor is used inside spring-based
    algorithms to determine how strongly edges \`\`pull'' and \`\`push'' at
    the nodes they connect.
  "`
},
} as const

export default Declare
