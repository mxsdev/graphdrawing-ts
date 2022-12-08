import { Collection } from "../model/Collection"
import { Edge } from "../model/Edge"
import { Vertex, VertexOptions } from "../model/Vertex"
import { DeclareTable } from "./InterfaceToAlgorithms"
import { Storage } from '../lib/Storage'

export type CreateVertexOptions = {
  name?: string,
  shape?: string,
  generated_options: { key: string, value: string }[],
  text?: string,
  options?: VertexOptions,
}

export interface IBinding {
  storage: Storage<Edge|Vertex, Vertex[]>

  renderStart(): void
  renderStop(): void
  renderVertex(v: Vertex): void
  renderEdge(edge: Edge): void

  resumeGraphDrawingCoroutine(code: string): void
  declareCallback(t: DeclareTable): void
  renderCollectionsStartKind(kind: string, layer: number): void
  renderCollectionsStopKind(kind: string, layer: number): void
  renderCollection(collection: Collection): void
  everyVertexCreation(v: Vertex): void
  renderEdgesStart(): void
  renderEdgesStop(): void
  everyEdgeCreation(e: Edge): void
  createVertex(init: CreateVertexOptions): void
  renderVerticesStart(): void
  renderVerticesStop(): void
}

export abstract class AbstractBinding implements IBinding {
  storage: Storage<Edge | Vertex, Vertex[]> = new WeakMap()

  abstract renderStart(): void
  abstract renderStop(): void
  abstract renderVertex(v: Vertex): void
  abstract renderEdge(edge: Edge): void

  resumeGraphDrawingCoroutine(code: string): void { }
  declareCallback(t: DeclareTable): void { }
  renderCollectionsStartKind(kind: string, layer: number): void { }
  renderCollectionsStopKind(kind: string, layer: number): void { }
  renderCollection(collection: Collection): void { }
  everyVertexCreation(v: Vertex): void { }
  renderEdgesStart(): void { }
  renderEdgesStop(): void { }
  everyEdgeCreation(e: Edge): void { }
  createVertex(init: CreateVertexOptions): void { }
  renderVerticesStart(): void { }
  renderVerticesStop(): void  { }

}
