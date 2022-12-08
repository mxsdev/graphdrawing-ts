import { CreateVertexOptions } from '../interface/IBinding';
import { Event } from '../lib/Event';
import { algPhaseFunc, optFunc, WithOptions } from '../lib/Options';
import { OrderedMap } from '../lib/OrderedMap';
import { Storage } from "../lib/Storage";
import { Tuple } from "../lib/Tuple";
import { IArc } from "./Arc";
import { Collection } from './Collection';
import { Coordinate } from "./Coordinate";
import { Digraph } from "./Digraph";
import { Path } from "./Path";

export type Animation = { }

export type VertexOptions = { 
  // 'regardless at'?: Coordinate,
  // 'orient head'?: string,
  // 'orient tail'?: string,
  // 'desired at'?: Coordinate,
  // 'align here'?: boolean,
  // 'cut policy'?: 'as edge requests'|'all'|'none',
  // 'anchor here'?: boolean,
  // 'collections': Collection[],
}

type VertexKind = 'node'|'dummy'|'subgraph node'
export type VertexAnchor = 'center'|DirectionName
export type VertexAnchors = {
  [index in VertexAnchor]?: Coordinate;
} & { center: Coordinate }

export interface IVertexParams {
  pos: Coordinate,
  name?: string,
  path: Path,
  shape: string,
  anchors: VertexAnchors,
  options?: VertexOptions,
  animations: Animation[],
  kind: VertexKind,
  event?: Event,
}

type DirectionName = 'north'|'south'|'east'|'west'|'north west'|'north east'|'south west'|'south east'

const directions: Record<DirectionName, (min_x: number, min_y: number, max_x: number, max_y: number) => Tuple<number, 2>> = {
  north: function(min_x, min_y, max_x, max_y) {
    return [(min_x+max_x)/2, max_y]
  },
  south: function(min_x, min_y, max_x, max_y) {
    return [(min_x+max_x)/2, min_y]
  },
  east: function(min_x, min_y, max_x, max_y) {
    return [max_x, (min_y+max_y)/2]
  },
  west: function(min_x, min_y, max_x, max_y) {
    return [min_x, (min_y+max_y)/2]
  },
  "north west": function(min_x, min_y, max_x, max_y) {
    return [min_x, max_y]
  },
  "north east": function(min_x, min_y, max_x, max_y) {
    return [max_x, max_y]
  },
  "south west": function(min_x, min_y, max_x, max_y) {
    return [min_x, min_y]
  },
  "south east": function(min_x, min_y, max_x, max_y) {
    return [max_x, min_y]
  },
}


export class Vertex implements IVertexParams, WithOptions<VertexOptions> {
  pos: Coordinate
  name: string | undefined
  path: Path
  shape: string
  anchors: VertexAnchors
  _options: VertexOptions
  _options_proxy?: VertexOptions
  animations: Animation[]
  kind: VertexKind
  event?: Event

  incomings: Storage<Digraph, OrderedMap<Vertex, IArc>>
  outgoings: Storage<Digraph, OrderedMap<Vertex, IArc>>

  collapsed_vertices?: Vertex[]
  collapsed_arcs?: IArc[]

  subgraph_info?: CreateVertexOptions
  subgraph_collection?: Collection

  created_on_display_layer?: boolean

  option = optFunc<VertexOptions>()
  option_algorithm_phase = algPhaseFunc<VertexOptions>()

  // option
  // <
  //   Decl extends Declarations =
  //     typeof DefaultDeclarations,
  //   K extends keyof GDOptions<Decl, VertexOptions> =
  //     keyof GDOptions<Decl, VertexOptions>
  // >
  // (
  //   key: K,
  //   raw?: boolean
  // ): GDOptions<Decl, VertexOptions>[K] {
  //     if(raw) return this._options[key as keyof typeof this._options] as any
  //     return this._options[key as keyof typeof this._options] ?? this._options_proxy?.[key as keyof typeof this._options_proxy]  as any
  // }

  constructor({
    pos, name, path, anchors, options, animations, shape, kind, event
  }: Partial<IVertexParams> = {}) {
    this.incomings = new WeakMap()
    this.outgoings = new WeakMap()

    this.path = path ?? new Path( new Coordinate(0, 0) )
    this.shape = shape ?? 'none'
    this.kind = kind ?? 'dummy'
    this.pos = pos ?? new Coordinate(0, 0)
    this.anchors = anchors ?? { center: new Coordinate(0, 0) }
    this.animations = animations ?? [] 

    this.event = event

    this.name = name
    this._options = options ?? { } as VertexOptions
  } 

  boundingBox() {
    return this.path.boundingBox()
  }

  anchor(anchor: string): Coordinate | undefined {
    let c = this.anchors[anchor as VertexAnchor]
    if (!c) {
      let b: Coordinate|undefined = undefined
      const d = directions[anchor as DirectionName]
      if(d) {
        const [ b1, b2, b3, b4 ] =this.boundingBox()
        b = new Coordinate(...d(b1, b2, b3, b4))
      } else {
        const n = Number(anchor)
        if (isFinite(n)) { 
          const [x1, y1, x2, y2 ]= this.boundingBox()
          const r = Math.max(x2-x1, y2-y1)
          const b = new Coordinate(r*Math.cos(n/180*Math.PI),r*Math.sin(n/180*Math.PI))
          b.shiftByCoordinate(this.anchors.center)
        }
      }

      if(!b) {
        return undefined
      }

      const p = new Path ('moveto', this.anchors.center, 'lineto', b)
      const intersections = p.intersectionsWith(this.path)
      if(intersections.length > 0) {
        c = intersections[0].point
      }
    }

    this.anchors[anchor as VertexAnchor] = c as Coordinate

    return c
  }

  toString() {
    return this.name ?? JSON.stringify(this.anchors)
  }

  /**
   * @internal
   */
  __debug() {
    return [ this.name, this.pos.x, this.pos.y ]
  }
}
