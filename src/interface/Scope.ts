import { Event } from "../lib/Event";
import { Collection } from "../model/Collection";
import { Digraph } from "../model/Digraph";
import { Vertex } from "../model/Vertex";
import { IBinding } from "./IBinding";

export const collection_constants = {
  sublayout_kind:  "INTERNAL_sublayout_kind",
  subgraph_node_kind:  "INTERNAL_subgraph_node_kind",
} as const

interface IScopeParams {
  syntactic_digraph: Digraph
  events: Event[]
  node_names: Record<string, Vertex>
  coroutine?: any
  collections: Record<string, Collection[]>
  binding?: IBinding
}

export class Scope implements IScopeParams {
  syntactic_digraph: Digraph
  events: Event[]
  node_names: Record<string, Vertex>
  coroutine?: any
  collections: Record<string, Collection[]>
  binding?: IBinding

  constructor(binding: IBinding|undefined, { 
    syntactic_digraph, events, node_names, coroutine, collections 
  }: Partial<IScopeParams>) {
    this.syntactic_digraph = syntactic_digraph ?? new Digraph({})
    this.events = events ?? []
    this.node_names = node_names ?? {}
    this.coroutine = coroutine
    this.collections = collections ?? { }
    this.binding = binding
  }
}
