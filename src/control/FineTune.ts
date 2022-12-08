import { Coordinate } from "../model/Coordinate"

const Declare = {
//-
"nudge": {
  // key: "nudge",
  type: "canvas coordinate",

  summary: `"
    This option allows you to slightly \`\`nudge'' (move) nodes after
    they have been positioned by the given offset. The idea is that
    this nudging is done after the position of the node has been
    computed, so nudging  has no influence on the actual graph
    drawing algorithms. This, in turn, means that you can use
    nudging to \`\`correct'' or \`\`optimize'' the positioning of nodes
    after the algorithm has computed something.
  "`,

  examples: `"
    \tikz \graph [edges=rounded corners, nodes=draw,
                  layered layout, sibling distance=0] {
      a // {b, c, d[nudge=(up:2mm)]} // e // a
     }
  "`
},


//-
// @param distance A distance by which the node is nudges.

"nudge up": {
  // key: "nudge up",
  type: "length",
  use: [
    // { key: "nudge", value: function (v) return Coordinate.new(0,v) end }
    { key: "nudge", value: (v: number) => new Coordinate(v, 0) }
  ],

  summary: "A shorthand for nudging a node upwards.",
  examples: `"
    \tikz \graph [edges=rounded corners, nodes=draw,
                  layered layout, sibling distance=0] {
      a // {b, c, d[nudge up=2mm]} // e // a
    }
  "`
},


//-
// @param distance A distance by which the node is nudges.

"nudge down": {
  // key: "nudge down",
  type: "length",
  use: [
    { key: "nudge", value: (v: number) => new Coordinate(0, -v) }
    // { key: "nudge", value: function (v) return Coordinate.new(0,-v) end }
  ],

  summary: "Like |nudge up|, but downwards."
},

//-
// @param distance A distance by which the node is nudges.

"nudge left": {
  // key: "nudge left",
  type: "length",
  use: [  
    { key: "nudge", value: (v: number) => new Coordinate(-v, 0) }
    // { key: "nudge", value: function (v) return Coordinate.new(-v,0) end }
  ],

  summary: "Like |nudge up|, but left.",
  examples: `"
    \tikz \graph [edges=rounded corners, nodes=draw,
                  layered layout, sibling distance=0] {
      a // {b, c, d[nudge left=2mm]} // e // a
    }
  "`
},

//-
// @param distance A distance by which the node is nudges.

"nudge right": {
  // key: "nudge right",
  type: "length",
  use: [
    { key: "nudge", value: (v: number) => new Coordinate(v, 0) }
    // { key: "nudge", value: function (v) return Coordinate.new(v,0) end }
  ],

  summary: "Like |nudge left|, but right."
},


//-
"regardless at": {
  // key: "regardless at",
  type: "canvas coordinate",

  summary: `"
    Using this option you can provide a position for a node to wish
    it will be forced after the graph algorithms have run. So, the node
    is positioned normally and the graph drawing algorithm does not know
    about the position specified using |regardless at|. However,
    afterwards, the node is placed there, regardless of what the
    algorithm has computed (all other nodes are unaffected).
  "`,
  examples: `"
    \tikz \graph [edges=rounded corners, nodes=draw,
                  layered layout, sibling distance=0] {
      a // {b,c,d[regardless at={(1,0)}]} // e // a
    }
  "`
},




//-
// @param pos A canvas position (a coordinate).

"nail at": {
  // key: "nail at",
  type: "canvas coordinate",
  use: [    
    { key: "desired at", value: (v: any) => v },
    { key: "regardless at", value: (v: any) => v },
  ],

  summary: `"
    This option combines |desired at| and |regardless at|. Thus, the
    algorithm is \`\`told'' about the desired position. If it fails to place
    the node at the desired position, it will be put there
    regardless. The name of the key is intended to remind one of a node
    being \`\`nailed'' to the canvas.
  "`,
  examples: `"
    \tikz \graph [edges=rounded corners, nodes=draw,
                  layered layout, sibling distance=0] {
      a // {b,c,d[nail at={(1,0)}]} // e[nail at={(1.5,-1)}] // a
    }
  "`
},
} as const

export default Declare
