import { Node } from "../deprecated/Node"
import { OldEdge } from "../deprecated/OldEdge"
import { IArc } from "../model/Arc"
import { Vertex } from "../model/Vertex"

type EventParameters = never

type PGFEvent = 'descendants'|'array'

export type EventParams = {
  begin: PGFEvent,
  end: PGFEvent,
  node: Vertex,
  collection: string,
  edge: [ IArc, number ]
  old_node: Node,
  old_edge: OldEdge,
}

export type EventKind = keyof EventParams

export interface IEventParams<Kind extends EventKind> {
  kind: Kind,
  parameters: EventParams[Kind],
  index: number,
}

export class Event<Kind extends EventKind = EventKind> implements IEventParams<Kind> {
  kind: Kind
  parameters: EventParams[Kind]
  index: number
  end_index?: number
  begin_index?: number

  constructor({ kind, parameters, index }: IEventParams<Kind>) {
    this.kind = kind
    this.parameters = parameters
    this.index = index
  }
}
