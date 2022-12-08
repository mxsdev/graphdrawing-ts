import assert from 'assert';
import { Declarations } from "../lib/Declarations";
import { Event, EventKind, EventParams } from '../lib/Event';
import { GDOptions } from "../lib/Options";
import { pairs } from "../lib/Types";
import { EdgeDirection } from "../model/Edge";
import { Path } from "../model/Path";
import { VertexAnchors } from "../model/Vertex";
import { CreateVertexOptions } from "./IBinding";
import { DefaultDeclarations, InterfaceCore } from "./InterfaceCore";
import { InterfaceToAlgorithms, QualifiedDeclareTable } from "./InterfaceToAlgorithms";
import { InterfaceToDisplay, InterfaceRenderGraphResult } from "./InterfaceToDisplay";
import { Scope } from "./Scope";

type HeightBuilder = number|((height: number) => number)
export type RenderGraphResult = Pick<InterfaceRenderGraphResult, 'edges'|'vertices'>

const INITIAL_HEIGHT = 0

export class GraphBuilder<Decl extends Declarations> {
  private core: InterfaceCore
  private ialgorithms: InterfaceToAlgorithms
  private idisplay: InterfaceToDisplay

  private current_height: number = INITIAL_HEIGHT
  private marked_height?: number
  private push_marked?: number

  constructor(declarations: Decl) {
    this.core = new InterfaceCore()

    this.ialgorithms = new InterfaceToAlgorithms(this.core)

    pairs({ ...DefaultDeclarations, ...declarations })
      .forEach(([ key, value ]) => this.ialgorithms.declare({ key, ...value } as QualifiedDeclareTable))

    this.idisplay = new InterfaceToDisplay(this.core)
  }

  display() { return this.idisplay }

  beginGraphDrawingScope(height?: HeightBuilder) {
    this.idisplay.beginGraphDrawingScope(this.parse_height(height))
    return this
  }

  runGraphDrawingAlgorithm() {
    this.idisplay.runGraphDrawingAlgorithm()
    return this
  }

  endGraphDrawingScope(reset?: boolean) {
    this.idisplay.endGraphDrawingScope()
    if(reset) this.reset_height()
    return this
  }

  createVertex(
    name: string,
    shape?: string,
    path?: Path,
    binding_infos?: any,
    anchors?: VertexAnchors,
    height?: HeightBuilder,
  ) {
    this.idisplay.createVertex(name, shape, path, this.parse_height(height, false), binding_infos, anchors)
    this.pushMarked()
    return this
  }

  pushSubgraphVertex(
    name: string,
    info: CreateVertexOptions,
    height?: HeightBuilder,
  ) {
    this.idisplay.pushSubgraphVertex(name, this.parse_height(height, false), info)
    this.pushMarked()
    return this
  }

  addToVertexOptions(
    name: string,
    height?: HeightBuilder
  ) {
    this.idisplay.addToVertexOptions(name, this.parse_height(height))
    return this
  }

  createEdge(
    tail: string, head: string,
    direction: EdgeDirection = "->",
    binding_infos?: any,
    height?: HeightBuilder,
  ) {
    this.idisplay.createEdge(tail, head, direction, this.parse_height(height, false), binding_infos)
    this.pushMarked()
    return this
  }

  pushOption<K extends keyof GDOptions<Decl, {}>>(
    key: K,
    value?: any,
    height?: HeightBuilder,
  ) { 
    return this._pushOption(key, value, height)
  }

  pushVertexOption<K extends keyof GDOptions<Decl, {}>>(
    key: K,
    value?: any,
    height?: HeightBuilder,
  ) { 
    return this._pushOption(key, value, height, true)
  }

  pushEdgeOption = this.pushVertexOption
  
  private _pushOption<K extends keyof GDOptions<Decl, {}>>(
    key: K,
    value?: any,
    height?: HeightBuilder,
    mark?: boolean
  ) {
    let _h: number|undefined = undefined

    if(mark && this.marked_height == null) {
      this.marked_height = this.parse_height(undefined, false)
      _h = this.marked_height + 1
    }

    const h = _h ?? this.parse_height(height)

    this.idisplay.pushOption(key as string, value, h)
    return this
  }

  pushLayout(height?: HeightBuilder) {
    this.idisplay.pushLayout(this.parse_height(height))
    return this
  }

  getDeclaredKeys() {
    return this.core.keys
  }

  renderGraph(finalize: boolean = true, reset?: boolean): RenderGraphResult {
    const res = this.idisplay.renderGraph()

    if(finalize) {
      this.endGraphDrawingScope(reset)
    }

    return res
  }

  createEvent<K extends EventKind>(kind: K, param: EventParams[K], scope?: Scope) {
    this.core.createEvent<K>(kind, param, scope)
    return this
  }

  private pushMarked() {
    if(this.marked_height != null) {
      this.push_marked = this.marked_height
      delete this.marked_height
    }
  }

  private reset_height() { 
    this.current_height = INITIAL_HEIGHT
  }

  private parse_height(height: HeightBuilder|undefined, inc: boolean = true) {
    if(!height) {
      if(this.push_marked != null) {
        this.current_height = this.push_marked + (inc ? 1 : 0)

        delete this.push_marked

        return this.current_height 
      }

      this.current_height = this.core.option_stack.length + (inc ? 0 : -1)
      return this.current_height
    } else {
      if(typeof height === 'function') {
        this.current_height = height(this.current_height)
      } else {
        this.current_height = height
      }

      return this.current_height
    }
  }
}
