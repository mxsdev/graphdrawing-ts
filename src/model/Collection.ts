import { Modify } from '../util/types/utilityTypes'
import { Event } from '../lib/Event'
import { algPhaseFunc, optFunc, WithOptions } from '../lib/Options'
import { Edge } from "./Edge"
import { Vertex } from "./Vertex"

export type CollectionOptions = { }

interface ICollectionParams {
  vertices: Vertex[]
  edges: Edge[]
  options?: CollectionOptions
  generated_options: CollectionOptions
  kind: string
  event: Event
  child_collections: Collection[]
}

export class Collection implements WithOptions<CollectionOptions> {
  vertices: Vertex[]
  edges: Edge[]
  _options: CollectionOptions
  _options_proxy?: CollectionOptions
  generated_options: CollectionOptions
  kind: string
  event: Event
  child_collections: Collection[]
  parent?: Collection
  parent_layout?: Collection
  subgraph_node?: Vertex

  constructor({
    kind, vertices, edges, options, generated_options, event, child_collections
  }: Modify<Partial<ICollectionParams>, 'kind'|'event'>) {
    const default_options = { }

    this.vertices = vertices ?? []
    this.edges = edges ?? []
    this._options = options ?? default_options
    this.kind = kind
    this.event = event
    this.child_collections = child_collections ?? []
    this.generated_options = generated_options ?? default_options
  }

  // option
  //   <
  //     Decl extends Declarations =
  //       typeof DefaultDeclarations,
  //     K extends keyof GDOptions<Decl, CollectionOptions> =
  //       keyof GDOptions<Decl, CollectionOptions>
  //   >
  //   (
  //     key: K,
  //     raw?: boolean
  //   ): GDOptions<Decl, CollectionOptions>[K] {
  //       if(raw) return this._options[key as keyof typeof this._options]
  //       return this._options[key as keyof typeof this._options] ?? this._options_proxy?.[key as keyof typeof this._options_proxy] 
  //   }

  option = optFunc<CollectionOptions>()
  option_algorithm_phase = algPhaseFunc<CollectionOptions>()

  registerAsChildOf(p?: Collection) {
    this.parent = p
    if(p) {
      p.child_collections.push(this)
    }
  }

  children() { 
    return this.child_collections
  }

  childrenOfKind(kind: string): Collection[] {
    return this.child_collections.flatMap(c => ([
      ...(c.kind === kind ? [c] : [...c.childrenOfKind(kind)]),
    ]))
  }

  descendants(): Collection[] {
    return this.child_collections.flatMap(c => ([ c, ...c.descendants() ]))
  }

  descendantsOfKind(kind: string) {
    return this.child_collections.flatMap(c => ([
      ...(c.kind === kind ? [c] : []),
      ...c.childrenOfKind(kind),
    ]))
  }
}
