import assert from 'assert'
import { Event } from '../lib/Event'
import { algPhaseFunc, optFunc, WithOptions } from '../lib/Options'
import { SpanPriorityOption } from '../lib/Types'
import { Coordinate } from './Coordinate'
import { Path } from './Path'
import { Animation, Vertex } from './Vertex'

export type EdgeDirection = "->"|"--"|"<-"|"<->"|"-!-"

export type EdgeOptions = { 
  // 'tail anchor': VertexAnchor|"",
  // 'head anchor': VertexAnchor|"",
  // 'tail cut'?: boolean,
  // 'head cut'?: boolean,
  // 'allow inside edges'?: boolean,
} & {
  [key in SpanPriorityOption]?: number
}

type EdgeGeneratedOptions = any[]

export interface IEdgeParams {
  head: Vertex,
  tail: Vertex,
  direction: EdgeDirection,
  path?: Path,
  animations?: Animation[] 
  generated_options: EdgeGeneratedOptions,
  options?: EdgeOptions,
  event: Event,
}

export class Edge implements IEdgeParams, WithOptions<EdgeOptions> {
  head: Vertex
  tail: Vertex
  direction: EdgeDirection
  path: Path
  animations: Animation[]
  _options: EdgeOptions
  _options_proxy?: EdgeOptions

  event: Event
  generated_options: EdgeGeneratedOptions

  // option
  // <
  //   Decl extends Declarations =
  //     typeof DefaultDeclarations,
  //   K extends keyof GDOptions<Decl, EdgeOptions> =
  //     keyof GDOptions<Decl, EdgeOptions>
  // >
  // (
  //   key: K,
  //   raw?: boolean
  // ): GDOptions<Decl, EdgeOptions>[K] {
  //     if(raw) return this._options[key as keyof typeof this._options] as any
  //     return this._options[key as keyof typeof this._options] ?? this._options_proxy?.[key as keyof typeof this._options_proxy]  as any
  // }

  option = optFunc<EdgeOptions>()
  option_algorithm_phase = algPhaseFunc<EdgeOptions>()
  
  constructor({ head, tail, direction, options, generated_options, path, animations, event }: IEdgeParams) {
    this.head = head
    this.tail = tail
    this.direction = direction
    this.event = event

    this.animations = animations ?? []
    this.generated_options = generated_options ?? { }
    this._options = options ?? { 
      // 'tail anchor': "",
      // 'head anchor': "",
    }

    if(!path) {
      const p = new Path()
      p.appendMoveto(this.tailAnchorForEdgePath())
      p.appendLineto(this.headAnchorForEdgePath())
      this.path = p
    } else {
      this.path = path
    }
  }

  tailAnchorForEdgePath() {
    return () => {
      let a = this.option('tail anchor')
      if(a === "" || !a) {
        a = "center"
      }

      const tanchor = this.tail.anchor(a)
      assert(tanchor)

      return Coordinate.add(tanchor, this.tail.pos)
    }
  }

  headAnchorForEdgePath() {
    return () => {
      let a = this.option('tail anchor')
      if(a === "" || !a) {
        a = "center"
      }

      const hanchor = this.head.anchor(a)
      assert(hanchor)

      return Coordinate.add(hanchor, this.head.pos)
    }
  }

  setPolylinePath(coordinates: Coordinate[]) {
    const p = new Path()

    p.appendMoveto(this.tailAnchorForEdgePath())

    coordinates.forEach((c) => {
      p.appendLineto(c)
    })

    p.appendMoveto(this.headAnchorForEdgePath())

    this.path = p
  }

  toString() {
    return this.tail.toString() + this.direction + this.head.toString()
  }

  /**
   * @internal
   */
  __debug() {
    return [ this.tail.name, this.head.name, this.direction ]
  }
}
