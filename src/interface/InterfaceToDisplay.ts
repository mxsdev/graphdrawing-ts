import assert from "assert";
import { LayoutPipeline } from "../control/LayoutPipeline";
import { Event } from '../lib/Event';
import { IArc } from "../model/Arc";
import { Collection } from "../model/Collection";
import { Edge, EdgeDirection } from "../model/Edge";
import { Path } from "../model/Path";
import { Vertex, VertexAnchors } from "../model/Vertex";
import { CreateVertexOptions, IBinding } from "./IBinding";
import { InterfaceCore } from "./InterfaceCore";
import { collection_constants, Scope } from "./Scope";

const phase_unique = "____________phase_unqiue"
const collections_unique = "____________collections_unqiue"

export type InterfaceRenderGraphResult = ReturnType<InterfaceToDisplay['renderGraph']>

export class InterfaceToDisplay {
  _option_cache: typeof this.core.option_initial = {}

  constructor(
    private core: InterfaceCore
  ) { }

  get binding() {
    return this.core.binding
  }

  beginGraphDrawingScope(height: number) {
    const scope = new Scope(this.binding, {})

    const g = scope.syntactic_digraph;

    // const [ _o, _op ] = this.get_current_options_table(height)
    // g._options = _o as DigraphOptions
    // g._option_proxy = _op as DigraphOptions

    this.assign_current_options_table(g, height)
    g.syntactic_digraph = g
    g.scope = scope

    this.core.pushScope(scope)
  }

  runGraphDrawingAlgorithm() {
    const scope = this.core.topScope()

    if (scope.syntactic_digraph.vertices.size === 0) {
      return
    }

    LayoutPipeline.run(scope)

    // TODO: this is normally done with a coroutine, and
    //       sends a "resumeGraphDrawingCoroutine" when
    //       the corourinte is resumed. this behaviour
    //       may need to be emulated
    //
    //       see line 214 of InterfaceToDisplay.lua
  }

  endGraphDrawingScope() {
    this.core.popScope()
  }

  createVertex(
    name: string,
    shape: string|undefined,
    path: Path | undefined,
    height: number,
    binding_infos?: any,
    anchors?: VertexAnchors,
  ) {
    const scope = this.core.topScope()
    const binding = this.binding

    let v = scope.node_names[name]
    assert(!v || !v.created_on_display_layer, "node already created")

    if (!v) {
      v = new Vertex({
        name, shape,
        kind: "node",
        path, anchors
      })

      // const [ _o, _op ] = this.get_current_options_table(height)
      //
      // v._options = _o as VertexOptions
      // v._options_proxy = _op as VertexOptions

      this.assign_current_options_table(v, height)

      this.vertex_created(v, name, scope)
    } else {
      assert(v.kind === 'subgraph node', "subgraph node expected")
      if(shape) v.shape = shape
      if (path) v.path = path
      if (anchors) v.anchors = anchors
    }

    v.created_on_display_layer = true

    binding?.storage.set(v, binding_infos)

    binding?.everyVertexCreation(v)
  }

  private vertex_created(v: Vertex, vname: string, scope: Scope) {
    const e = this.core.createEvent("node", v)
    v.event = e

    scope.node_names[vname] = v

    scope.syntactic_digraph.add(v)

    for (const c of v.option('collections')) {
      c.vertices.push(v)
    }
  }

  pushSubgraphVertex(name: string, height: number, info: CreateVertexOptions) {
    const scope = this.core.topScope()
    const binding = this.binding

    assert(!scope.node_names[name], "node already created")

    const v = new Vertex({
      name, kind: 'subgraph node'
    })

    this.assign_current_options_table(v, height - 1)

    this.vertex_created(v, name, scope)

    info.generated_options = info.generated_options ?? {}
    info.name = name
    v.subgraph_info = info

    const [_, __, entry] = this.pushOption(collection_constants.subgraph_node_kind, undefined, height)
    v.subgraph_collection = entry.value
    assert(v.subgraph_collection)
    v.subgraph_collection.subgraph_node = v

    const collections = v.option('collections')
    for (let i = collections.length - 1; i >= 0; i--) {
      const col = collections[i]
      if (col.kind === collection_constants.sublayout_kind) {
        v.subgraph_collection!.parent_layout = col
        break
      }
    }
  }

