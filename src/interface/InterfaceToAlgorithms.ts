import assert from "assert"
import { LayoutPipeline } from "../control/LayoutPipeline"
import { GraphAlgorithm, GraphAlgorithmConstructor, GraphAlgorithmPostConditions, GraphAlgorithmPreConditions, IGraphAlgorithm } from "../lib/Algorithm"
import { Collection } from "../model/Collection"
import { Edge, EdgeOptions, IEdgeParams } from "../model/Edge"
import { Vertex, VertexOptions } from "../model/Vertex"
import { CreateVertexOptions } from "./IBinding"
import { InterfaceCore, UnitType } from "./InterfaceCore"
import { collection_constants } from "./Scope"

// type DeclareType = 'string'|'boolean'

let unique_count = 1

export type DeclareTable = {
  layer?: number,
  type?: UnitType|'hidden',
  initial?: any,
  default?:any, 
  alias?: string|((...args: any[]) => any),
  use?: readonly {
    key: string|((val?: any) => string),
    value?: any,
  }[],
  summary?: string,
  examples?: string|readonly string[],
  documentation?: string,
  documentation_in?: string,
} & (
  ({
    algorithm: GraphAlgorithmConstructor,
    phase?: string,
    preconditions?: GraphAlgorithmPreConditions,
    postconditions?: GraphAlgorithmPostConditions,
    phase_default?: boolean,
    old_graph_model?: boolean,
  })
|{algorithm?: undefined}) 

export type QualifiedDeclareTable = DeclareTable & { key: string }

type DeclareHandlerTest = (t: QualifiedDeclareTable) => boolean|undefined
type DeclareHandlerFunc = DeclareHandlerTest
type DeclareHandler = { test: DeclareHandlerTest, handler: DeclareHandlerFunc }

export class InterfaceToAlgorithms {
  // private keys: Set<string> = new Set()

  private declare_handlers: DeclareHandler[] = [
    { test: (t) => 'algorithm' in t, handler: this.declare_algorithm },
    { test: (t) => 'layer' in t && t.layer != null, handler: this.declare_collection_kind },
    { test: (t) => true, handler: this.declare_parameter },
  ]

  constructor(private core: InterfaceCore) { }

  addHandler(test: DeclareHandlerTest, handler: DeclareHandlerFunc) {
    this.declare_handlers.push({ test, handler })
  }

  declare(t: QualifiedDeclareTable) {
    const keys = this.core.keys

    assert(t.key !== "", "parameter key may not be the empty string")

    if(keys[t.key] || t.key === "algorithm_phases") {
      throw new Error(`parameter '${t.key}' already declared`)
    }

    for(const h of this.declare_handlers) {
      if(h.test(t)) {
        if(h.handler.call(this, t)) {
          break
        }
      }
    }

    keys[t.key] = t
  }

  declare_parameter(t: QualifiedDeclareTable) {
    t.type = t.type || 'string'

    if(t.type === 'boolean' && t.default === undefined) {
      t.default = true
    }

    if(t.type !== 'hidden') {
      this.core.binding?.declareCallback(t)

      if(t.initial) {
        this.core.option_initial[t.key] = InterfaceCore.convert(t.initial, t.type)
      }
    }

    // TODO: alias_function_string

    if(t.alias) {
      this.core.option_aliases[t.key] = t.alias
    }

    return true
  }

  declare_algorithm(t: QualifiedDeclareTable) {
    assert(t.algorithm)

    t.phase = t.phase ?? 'main'

    const store_me: GraphAlgorithm = t.phase === 'spanning tree computation' ? {
      constructor: t.algorithm,
      preconditions: t.preconditions ?? {},
      phase: t.phase,
      postconditions: t.postconditions ?? {},
      old_graph_algorithm: !!t.old_graph_model,
    } : {
      constructor: t.algorithm,
      preconditions: t.preconditions ?? {},
      phase: t.phase ?? 'main',
      postconditions: t.postconditions ?? {},
      old_graph_algorithm: !!t.old_graph_model,
    }

    this.core.algorithm_classes[t.key] = store_me

    assert(t.type === undefined, "type may not be set for an algorithm key")
    t.type = "string"

    if(t.phase_default) {
      assert(!this.core.option_initial.algorithm_phases[t.phase],
            "default algorithm for phase already set")

      this.core.option_initial.algorithm_phases[t.phase] = store_me
      this.core.option_initial.algorithm_phases[t.phase + " stack"] = [ store_me ]
    } else {
      this.core.option_initial.algorithm_phases[t.phase + " stack"] = [ ]
    }

    return true
  }

