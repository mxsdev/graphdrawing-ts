import { LayoutBB } from "../control/LayoutPipeline"
import type { RandomGenerator} from "../lib/Random"
import { Event } from "./Event"
import { LayoutPipeline } from "../control/LayoutPipeline"
import { Vertex } from "../model/Vertex"
import { Collection } from "../model/Collection"
import { Digraph } from "../model/Digraph"
import { Scope } from "../interface/Scope"
import { Storage } from './Storage'
import { SpanningTree } from "./Types"
import { OldGraph } from "../deprecated/OldGraph"
import { Ranking } from "../layered/Ranking"

export type GraphAlgorithmPostConditions = {
  upward_oriented?: boolean,
  upward_oriented_swapped?: boolean,
  fixed?: boolean,
}

export type GraphAlgorithmPreConditions = {
  simple?: boolean,
  tree?: boolean,
  connected?: boolean,
  loop_free?: boolean,
  at_least_two_nodes?: boolean,
}

export interface IAlgorithm<R = void> { 
  rotation_info?: ReturnType<typeof LayoutPipeline.prepareRotateAround>
  adjusted_bb?: Storage<Vertex, LayoutBB>
  spanning_tree?: Digraph,
  graph?: OldGraph
  main_algorithm?: IGraphAlgorithm & IAlgorithm
  ranking?: Ranking

  run: () => R
}

export interface IGraphAlgorithm extends Pick<IAlgorithm, 'rotation_info'|'adjusted_bb'|'graph'|'main_algorithm'|'ranking'> {
  digraph: Digraph
  ugraph: Digraph
  scope: Scope
  layout: Collection
  layout_graph: Digraph
  syntactic_component: Digraph
  events: Event[]
  random: RandomGenerator
}

export type IOldGraphAlgorithm = IGraphAlgorithm & {graph: OldGraph}

export interface GraphAlgorithmConstructor<R = void> {
  new(data: IGraphAlgorithm): IGraphAlgorithm & IAlgorithm<R>
}

export type GraphAlgorithm<R = void> = {
  postconditions: GraphAlgorithmPostConditions
  preconditions: GraphAlgorithmPreConditions
  old_graph_algorithm: boolean
  run_also_for_single_node?: boolean
  include_subgraph_nodes?: boolean
  phase: string 

  constructor: GraphAlgorithmConstructor<R>
}

abstract class AbstractAlgorithm<R = void> implements IAlgorithm<R> {
  include_subgraph_nodes?: boolean
  rotation_info?: ReturnType<typeof LayoutPipeline.prepareRotateAround>

  adjusted_bb?: Storage<Vertex, LayoutBB>
  spanning_tree?: Digraph

  graph?: OldGraph

  abstract run(): R
}

export abstract class AbstractGraphAlgorithm<R = void> extends AbstractAlgorithm<R> implements IGraphAlgorithm {
  digraph: Digraph
  ugraph: Digraph
  scope: Scope
  layout: Collection
  layout_graph: Digraph
  syntactic_component: Digraph
  events: Event[]
  random: RandomGenerator
  graph?: OldGraph
  main_algorithm?: IGraphAlgorithm & IAlgorithm
  ranking?: Ranking

  constructor({ ranking, random, main_algorithm, graph, events, digraph, ugraph, scope, layout, layout_graph, syntactic_component }: IGraphAlgorithm) {
    super()
    this.digraph = digraph
    this.ugraph = ugraph
    this.scope = scope
    this.layout = layout
    this.layout_graph = layout_graph
    this.syntactic_component = syntactic_component
    this.events = events
    this.graph = graph
    this.main_algorithm = main_algorithm
    this.random = random
    this.ranking = ranking
  }
}