  addToVertexOptions(name: string, height: number) {
    const scope = this.core.topScope()

    const v = scope.node_names[name]
    assert(v, "node is missing, cannot add options")

    // v.options = this.get_current_options_table(height, v._options)
    this.assign_current_options_table(v, height, { ...v._options_proxy, ...v._options })

    for (const c of v.option('collections')) {
      c.vertices.push(v)
    }
  }

  createEdge(
    tail: string, head: string,
    direction: EdgeDirection,
    height: number,
    binding_infos?: any
  ) {
    const scope = this.core.topScope()
    const binding = this.binding

    const h = scope.node_names[head]
    const t = scope.node_names[tail]
    assert(h && t, "attempting to create edge between nodes that are not in the graph")

    const arc = scope.syntactic_digraph.connect(t, h)

    const edge = new Edge({
      head: h, tail: t, direction,
      generated_options: [],
      event: undefined as unknown as Event
    })

    this.assign_current_options_table(edge, height)

    arc.syntactic_edges.push(edge)

    const e = this.core.createEvent("edge", [arc, arc.syntactic_edges.length])
    edge.event = e

    for (const c of edge.option('collections')) {
      c.edges.push(edge)
    }

    binding?.storage.set(edge, binding_infos)
    binding?.everyEdgeCreation(edge)
  }

  // private static createEvent<K extends EventKind>(scope: Scope, kind: K, param: EventParams[K]): Event<K> {
  //   const n = scope.events.length + 1 
  //   const e = new Event({ kind, parameters: param, index: n })
  //   scope.events.push(e)
  //
  //   return e
  // }

  pushOption(key: string, value: any, height: number): [number, boolean, any] {
    const key_record = this.core.keys[key]
    let main_phase_set = false

    assert(key_record, "unknown key")

    if (value === undefined && key_record.default) {
      value = key_record.default
    }

    if (key_record.algorithm) {
      const algorithm = this.core.algorithm_classes[key]

      assert(algorithm, "algorithm class not found")

      this.push_on_option_stack(
        phase_unique,
        { phase: value ?? key_record.phase, algorithm },
        height
      )

      if (key_record.phase === 'main') {
        main_phase_set = true
      }
    } else if (key_record.layer != null) {
      const scope = this.core.topScope()

      // const options = 

      const event = this.core.createEvent('collection', key)

      const collection = new Collection({ kind: key, event })
      const [_o, _op] = this.assign_current_options_table(collection, height - 1)

      const collections = scope.collections[key] ?? []
      collections.push(collection)
      scope.collections[key] = collections

      const opt_colls = _o?.['collections'] ?? _op?.['collections']
      collection.registerAsChildOf(opt_colls[opt_colls.length - 1])

      this.push_on_option_stack(collections_unique, collection, height)
    } else {
      this.push_on_option_stack(
        key,
        InterfaceCore.convert(value, key_record.type),
        height
      )
    }

    const newly_created = this.core.option_stack[this.core.option_stack.length - 1]
    assert(newly_created)

    const use = key_record.use
    if (use) {
      let flag: boolean
      for (const u of use) {
        let { key: use_k, value: use_v } = u

        if (typeof use_k === 'function') {
          use_k = use_k(value)
        }
        if (typeof use_v === 'function') {
          use_v = use_v(value)
        }
        [height, flag] = this.pushOption(use_k, use_v, height + 1)
        main_phase_set = main_phase_set || flag
      }
    }

    return [height, main_phase_set, newly_created]
  }

  pushLayout(height: number) {
    this.pushOption(collection_constants.sublayout_kind,
      undefined, height
    )
  }

  getDeclaredKeys() {
    return this.core.keys
  }

