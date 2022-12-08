import assert from 'assert'
import { LayoutBB } from "./control/LayoutPipeline";
import { lookup_option } from "./lib/Options";
import { Storage } from "./lib/Storage";
import { Digraph } from "./model/Digraph";
import { Vertex } from "./model/Vertex";

export namespace layered {
  export function ideal_sibling_distance(
    paddings: Storage<Vertex, LayoutBB>,
    graph: Digraph, 
    n1: Vertex, n2: Vertex,
  ): number {
    let ideal_distance: number
    let sep: number

    const n1_is_node = n1.kind === 'node'
    const n2_is_node = n2.kind === 'node'

    if(!n1_is_node && !n2_is_node) {
      ideal_distance = graph.option('sibling distance')
      sep = graph.option('sibling post sep') + graph.option('sibling pre sep') 
    } else {
      ideal_distance = lookup_option('sibling distance', n1_is_node ? n1 : n2, graph)

      sep = ((n1_is_node && lookup_option('sibling post sep', n1, graph) || 0) + 
             (n2_is_node && lookup_option('sibling pre sep', n2, graph) || 0))
    }

    const p_n1 = paddings.get(n1)
    const p_n2 = paddings.get(n2)

    const sep_n1 = (n1_is_node && p_n1?.sibling_post) || 0
    const sep_n2 = (n2_is_node && p_n2?.sibling_pre) || 0

    return Math.max(ideal_distance, sep + (sep_n1 - sep_n2))
  }

  export function baseline_distance(
    paddings: Storage<Vertex, LayoutBB>,
    graph: Digraph, 
    l1: Vertex[], l2: Vertex[],
  ): number {
    if(l1.length === 0 || l2.length === 0) {
      return 0
    }

    let layer_distance = Number.NEGATIVE_INFINITY
    let layer_pre_sep = Number.NEGATIVE_INFINITY
    let layer_post_sep = Number.NEGATIVE_INFINITY

    let max_post = Number.NEGATIVE_INFINITY
    let min_pre = Number.POSITIVE_INFINITY

    for(const n of l1) {
      layer_distance = Math.max(layer_distance, lookup_option('level distance', n, graph))
      layer_post_sep = Math.max(layer_post_sep, lookup_option('level post sep', n, graph))
      if(n.kind === 'node') {
        const pad_n = paddings.get(n)
        assert(pad_n)

        max_post = Math.max(max_post, pad_n.layer_pre)
      }
    }

    for(const n of l2) {
      layer_pre_sep = Math.max(layer_pre_sep, lookup_option('level pre sep', n, graph))
      if(n.kind === "node") {
        const pad_n = paddings.get(n)
        assert(pad_n)

        min_pre = Math.min(min_pre, pad_n.layer_pre)
      }
    }

    return Math.max(
      layer_distance, layer_post_sep +layer_pre_sep + max_post - min_pre 
    )
  }

  export function arrange_layers_by_baselines(
    layers: Storage<Vertex, number>,
    paddings: Storage<Vertex, LayoutBB>,
    graph: Digraph,
  ) {
    const layer_vertices: Vertex[][] = []

    for(const v of graph.vertices) {
      let n = layers.get(v)
      assert(n != null)

      n -= 1

      layer_vertices[n] = layer_vertices[n] ?? []
      layer_vertices[n].push(v)
    }

    if(layer_vertices.length > 0) {
      let height = 0

      for(let i = 0; i < layer_vertices.length; i++) {
        const vertices = layer_vertices[i]
        assert(vertices)

        if(i === 0) {
          for(const v of vertices) {
            v.pos.y = 0
          }
        } else {
          height += layered.baseline_distance(paddings, graph, layer_vertices[i-1], vertices)

          for(const v of vertices) {
            v.pos.y = height
          }
        }
      }
    }
  }
}