  declare_collection_kind(t: QualifiedDeclareTable) {
    assert(t.layer != null)

    const layer = t.layer
    const kind = t.key
    const kinds = this.core.collection_kinds
    const new_entry = { kind, layer }

    // TODO; this is not accurate to the original...
    kinds.set(kind, new_entry)

    this.core.binding?.declareCallback(t)

    return true
  }

  findVertexByName(name: string) {
    return this.core.topScope().node_names[name]
  }

  createVertex(algorithm: IGraphAlgorithm, init: CreateVertexOptions) {
    const scope = this.core.topScope()
    const binding = this.core.binding

    if(!init.name) {
      init.name = "internal@gd@node@" + unique_count
      unique_count++
    }

      assert(!scope.node_names[init.name], "node already created")

      if(!init.shape || init.shape === "none") {
        init.shape = "rectangle"
      }

      binding?.createVertex(init)

      const v = scope.node_names[init.name]
      assert(v, "internal node creation failed")

      algorithm.syntactic_component.add(v)
      algorithm.digraph.add(v)
      algorithm.ugraph.add(v)

      assert(algorithm.rotation_info)
      assert(algorithm.adjusted_bb)

      LayoutPipeline.prepareBoundingBoxes(
        algorithm.rotation_info,
        algorithm.adjusted_bb,
        algorithm.digraph,
        [v]
      )

      algorithm.layout_graph.add(v)

      return v
  }

  createEdge(algorithm: IGraphAlgorithm, tail: Vertex, head: Vertex, init?: Partial<IEdgeParams>) {
    init = init ?? { }

    const binding = this.core.binding
    const syntactic_digraph = algorithm.layout_graph
    const syntactic_component = algorithm.syntactic_component

    assert(syntactic_digraph.contains(tail) && syntactic_digraph.contains(head),
          "attempting to create edge between nodes that are not in the syntactic digraph")

    const arc = syntactic_digraph.connect(tail, head)

    const edge = new Edge({
      head, tail,
      direction: init.direction ?? "--",
      options: init.options ?? algorithm.layout._options as unknown as EdgeOptions,
      path: init.path,
      generated_options: init.generated_options ?? [],
      event: undefined as any,
    })

    arc.syntactic_edges.push(edge)

    const s_arc = syntactic_component.connect(tail, head)
    s_arc.syntactic_edges = arc.syntactic_edges

    const e = this.core.createEvent("edge", [arc, arc.syntactic_edges.length])
    edge.event = e

    for(const c of edge.option('collections')) {
      c.edges.push(edge)
    }

    binding?.storage.set(edge, [])
    binding?.everyEdgeCreation(edge)

    const direction = edge.direction
    if(direction === '->') {
      algorithm.digraph.connect(tail, head)
    } else if(direction === '<-') {
      algorithm.digraph.connect(head, tail)
    } else if(direction === '--' ||direction === '<->' ) {
      algorithm.digraph.connect(tail, head)
      algorithm.digraph.connect(head, tail)
    }

    algorithm.ugraph.connect(tail, head)
    algorithm.ugraph.connect(head, tail)

    add_to_collections<"edges">(algorithm.layout, "edges", edge)
  }
}

function add_to_collections<T extends 'edges'|'vertices'>(collection: Collection|undefined, where: 'edges'|'vertices', what: T extends 'edges' ? Edge : Vertex) {
  if(collection) {
    if(where === 'edges') {
      collection.edges.push(what as Edge)
    } else {
      collection.vertices.push(what as Vertex)
    }

    add_to_collections(collection.parent, where, what)
  }
}