  renderGraph() {
    const scope = this.core.topScope()
    const syntactic_digraph = scope.syntactic_digraph

    const binding = this.binding

    binding?.renderStart()
    const vertices = render_vertices(syntactic_digraph.vertices, binding)
    const edges = render_edges(syntactic_digraph.arcs, binding)
    const collections = render_collections(scope.collections, this.core, binding)
    binding?.renderStop()

    return { vertices: syntactic_digraph.vertices.getArray(), edges, collections }
  }

  private assign_current_options_table(obj: { _options?: any, _options_proxy?: any }, height: number, table?: any) {
    const [_o, _op] = this.get_current_options_table(height, table)

    obj._options = _o
    obj._options_proxy = _op

    return [_o, _op]
  }

  private get_current_options_table(height: number, table?: any): [raw: Record<string, any>, proxy: Record<string, any>] {
    const stack = this.core.option_stack
    assert(height >= 0 && height <= stack.length, "height value out of bounds")

    if (height === this.core.option_cache_height && !table) {
      return [this._option_cache, this.core.option_initial]
    } else {
      stack.splice(height+1)

      let cache: Record<string, any>

      if (!table) {
        cache = {
          algorithm_phases: {
            ["preprocessing stack"]: [],
            ["edge routing stack"]: [],
            ["postprocessing stack"]: [],
          },
          collections: [],
        }
      } else {
        cache = {
          ...table,
          algorithm_phases: { ...(table.algorithm_phases) },
          collections: [...(table.collections)]
        }
      }

      const { algorithm_phases, collections } = cache

      const handle = (k: string, v: any) => {
        if (k === phase_unique) {
          assert(v.phase)
          assert(v.algorithm)

          algorithm_phases[v.phase] = v.algorithm
          let phase_stack = v.phase + " stack"

          // TODO: this is slightly different than the original
          let t = algorithm_phases[phase_stack]
          if (!t) {
            t = this.core.option_initial.algorithm_phases[phase_stack]
            assert(typeof t === 'object', `unknown phase ${v.phase}`)
            t = [...t]
            algorithm_phases[phase_stack] = t
          }
          t.push(v.algorithm)
        } else if (k === collections_unique) {
          collections.push(v)
        } else {
          cache[k] = v
        }
      }

      for (const s of stack) {
        handle(s.key, s.value)
      }

      if (!table) {
        this.core.option_cache_height = height
        this._option_cache = cache
      }

      return [cache, this.core.option_initial]
    }
  }

  push_on_option_stack(key: string, value: any, height: number) {
    const stack = this.core.option_stack

    assert(height >= 0 && height <= stack.length, "height value out of bounds")

    stack.splice(height)

    stack[height] = { key, value }
    delete this.core.option_cache_height // invalidate cache 
  }
}

function render_vertices(vertices: Iterable<Vertex>, binding?: IBinding) {
  binding?.renderVerticesStart()
  for (const vertex of vertices) {
    binding?.renderVertex(vertex)
  }
  binding?.renderVerticesStop()

  return vertices
}

function render_collections(collections: Record<string, Collection[]>, core: InterfaceCore, binding?: IBinding) {
  const kinds = core.collection_kinds

  const renderedCollections: Record<string, Record<number, Collection[]>> = {}

  for (const { kind, layer } of kinds.values()) {
    if (layer !== 0) {
      binding?.renderCollectionsStartKind(kind, layer)

      renderedCollections[kind] = renderedCollections[kind] ?? {}
      renderedCollections[kind][layer] = renderedCollections[kind][layer] ?? []

      const rendered = renderedCollections[kind][layer]

      for (const c of collections[kind] ?? []) {
        binding?.renderCollection(c)
        rendered.push(c)
      }
      binding?.renderCollectionsStopKind(kind, layer)
    }
  }

  return renderedCollections
}

function render_edges(arcs: IArc[], binding?: IBinding) {
  const renderedEdges: Edge[] = []

  binding?.renderEdgesStart()
  for (const a of arcs) {
    for (const e of a.syntactic_edges) {
      binding?.renderEdge(e)
      renderedEdges.push(e)
    }
  }
  binding?.renderEdgesStop()

  return renderedEdges
}
