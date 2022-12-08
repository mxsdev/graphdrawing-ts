import assert from 'assert';
import { layered } from '../layered';
//-
// @section subsubsection {The Reingold//Tilford Layout}
//
// @end

import { AbstractGraphAlgorithm } from "../lib/Algorithm";
import { Storage } from "../lib/Storage";
import { pairs } from '../lib/Types';
import { Vertex } from '../model/Vertex';
import LibraryDeclarations from './library';

type Decl = typeof LibraryDeclarations

type Layers = Storage<Vertex, number>
type Descendants = Storage<Vertex, Vertex[]>

class ReingoldTilford1981 extends AbstractGraphAlgorithm {
  extended_version?: boolean

  run() {
    assert(this.spanning_tree)
    assert(this.adjusted_bb)

    const root = this.spanning_tree.root
    assert(root)

    const layers: Layers = new WeakMap()
    const descendants: Descendants = new WeakMap()

    this.extended_version = this.digraph.option<Decl, 'missing nodes get space'>('missing nodes get space') 

    this.precomputeDescendants(root, 1, layers, descendants)
    this.computeHorizontalPosition(root, layers, descendants)
    layered.arrange_layers_by_baselines(layers, this.adjusted_bb, this.ugraph)
  }

  precomputeDescendants(node: Vertex, depth: number, layers: Layers, descendants: Descendants) {
    const my_descendants = [ node ]

    for(const arc of this.spanning_tree!.outgoing(node)) {
      const { head } = arc
      this.precomputeDescendants(head, depth+1, layers, descendants)

      my_descendants.push(...(descendants.get(head) ?? []))
    }

    layers.set(node, depth)
    descendants.set(node, my_descendants)
  }

  computeHorizontalPosition(node: Vertex, layers: Layers, descendants: Descendants) {
    const children = this.spanning_tree!.outgoing(node)

    node.pos.x = 0

    const _nlayer = layers.get(node)
    assert(_nlayer)

    const child_depth = _nlayer + 1 

    if(children.length > 0) {
      for(const c of children) {
        this.computeHorizontalPosition(c.head, layers, descendants)
      }

      const right_borders: Record<number, Vertex> = { }

      for(let i = 0; i < children.length - 1; i++) {
        const local_right_borders: Record<number, Vertex> = { }

        for(const d of descendants.get(children.at(i).head) ?? []) {
          const layer = layers.get(d)
          assert(layer != null)

          const x = d.pos.x

          if(this.extended_version || !(layer > child_depth && d.kind === 'dummy')) {
            if(!right_borders[layer] || right_borders[layer].pos.x < x) {
              right_borders[layer] = d
            }
            if(!local_right_borders[layer] || local_right_borders[layer].pos.x < x) {
              local_right_borders[layer] = d
            }
          }
        }

        const left_borders: Record<number, Vertex> = { }

        for(const d of descendants.get(children.at(i+1).head) ?? []) {
          const layer = layers.get(d)
          assert(layer != null)

          const x = d.pos.x
          if(this.extended_version ||!(layer > child_depth && d.kind === 'dummy')) {
            if(!left_borders[layer] || left_borders[layer].pos.x > x) {
              left_borders[layer] = d
            }
          }
        }

        let shift = Number.NEGATIVE_INFINITY
        let first_dist = left_borders[child_depth].pos.x - local_right_borders[child_depth].pos.x
        let is_significant = false

        for(const [ layer, n2 ] of pairs(left_borders)) {
          const n1 = right_borders[layer]
          if(n1) {
            shift = Math.max(
              shift,
              layered.ideal_sibling_distance(this.adjusted_bb!, this.ugraph, n1, n2) + n1.pos.x - n2.pos.x
            )
          }
          if(local_right_borders[layer]) {
            if(layer > child_depth &&
                left_borders[layer].pos.x - local_right_borders[layer].pos.x <= first_dist) {
              is_significant = true
            }
          }
        }

        if(is_significant) {
          shift += this.ugraph.option<Decl, 'significant sep'>('significant sep')
        }

        for(const d of descendants.get(children.at(i+1).head) ?? []) {
          d.pos.x += shift
        }
      }

      node.pos.x = (children.at(0).head.pos.x +children.at(children.length - 1).head.pos.x)/2
    }
  }
}

const Declare = {
//-
"tree layout": {
  // key      : "tree layout",
  algorithm: ReingoldTilford1981,

  preconditions: {
    connected: true,
    tree     : true
  },

  postconditions: {
    upward_oriented: true
  },

  documentation_in: "pgf.gd.trees.doc"
},


//-
"missing nodes get space": {
  // key   : "missing nodes get space",
  type  : "boolean",
  documentation_in: "pgf.gd.trees.doc"
},



//-
"significant sep": {
  // key    : "significant sep",
  type   : "length",
  initial: "0",
  documentation_in: "pgf.gd.trees.doc"
},


//-
"binary tree layout": {
  // key : "binary tree layout",
  use: [
    { key: "tree layout" },
    { key: "minimum number of children" , value: 2 },
    { key: "significant sep", value: 10 },
  ],
  documentation_in: "pgf.gd.trees.doc"
},

//-
"extended binary tree layout": {
  // key: "extended binary tree layout",
  use: [
    { key: "tree layout" },
    { key: "minimum number of children" , value: 2 },
    { key: "missing nodes get space" },
    { key: "significant sep", value: 0 },
  ],
  documentation_in: "pgf.gd.trees.doc"
},
} as const

export default Declare
