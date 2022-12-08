import assert from "assert";
import { DefaultDeclarations } from "../interface/InterfaceCore";
import { Declarations } from "../lib/Declarations";
import { GDOptions, lookup_option } from "../lib/Options";
import { Tuple } from "../lib/Tuple";
import { Modify } from "../lib/Types";
import { Coordinate } from "./Coordinate";
import { Digraph } from "./Digraph";
import { Edge, EdgeOptions, IEdgeParams } from "./Edge";
import { Path } from "./Path";
import { Vertex } from "./Vertex";

type PointCloud = Coordinate[]
type EventIndex = number
type SpanPriority = number

// GDOptions<Decl, EdgeOptions>[K]
type ArcOptionValue<K> = { aligned: Edge[], anti_aligned: Edge[], options: (K)[] }
// type ArcOptionCache = Partial<Record<keyof EdgeOptions, ArcOptionValue<keyof EdgeOptions>>>

type ArcOptions = { }

type IArcParams = Omit<Modify<Partial<IEdgeParams>, 'tail'|'head'>, 'options'> & {
  syntactic_edges: Edge[],
  syntactic_digraph: Digraph,
  options?: ArcOptions,
  option_cache: Record<string, any>,
  cached_point_cloud?: PointCloud,
  cached_event_index?: EventIndex,
  cached_span_priority?: SpanPriority, 
}

export interface IArc extends IArcParams { } 

function forwardsBackwards(arc: IArc, func: (a: IArc, reversed: boolean) => void) {
  const { head, tail, syntactic_digraph: g } = arc

  const a = g.arc(tail, head)
  if(a) {
    func(a, false)
  }

  if(head !== tail) {
    const aa = g.arc(head, tail)
    if(aa) {
      func(aa, true)
    }
  }
}

export namespace Arc {
  export function optionsArray<
      Decl extends Declarations =
        typeof DefaultDeclarations,
      K extends keyof GDOptions<Decl, EdgeOptions> =
        keyof GDOptions<Decl, EdgeOptions>
    >
(_arc: IArc, option: K): ArcOptionValue<GDOptions<Decl, EdgeOptions>[K]> {
    const cache = _arc.option_cache
    const _t = cache[option as keyof EdgeOptions]

    if(_t) {
      return _t
    }

    const aligned: Edge[] = []
    const anti_aligned: Edge[] = []

    const run = (arc: IArc, reversed: boolean) => {
      const arr  = reversed ? anti_aligned : aligned 

      for(const m of arc.syntactic_edges) {
        if(m.option<Decl, K>(option) != null) {
          arr.push(m)
        }
      }

      if(!reversed) {
        aligned.sort((a, b) => (a.event.index - b.event.index))
      }
    }

    // Accumulate the edges for which the option is set:
    forwardsBackwards(_arc, run)
    // const { head, tail, syntactic_digraph: s_graph } = _arc
    //
    // let arc = s_graph.arc(tail, head)
    //
    // if(arc) {
    //   for(const m of arc.syntactic_edges) {
    //     if(m.option(option) != null) {
    //       aligned.push(m)
    //     }
    //   }
    //
    //   aligned.sort((a, b) => (a.event.index < b.event.index) ? 1 : 0)
    // }
    //
    //
    // if(head !== tail) {
    //   arc = s_graph.arc(head, tail)
    //   if(arc) {
    //     for (const m of arc.syntactic_edges) {
    //       if(m.option(option) != null) {
    //         anti_aligned.push(m)
    //       } 
    //     }
    //   }
    // }

    // Now merge them together
    const t: ArcOptionValue<GDOptions<Decl, EdgeOptions>[K]> = { aligned, anti_aligned, options: [] }
    for(const a of aligned) {
      t.options.push(a.option<Decl, K>(option))
    }
    for(const aa of anti_aligned) {
      t.options.push(aa.option<Decl, K>(option))
    }

    // @ts-expect-error
    cache[option] = t

    return t
  }

  export function options<
      Decl extends Declarations =
        typeof DefaultDeclarations,
      K extends keyof GDOptions<Decl, EdgeOptions> =
        keyof GDOptions<Decl, EdgeOptions>
    > (arc: IArc, option: K, only_aligned?: boolean): GDOptions<Decl, EdgeOptions>[K]|undefined {
    if(only_aligned) {
      const opt = Arc.optionsArray<Decl, K>(arc, option)
      assert(opt)

      if(opt.aligned.length > 0) {
        return opt.options[0] as GDOptions<Decl, EdgeOptions>[K]|undefined
      }
    } else {
      return Arc.optionsArray<Decl, K>(arc, option)?.options[0] as GDOptions<Decl, EdgeOptions>[K]|undefined
    }
  }

  // export function optionsAccumulated(arc: IArc,
  //                                    option: ArcOption,
  //                                    accumulator: (a: EdgeOptionValue, b: EdgeOptionValue) => EdgeOptionValue,
  //                                    only_aligned?: boolean) {
  //   const opt = Arc.options(arc, option)
  //   if(only_aligned) {
  //     const aligned = opt.aligned
  //     const v = aligned.op
  //   }
  // }

