import assert from "assert";
import { ComponentOrderingFunction } from "../control/LayoutPipeline";
import { DefaultDeclarations } from "../interface/InterfaceCore";
import { Scope } from "../interface/Scope";
import { Declarations } from "../lib/Declarations";
import { algPhaseFunc, GDOptions, optFunc, WithOptions } from "../lib/Options";
import { OrderedMap } from "../lib/OrderedMap";
import { OrderedSet } from "../lib/OrderedSet";
import { pairs, Primify, RandomSeed, SpanPriorityOption } from "../lib/Types";
import { Arc, IArc } from "./Arc";
import { CollectionOptions } from "./Collection";
import { Coordinate } from "./Coordinate";
import { Vertex } from "./Vertex";

type ComponentAlign =
  | 'counterclockwise bounding box'
  | 'counterclockwise'
  | 'center'
  | 'clockwise'
  | 'first node'

export type DigraphOptions = { } & {
  [key in SpanPriorityOption]?: number
}

type SyntacticDigraph = Digraph

interface IDigraphParams {
  vertices: OrderedSet<Vertex>
  arcs: IArc[]
  syntactic_digraph: SyntacticDigraph
  options?: DigraphOptions
}

export class Digraph implements IDigraphParams, WithOptions<DigraphOptions>  {
  vertices: OrderedSet<Vertex>
  arcs: IArc[]
  syntactic_digraph: SyntacticDigraph
  _options: DigraphOptions
  _options_proxy?: DigraphOptions
  scope?: Scope
  root?: Vertex

  static copy(digraph: Digraph): Digraph {
    const res = new Digraph(digraph)

    res._options = digraph._options
    res._options_proxy = digraph._options_proxy

    res.root = digraph.root
    res.scope = digraph.scope

    return res
  }

  // option<K extends keyof DigraphOptions>(key: K, raw?: boolean | undefined) {
  //   if(raw) return this._options[key]
  //   // return this._option_proxy?.[key] ?? this._options[key] 
  //   return this._options[key] ?? this._options_proxy?.[key]!
  // }

  // option
  // <
  //   Decl extends Declarations =
  //     typeof DefaultDeclarations,
  //   K extends keyof GDOptions<Decl, DigraphOptions> =
  //     keyof GDOptions<Decl, DigraphOptions>
  // >
  // (
  //   key: K,
  //   raw?: boolean
  // ): GDOptions<Decl, DigraphOptions>[K] {
  //     if(raw) return this._options[key as keyof typeof this._options] as any
  //     return this._options[key as keyof typeof this._options] ?? this._options_proxy?.[key as keyof typeof this._options_proxy]  as any
  // }

  option = optFunc<DigraphOptions>()
  option_algorithm_phase = algPhaseFunc<DigraphOptions>()

  constructor({ vertices, syntactic_digraph, options }: Omit<Partial<IDigraphParams>, 'arcs'>, options_from?: WithOptions<DigraphOptions>) {
    this._options = options ?? {
    }

    if(options_from) {
      this._options = options ?? options_from._options
      this._options_proxy = options_from._options_proxy
    }

    this.vertices = new OrderedSet()
    this.arcs = []

    if (vertices) {
      this.add(...vertices)
    }

    this.syntactic_digraph = syntactic_digraph ?? this
  }

  add(...array: Vertex[]) {
    array.forEach((v) => {
      if (!this.vertices.has(v)) {
        this.vertices.add(v)
        v.incomings.set(this, new OrderedMap())
        v.outgoings.set(this, new OrderedMap())
      }
    })
  }

  remove(array: Vertex[]) {
    array.forEach((v) => {
      assert(this.vertices.has(v), "to-be-deleted node is not in graph")
      this.vertices.delete(v)
    })

    array.forEach((v) => {
      this.disconnect(v)
    })
  }

  contains(v: Vertex) {
    return this.vertices.has(v)
  }

  arc(tail: Vertex, head: Vertex) {
    const out = tail.outgoings.get(this)

    if (out) {
      return out.get(head)
    }
  }

  outgoing(v: Vertex) {
    const res = v.outgoings.get(this)
    assert(res, "vertex not in graph")
    return res
  }

  sortOutgoing(v: Vertex, compareFn: (a: IArc, b: IArc) => number) {
    this.outgoing(v).sort(compareFn)
  }

  incoming(v: Vertex) {
    const res = v.incomings.get(this)
    assert(res, "vertex not in graph")
    return res
  }

  sortIncoming(v: Vertex, compareFn: (a: IArc, b: IArc) => number) {
    this.incoming(v).sort(compareFn)
  }

  private orderArcs(v: Vertex, vertices: Vertex[], direction: 'outgoing' | 'incoming') {
    const arcmap = this[direction](v)
    assert(vertices.length === arcmap.length)

    const lookup = vertices.reduce<WeakMap<Vertex, number>>((prev, curr, i) => {
      prev.set(curr, i)
      return prev
    }, new WeakMap())

    const reordered: IArc[] = []
    for (const arc of arcmap.values()) {
      const idx = lookup.get(arc.head)
      assert(idx != null)

      reordered[idx] = arc
    }

    for (let i = 0; i < arcmap.length; i++) {
      const replaced = reordered[i]
      assert(replaced)

      arcmap._setValue(i, replaced)
    }
  }

  orderIncoming(v: Vertex, vertices: Vertex[]) {
    return this.orderArcs(v, vertices, 'incoming')
  }

  orderOutgoing(v: Vertex, vertices: Vertex[]) {
    return this.orderArcs(v, vertices, 'outgoing')
  }

