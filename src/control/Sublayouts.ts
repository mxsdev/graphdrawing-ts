import assert from 'assert'
import { collection_constants, Scope } from '../interface/Scope'
import { GraphAlgorithm } from '../lib/Algorithm'
import { Storage } from '../lib/Storage'
import { getOrSet } from '../lib/Types'
import { Collection } from '../model/Collection'
import { Coordinate, ICoordinate } from '../model/Coordinate'
import { Digraph } from '../model/Digraph'
import { Path } from '../model/Path'
import { Vertex } from '../model/Vertex'

const subs: Storage<Vertex, Vertex[]> = new WeakMap()
const already_nudged = new WeakSet<Vertex>()
const positions: Storage<Vertex, Storage<Digraph, Coordinate>> = new WeakMap()

function offset_vertex(v: Vertex, delta: ICoordinate) {
  v.pos.shiftByCoordinate(delta)
  for (const sub of subs.get(v) ?? []) {
    offset_vertex(sub, delta)
  }
}

function nudge(graph: Digraph) {
  for (const v of graph.vertices) {
    const nudge = v.option('nudge')
    if (nudge && !already_nudged.has(v)) {
      offset_vertex(v, nudge)
      already_nudged.add(v)
    }
  }
}

function create_subgraph_node(scope: Scope, syntactic_digraph: Digraph, vertex: Vertex) {
  const { binding } = scope
  const cloud: Coordinate[] = []
  const { subgraph_collection, subgraph_info } = vertex

  assert(subgraph_collection)
  for (const v of subgraph_collection.vertices) {
    assert(syntactic_digraph.contains(v), "the layout must contain all nodes of the subgraph")
    for (const p of v.path) {
      if (typeof p === 'object') {
        cloud.push(Coordinate.add(p, v.pos))
      }
    }
  }

  for (const e of subgraph_collection.edges) {
    for (const p of e.path) {
      if (typeof p === 'object') {
        cloud.push(p.clone())
      }
    }
  }
  const [x_min, y_min, x_max, y_max, c_x, c_y] = Coordinate.boundingBox(cloud)

  for (const p of cloud) {
    p.unshift(c_x, c_y)
  }

  assert(subgraph_info)
  const o = subgraph_info.generated_options

  assert(o)

  o.push({ key: "subgraph point cloud", value: cloud.map((c) => c.toString()).join("") })
  o.push({ key: "subgraph bounding box height", value: (y_max - y_min).toString() + "pt" })
  o.push({ key: "subgraph bounding box width", value: (x_max - x_min).toString() + "pt" })

  binding?.createVertex(subgraph_info)

  vertex.pos.shift(c_x, c_y)

  const s = subgraph_collection.vertices.filter(v => v !== vertex)

  subs.set(vertex, s)
}

function intersection(g1: Digraph, g2: Digraph) {
  for (const v of g1.vertices) {
    if (g2.contains(v)) {
      return v
    }
  }
}

function special_vertex_subset(vertices: Iterable<Vertex>, graph: Digraph) {
  for (const v of vertices) {
    if (!graph.contains(v) && (v.kind !== "subgraph node")) {
      return false
    }
  }

  return true
}