  export function syntacticTailAndHead(arc: IArc): Tuple<Vertex, 2>|undefined {
    const { tail, head, syntactic_digraph: s_graph } = arc
    if(s_graph.arc(tail, head)) {
      return [ tail, head ]
    } else if(s_graph.arc(head, tail)) {
      return [ head, tail]
    }
  }

  export function pointCloud(arc: IArc): PointCloud {
    if(arc.cached_point_cloud) {
      return arc.cached_point_cloud
    }

    const cloud: PointCloud = []
    const a = arc.syntactic_digraph.arc(arc.tail, arc.head)
    if(a) {
      for(const e of a.syntactic_edges) {
        for(const p of e.path) {
          if(typeof p === 'object') {
            cloud.push(p)
          }
        }
      }
    }
    arc.cached_point_cloud = cloud
    return cloud
  }

  export function eventIndex(arc: IArc): EventIndex {
    if(arc.cached_event_index) {
      return arc.cached_event_index
    }

    // const { head, tail } = arc

    let e = Number.POSITIVE_INFINITY

    forwardsBackwards(arc, (a, reversed) => {
      for(const m of a.syntactic_edges) {
        e = Math.min(e, m.event.index)
      }
    })
    // let a = arc.syntactic_digraph.arc(tail, head)
    //
    // if(a) {
    //   for(const m of a.syntactic_edges) {
    //     e = Math.min(e, m.event.index)
    //   }
    // }
    //
    // if(head !== tail) {
    //   a = arc.syntactic_digraph.arc(head, tail)
    //   if(a) {
    //     for(const m of a.syntactic_edges) {
    //       e = Math.min(e, m.event.index)
    //     }
    //   }
    // }


    arc.cached_event_index = e
    return e
  }

  export function spanPriority(arc: IArc): SpanPriority {
    if(arc.cached_span_priority) {
      return arc.cached_span_priority
    }

    const { syntactic_digraph: g } = arc
    let min: number|undefined = undefined

    const get_min = (_a: IArc, reversed: boolean) => {
      for(const m of _a.syntactic_edges) {
        const key = `span priority ${reversed ? 'reversed ' : ''}${m.direction}` as const

        const p = m.option("span priority") || 
          lookup_option(key as any, m as any, g as any) as number|undefined

        return Math.min(p ?? 5, min ?? Number.POSITIVE_INFINITY)
      }
    } 

    forwardsBackwards(arc, get_min)

    // if(a) {
    //   min = get_min(a, false)
    // }
    //
    // if(head !== tail) {
    //   a = g.arc(head, tail)
    //
    //   if(a) {
    //     min = get_min(a, true)
    //   }
    // }

    arc.cached_span_priority = min ?? 5
    return min ?? 5
  }

  export function sync(arc: IArc) {
    if(arc.path) {
      const { path, head, tail, syntactic_digraph: g } = arc

      // sync edge paths (???)
      forwardsBackwards(arc, (_a: IArc, reversed: boolean) => {
        if(_a.syntactic_edges.length > 0) {
          for(const e of _a.syntactic_edges) {
            const clone = path[reversed ? 'reversed' : 'clone']()
            for(let i = 0; i < path._commands.length; i++) {
              const p = path._commands[i]
              if(typeof p === 'function') {
                const _n = p(e)
                clone._commands[i] = _n
                if(typeof _n === 'object') {
                  clone._commands[i] = _n.clone()
                }
              }
            }

            e.path = clone
          }
        }
      })

    }

    const gopts = arc.generated_options

    if(gopts) {
      forwardsBackwards(arc, (a, reversed) => {
        if(a.syntactic_edges.length > 0) {
          for(const e of a.syntactic_edges) {
            for(const o of gopts) {
              e.generated_options.push(o)
            }
          }
        }
      })
    }

    const animations = arc.animations

    if(animations) {
      forwardsBackwards(arc, (a, reversed) => {
        if(a.syntactic_edges.length > 0) {
          for(const e of a.syntactic_edges) {
            for(const o of animations) {
              e.animations.push(o)
            }
          }
        }
      })
    }
  }

  export function tailAnchorForArcPath(arc: IArc) {
    return (edge?: Edge) => {
      assert(edge)

      let a = edge.option('tail anchor')
      if(a === "" || !a) {
        a = 'center'
      }
      const pos = arc.tail.anchor(a)
      assert(pos)
      const pos2 = arc.tail.pos

      return Coordinate.add(pos, pos2)
    }
  }

  export function headAnchorForArcPath(arc: IArc) {
    return (edge?: Edge) => {
      assert(edge)

      let a = edge.option('head anchor')
      if(a === "" || !a) {
        a = 'center'
      }
      const pos = arc.head.anchor(a)
      assert(pos)
      const pos2 = arc.head.pos

      return Coordinate.add(pos, pos2)
    }
  }

  export function setPolylinePath(arc: IArc, coordinates: Coordinate[]) {
    const p = new Path()

    p.appendMoveto(Arc.tailAnchorForArcPath(arc))

    for(const c of coordinates) {
      p.appendLineto(c)
    }

    p.appendLineto(Arc.headAnchorForArcPath(arc))

    arc.path = p
  }

  export function toString(arc: IArc) {
    return arc.tail.toString() + "->" + arc.head.toString()
  }

  export function __debug(arc: IArc) {
    return [ arc.tail, arc.head ]
  }
}