  connect(s: Vertex, t: Vertex) {
    assert(this.vertices.has(s), `graph does not have vertex ${s.name}`)
    assert(this.vertices.has(t), `graph does not have vertex ${t.name}`)

    const s_outgoings = s.outgoings.get(this)
    assert(s_outgoings)

    let arc = s_outgoings.get(t)

    if (!arc) {
      // Ok, create and insert new arc object
      arc = {
        tail: s,
        head: t,
        option_cache: {},
        syntactic_digraph: this.syntactic_digraph,
        syntactic_edges: [],
      }

      // Insert into outgoings:
      s_outgoings.set(t, arc)

      const t_incomings = t.incomings.get(this)
      assert(t_incomings)
      // Insert into incomings:
      t_incomings.set(s, arc)

      this.arcs.push(arc)
    }

    return arc
  }

  disconnect(v: Vertex, t?: Vertex) {
    if (t) {
      const s_outgoings = v.outgoings.get(this)
      const t_incomings = t.incomings.get(this)

      assert(s_outgoings, "tail node not in graph")
      assert(t_incomings, "head node not in graph")

      if (s_outgoings.get(t)) {
        s_outgoings.remove(t)
        t_incomings.remove(v)
        this.arcs = []
      }
    } else {
      // Case 1: Remove all arcs incident to v:

      // Step 1: Delete all incomings arcs:
      const incomings = v.incomings.get(this)
      assert(incomings, "node not in graph")

      for (const { tail: s } of incomings) {
        if (s !== v && this.vertices.has(s)) {
          const s_outgoings = s.outgoings.get(this)
          assert(s_outgoings)

          s_outgoings.remove(v)
        }
      }

      // Step 2: Delete all outgoings arcs:
      const outgoings = v.outgoings.get(this)
      assert(outgoings, "node not in graph")

      for (const { head: _t } of outgoings) {
        if (_t !== v && this.vertices.has(_t)) {
          const t_incomings = _t.incomings.get(this)
          assert(t_incomings)

          t_incomings.remove(v)
        }
      }

      if (incomings.length > 0 || outgoings.length > 0) {
        this.arcs = []
      }

      v.incomings.set(this, new OrderedMap())
      v.outgoings.set(this, new OrderedMap())
    }
  }

  private static mergeArcs(merge_into: IArc, merge_from: IArc) {
    for (const [k, v] of pairs(merge_from)) {
      if (k !== 'head' && k !== 'tail') {
        // @ts-ignore
        merge_into[k] = v
      }
    }
  }

  reconnect(arc: IArc, tail: Vertex, head: Vertex) {
    if (arc.head === head && arc.tail === tail) {
      // Nothing to be done
      return arc
    } else {
      const new_arc = this.connect(tail, head)

      Digraph.mergeArcs(new_arc, arc)

      this.disconnect(arc.tail, arc.head)

      return new_arc
    }
  }

  collapse(collapse_vertices: Vertex[],
    collapse_vertex?: Vertex,
    vertex_fun?: (collapse: Vertex, collapsed: Vertex) => void,
    arc_fun?: (new_arc: IArc, old_arc: IArc) => void) {
    // Create and add node, if necessary.
    if (!collapse_vertex) {
      collapse_vertex = new Vertex({})
    }
    this.add(collapse_vertex)

    // Copy the collapse_vertices and create lookup
    const cvs = new Set(collapse_vertices)

    assert(!cvs.has(collapse_vertex), "collapse_vertex is in collapse_vertices")

    const collapsed_arcs: IArc[] = []

    for (const v of cvs) {
      vertex_fun?.(collapse_vertex, v)

      const v_outgoings = v.outgoings.get(this)
      assert(v_outgoings)

      for (const a of v_outgoings) {
        if (!cvs.has(a.head)) {
          arc_fun?.(this.connect(collapse_vertex, a.head), a)
          collapsed_arcs.push(a)
        }
      }

      const v_incomings = v.incomings.get(this)
      assert(v_incomings)

      for (const a of v_incomings) {
        if (!cvs.has(a.tail)) {
          arc_fun?.(this.connect(a.tail, collapse_vertex), a)
        }
        collapsed_arcs.push(a)
      }
    }


    // remember the old vertices.
    collapse_vertex.collapsed_vertices = [...cvs]
    collapse_vertex.collapsed_arcs = collapsed_arcs

    return collapse_vertex
  }

  expand(vertex: Vertex,
    vertex_fun?: (collapse: Vertex, reinstalled: Vertex) => void,
    arc_fun?: (arc: IArc, vertex: Vertex) => void) {
    const cvs = vertex.collapsed_vertices
    assert(cvs, "no expand information stored")

    // Add all vertices:
    for (const v of cvs) {
      this.add(v)
      vertex_fun?.(vertex, v)
    }

    const arcs = vertex.collapsed_arcs
    assert(arcs)

    // Add all arcs:
    for (const arc of arcs) {
      let new_arc = this.connect(arc.tail, arc.head)

      Digraph.mergeArcs(new_arc, arc)

      arc_fun?.(new_arc, vertex)
    }
  }

  sync() {
    for (const a of this.arcs) {
      Arc.sync(a)
    }
  }

  toString() {
    // TODO
    return ""
  }

  copy(): Digraph {
    return Digraph.copy(this)
  }

  /**
   * @internal
   */
  __debug() {
    return {
      nodes: this.vertices.getArray().map(v => v.__debug()),
      edges: this.arcs.map(a => Arc.__debug(a)),
    }
  }
}