export namespace Sublayouts {
  export function layoutRecursively(scope: Scope, layout: Collection,
    fun: (scope: Scope, algorithm: GraphAlgorithm, syntactic_digraph: Digraph, layout: Collection) => void): Digraph {
    let resulting_graphs: Digraph[] = []
    const loc: Storage<Digraph, Collection> = new WeakMap()

    for (const child of layout.childrenOfKind(collection_constants.sublayout_kind)) {
      const _g = Sublayouts.layoutRecursively(scope, child, fun)
      resulting_graphs.push(_g)
      loc.set(_g, child)
    }

    const merged_graphs: Digraph[] = []

    while (resulting_graphs.length > 0) {
      const n = resulting_graphs.length

      const marked: boolean[] = new Array(n).fill(false)

      marked[0] = true
      const touched = new WeakSet<Vertex>()
      for (const v of resulting_graphs[0].vertices) {
        const _pos = positions.get(v)?.get(resulting_graphs[0])
        assert(_pos)
        v.pos = _pos
        touched.add(v)
      }

      let i = 0
      while (i < n) {
        if (!marked[i]) {
          for (let j = 0; j < n; j++) {
            if (marked[j]) {
              const gi = resulting_graphs[i]
              const gj = resulting_graphs[j]

              assert(gi)
              assert(gj)

              const v = intersection(gi, gj)

              if (v) {
                marked[i] = true
                // const connected_some_graph = true

                const _pos = positions.get(v)?.get(gi)
                assert(_pos)

                const x_offset = v.pos.x - _pos.x
                const y_offset = v.pos.y - _pos.y

                for (const u of gi.vertices) {
                  if (!touched.has(u)) {
                    touched.add(u)
                    const _upos = positions.get(u)?.get(gi)?.clone()
                    assert(_upos)

                    u.pos = _upos
                    u.pos.shift(x_offset, y_offset)

                    for (const a of gi.outgoing(u)) {
                      for (const e of a.syntactic_edges) {
                        for (const p of e.path) {
                          if (typeof p === 'object') {
                            p.shift(x_offset, y_offset)
                          }
                        }
                      }
                    }
                  }
                }

                i = 0
                break
              }
            }
          }
        }

        i += 1
      }

      const merge = new Digraph({})
      merge.syntactic_digraph = merge
      const remaining: Digraph[] = []

      for(let i = 0; i < n; i++) {
        if(marked[i]) {
          merge.add(...resulting_graphs[i].vertices)
          for(const a of resulting_graphs[i].arcs) {
            const ma = merge.connect(a.tail, a.head)
            for(const e of a.syntactic_edges) {
              ma.syntactic_edges.push(e)
            }
          }
        } else {
          remaining.push(resulting_graphs[i])
        }
      }

      const _set = loc.get(resulting_graphs[0])
      assert(_set)

      loc.set(merge, _set)

      merged_graphs.push(merge)

      resulting_graphs = remaining
    }

    // Step 3: Run the algorithm on the layout:

    const algorithm = layout.option_algorithm_phase("main") 
    assert(algorithm)

    const uncollapsed_subgraph_nodes = (scope.collections[collection_constants.subgraph_node_kind] || [])
      .filter((c) => c.parent_layout === layout)
      .map(c => c.subgraph_node)
      .filter(Boolean) as Vertex[]

    const syntactic_digraph = new Digraph({ }, layout)

    syntactic_digraph.syntactic_digraph = syntactic_digraph

    syntactic_digraph.add(...layout.vertices)

    for(const e of layout.edges) {
      syntactic_digraph.add(e.head, e.tail)
      const arc = syntactic_digraph.connect(e.tail, e.head)
      arc.syntactic_edges.push(e)
    }

    for(let i = uncollapsed_subgraph_nodes.length-1; i >= 0; i--) {
      const v = uncollapsed_subgraph_nodes[i]
      const vertices = v.subgraph_collection?.vertices
      assert(vertices)

      for(const g of merged_graphs) {
        if(special_vertex_subset(vertices, g)) {
          create_subgraph_node(scope, syntactic_digraph, v)
          g.add(v)
          uncollapsed_subgraph_nodes.pop()
        }
      }
    }

    const collapsed_vertices: Vertex[] = []
    for(const g of merged_graphs) {
      const intersection: Vertex[] = []

      for(const v of g.vertices) {
        if(syntactic_digraph.contains(v)) {
          intersection.push(v)
        }
      }

      if(intersection.length > 0) {
        const array: Coordinate[] = []

        for(const v of g.vertices) {
          const [ min_x, min_y, max_x, max_y ] = v.boundingBox()
          array.push(new Coordinate(min_x + v.pos.x, min_y + v.pos.y))
          array.push(new Coordinate(max_x + v.pos.x, max_y + v.pos.y))
        }
        
        for(const a of g.arcs) {
          for(const e of a.syntactic_edges) {
            for(const p of e.path) {
              if(typeof p === 'object') {
                array.push(p)
              }
            } 
          }
        }

        let [ x_min, y_min, x_max, y_max, c_x, c_y ] = Coordinate.boundingBox(array)

        for(const v of g.vertices) {
          v.pos.unshift(c_x, c_y)
        } 

        for(const a of g.arcs) {
          for(const e of a.syntactic_edges) {
            for(const p of e.path) {
              if(typeof p === 'object') {
                p.unshift(c_x, c_y)
              }
            }
          }
        }

        x_min -= c_x
        x_max -= c_x
        y_min -= c_y
        y_max -= c_y

        const _col = loc.get(g)
        assert(_col)

        const index = _col.event.index
        assert(index)

        const v = new Vertex({
          shape: 'none',
          kind: 'node',
          path: new Path(
            'moveto',
            x_min, y_min,
            x_min, y_max,
            x_max, y_max,
            x_max, y_min,
            'closepath'
          ),
          // options: {
          //   collections: []
          // },
          event: scope.events[index],
        })

        scope.events[index].parameters = v

        const collapse_vertex = syntactic_digraph.collapse(
          intersection,
          v,
          undefined,
          (new_arc, arc) => {
            for(const e of arc.syntactic_edges) {
              new_arc.syntactic_edges.push(e)
            }
          }
        )

        syntactic_digraph.remove(intersection)
        collapsed_vertices.push(collapse_vertex)
      }
    }

    syntactic_digraph.vertices.sort((u, v) => {
      assert(u.event)
      assert(v.event)

      return (u.event.index - v.event.index) 
    })

    let hidden_node: Vertex|undefined = undefined

    if(!algorithm.include_subgraph_nodes) {
      const subgraph_nodes = [...syntactic_digraph.vertices]
        .filter((v) => v.kind === "subgraph node")

      if(subgraph_nodes.length > 0) {
        hidden_node = new Vertex({})
        syntactic_digraph.collapse(subgraph_nodes, hidden_node)
        syntactic_digraph.remove(subgraph_nodes)
        syntactic_digraph.remove([hidden_node])
      }
    }

    fun(scope, algorithm, syntactic_digraph, layout)

    if(hidden_node) {
      syntactic_digraph.expand(hidden_node)
    }

    for(let i = collapsed_vertices.length-1; i >= 0; i--) {
      syntactic_digraph.expand(
        collapsed_vertices[i],
        (c, v) => v.pos.shiftByCoordinate(c.pos),
        (a, v) => {
          for(const e of a.syntactic_edges) {
            for(const p of e.path) {
              if(typeof p === 'object') {
                p.shiftByCoordinate(v.pos)
              }
            }
          }
        }
      )

      for(const a of syntactic_digraph.outgoing(collapsed_vertices[i])) {
        for(const e of a.syntactic_edges) {
          for(const p of e.path) {
            if(typeof p === 'object') {
              p.shiftByCoordinate(a.tail.pos)
              p.unshiftByCoordinate(e.tail.pos)
            }
          }
        }
      }
    }
    syntactic_digraph.remove(collapsed_vertices)

    for(let i = uncollapsed_subgraph_nodes.length-1; i >= 0; i--) {
      const _node = uncollapsed_subgraph_nodes[i]
      if(_node) {
        create_subgraph_node(scope, syntactic_digraph, _node)
      }
    }

    nudge(syntactic_digraph)

    for(const v of syntactic_digraph.vertices) {
      // const _p = positions.get(v)
      const _p = getOrSet(positions, v, new WeakMap())
      assert(_p)

      _p.set(syntactic_digraph, v.pos.clone())
    }

    return syntactic_digraph
  }

  export function regardless(graph: Digraph) {
    for(const v of graph.vertices) {
      const regardless = v.option('regardless at')
      if(regardless) {
        offset_vertex(v, Coordinate.sub(regardless, v.pos))
      } 
    }
  }
}
