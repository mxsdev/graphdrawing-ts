import assert from "assert";
import { Simplifiers } from "../lib/Simplifiers"
import { Cluster } from "../deprecated/Cluster";
import { Node } from '../deprecated/Node';
import { OldGraph } from "../deprecated/OldGraph";
import { collection_constants, Scope } from "../interface/Scope";
import { GraphAlgorithm, GraphAlgorithmPostConditions, IAlgorithm, IGraphAlgorithm, IOldGraphAlgorithm } from "../lib/Algorithm";
import { Direct } from "../lib/Direct";
import { Event } from "../lib/Event";
import { Storage } from '../lib/Storage';
import { Transform } from '../lib/Transform';
import { find, find_min, getOrSet, Prime } from "../lib/Types";
import { Arc, IArc } from "../model/Arc";
import { Collection } from "../model/Collection";
import { Coordinate } from "../model/Coordinate";
import { Digraph } from "../model/Digraph";
import { Edge } from "../model/Edge";
import { IBoundingBox } from "../model/Path";
import { Vertex } from "../model/Vertex";
import { Sublayouts } from "./Sublayouts";
import { getRandom } from "../lib/Random";

type PrepareRotateReturn =
  {
    from_node: Vertex,
    swap: boolean,
    angle: number,
    to_angle: number,
  } & ({
    from_angle: number,
    to_node?: undefined,
  } | {
    to_node: Vertex,
    from_angle?: undefined
  })

export interface LayoutBB {
  sibling_pre: number,
  sibling_post: number,
  layer_pre: number,
  layer_post: number,
}

export namespace LayoutPipeline {
  export function run(scope: Scope) {
    prepare_events(scope.events)

    const root_layout = scope.collections[collection_constants.sublayout_kind]?.[0]
    assert(root_layout, "no layout in scope")


    scope.syntactic_digraph =
      Sublayouts.layoutRecursively(scope,
        root_layout,
        LayoutPipeline.runOnLayout)
    // [ root_layout ])

    LayoutPipeline.anchor(scope.syntactic_digraph, scope)

    Sublayouts.regardless(scope.syntactic_digraph)

    LayoutPipeline.cutEdges(scope.syntactic_digraph)
  }

  export function runOnLayout(scope: Scope, algorithm_class: GraphAlgorithm, layout_graph: Digraph, layout: Collection) {
    if (layout_graph.vertices.size < 1) {
      return
    }

    const layout_copy = layout_graph.copy()
    for (const a of layout_graph.arcs) {
      const new_a = layout_copy.connect(a.tail, a.head)
      new_a.syntactic_edges = a.syntactic_edges
    }

    let syntactic_components: Digraph[]

    if (algorithm_class.preconditions.tree || algorithm_class.preconditions.connected || layout_graph.option('componentwise')) {
      syntactic_components = LayoutPipeline.decompose(layout_copy)
      LayoutPipeline.sortComponents(layout_graph.option('component order'), syntactic_components)
    } else {
      syntactic_components = [layout_copy]
    }

    for (const [i, syntactic_component] of syntactic_components.entries()) {
      // TODO: allow random seeding
      // lib.randomseed(layout_graph.options['random seed'])
      // console.log(syntactic_component._options_proxy)

      const digraph = Direct.digraphFromSyntacticDigraph(syntactic_component)

      if (algorithm_class.preconditions.loop_free) {
        for (const v of digraph.vertices) {
          digraph.disconnect(v, v)
        }
      }

      const ugraph = Direct.ugraphFromDigraph(digraph)
      const random = getRandom(digraph)

      for (const alg of layout_graph.option_algorithm_phase('preprocessing stack')) {
        new alg.constructor({
          digraph, ugraph, scope, layout, layout_graph, syntactic_component, events: scope.events, random
        }).run()
      }

      const algorithm = new algorithm_class.constructor({
        digraph, ugraph, scope, layout, layout_graph, syntactic_component, events: scope.events, random
      })

      if (algorithm_class.preconditions.tree) {
        const spanning_algorithm = syntactic_component.option_algorithm_phase('spanning tree computation')
        assert(spanning_algorithm)

        algorithm.spanning_tree =
          new spanning_algorithm.constructor({
            digraph, ugraph, scope, layout, layout_graph, syntactic_component, events: scope.events, random
          }).run()
      }

      algorithm.rotation_info = LayoutPipeline.prepareRotateAround(algorithm_class.postconditions ?? {}, syntactic_component)
      algorithm.adjusted_bb = new WeakMap()
      LayoutPipeline.prepareBoundingBoxes(algorithm.rotation_info, algorithm.adjusted_bb, syntactic_component, syntactic_component.vertices.getArray())

      if (digraph.vertices.size > 1 || algorithm_class.run_also_for_single_node
        || algorithm_class.preconditions.at_least_two_nodes === false) {
        if (algorithm_class.old_graph_algorithm) {
          runOldGraphModel(scope, digraph, algorithm_class, algorithm)
        } else {
          algorithm.run()
        }
      }

      for (const alg of layout_graph.option_algorithm_phase('edge routing stack')) {
        new alg.constructor({
          digraph, ugraph, scope, layout, layout_graph, syntactic_component, events: scope.events, random
        }).run()
      }

      for (const alg of layout_graph.option_algorithm_phase('postprocessing stack')) {
        new alg.constructor({
          digraph, ugraph, scope, layout, layout_graph, syntactic_component, events: scope.events, random
        }).run()
      }

      digraph.sync()
      ugraph.sync()
      algorithm.spanning_tree?.sync()

      LayoutPipeline.orient(algorithm.rotation_info, algorithm_class.postconditions, syntactic_component, scope)
    }

    LayoutPipeline.packComponents(layout_graph, syntactic_components)
  }

  export function anchor(graph: Digraph, scope: Scope) {
    let anchor_node: Vertex | undefined

    const anchor_node_name = graph.option('anchor node')
    if (anchor_node_name) {
      anchor_node = scope.node_names[anchor_node_name]
    }

    if (!anchor_node || !graph.contains(anchor_node)) {
      anchor_node =
        find(graph.vertices, (v) => v.option('anchor here'))?.[0] ??
        find(graph.vertices, (v) => v.option('desired at'))?.[0] ??
        graph.vertices.at(0)
    }

    assert(anchor_node)
    assert(graph.contains(anchor_node), "anchor node is not in graph!")

    const desired = anchor_node.option('desired at') ?? graph.option('anchor at')
    assert(desired)

    const delta = Coordinate.sub(desired, anchor_node.pos)

    for (const v of graph.vertices) {
      v.pos.shiftByCoordinate(delta)
    }

    for (const a of graph.arcs) {
      if (a.path) a.path.shiftByCoordinate(delta)

      for (const e of a.syntactic_edges) {
        e.path.shiftByCoordinate(delta)
      }
    }
  }


  export function prepareRotateAround(postconditions: GraphAlgorithmPostConditions, graph: Digraph): PrepareRotateReturn {
    let swap = true

    let [v, _, grow] = find(graph.vertices, (v) => v.option('grow'))

    const ggrow = graph.option('grow')

    if (!v && ggrow != null) {
      [v, grow, swap] = [graph.vertices.at(0), ggrow, true]
    }

    if (!v) {
      [v, _, grow] = find(graph.vertices, (v) => v.option(`grow'`))
      swap = false
    }

    const ggrowp = graph.option(`grow'`)

    if (!v && ggrowp != null) {
      [v, grow, swap] = [graph.vertices.at(0), ggrowp, false]
    }

    if (!v) {
      [v, grow, swap] = [graph.vertices.at(0), -90, true]
    }

    assert(v)
    assert(grow != null)

    const growth_direction = (postconditions.upward_oriented && 90) || (postconditions.upward_oriented_swapped && 90)

    if (postconditions.upward_oriented_swapped) {
      swap = !swap
    }

    if (growth_direction != null && growth_direction !== false) {
      const from_angle = growth_direction / 360 * 2 * Math.PI
      const to_angle = grow / 360 * 2 * Math.PI
      return {
        from_node: v,
        from_angle,
        to_angle,
        swap: swap,
        angle: to_angle - from_angle,
      }
    } else {
      const _min = find_min(graph.outgoing(v), (a) => {
        const evtIdx = Arc.eventIndex(a)

        if (a.head !== v && evtIdx != null) {
          return [a, evtIdx]
        }
      })

      const other = _min?.[0]

      const to_angle = grow / 360 * 2 * Math.PI

      const to_node = (other ? other.head
        : graph.vertices.at(0) === v ? graph.vertices.at(1)
          : graph.vertices.at(0)) ?? graph.vertices.at(0)

      assert(to_node)

      return {
        from_node: v,
        to_node,
        to_angle,
        swap: swap,
        angle: to_angle - Math.atan2(
          to_node.pos.y - v.pos.y,
          to_node.pos.x - v.pos.x
        )
      }
    }
  }

  export function prepareBoundingBoxes(
    rotation_info: ReturnType<typeof prepareRotateAround>,
    adjusted_bb: Storage<Vertex, LayoutBB>,
    graph: Digraph, vertices: Vertex[]
  ) {
    const { angle, swap } = rotation_info

    for (const v of vertices) {
      let bb = adjusted_bb.get(v)
      let a = angle

      if (v.shape === 'circle') {
        a = 0
      }

      if (!bb) {
        bb = {
          sibling_pre: Number.POSITIVE_INFINITY,
          sibling_post: Number.NEGATIVE_INFINITY,
          layer_pre: Number.POSITIVE_INFINITY,
          layer_post: Number.NEGATIVE_INFINITY,
        }

        adjusted_bb.set(v, bb)
      }

      const c = Math.cos(angle)
      const s = Math.sin(angle)
      for (const p of v.path.coordinates()) {
        const x = p.x * c + p.y * s
        const y = -p.x * s + p.y * c

        bb.sibling_pre = Math.min(bb.sibling_pre, x)
        bb.sibling_post = Math.max(bb.sibling_post, x)
        bb.layer_pre = Math.min(bb.layer_pre, y)
        bb.layer_post = Math.max(bb.layer_post, y)
      }

      if (swap) {
        const temp = bb.sibling_pre
        bb.sibling_pre = -bb.sibling_post
        bb.sibling_post = -temp
      }
    }
  }

  export function rotateGraphAround(graph: Digraph, around_x: number, around_y: number, from: number, to: number, swap?: boolean) {
    let t = Transform.new_shift(-around_x, -around_y)

    // Rotate to zero degrees:
    t = Transform.concat(Transform.new_rotation(-from), t)

    // Swap
    if (swap) {
      t = Transform.concat(Transform.new_scaling(1, -1), t)
    }

    // Rotate to from degrees:
    t = Transform.concat(Transform.new_rotation(to), t)

    // Translate back
    t = Transform.concat(Transform.new_shift(around_x, around_y), t)

    for (const v of graph.vertices) {
      v.pos.apply(t)
    }

    for (const a of graph.arcs) {
      for (const p of Arc.pointCloud(a)) {
        p.apply(t)
      }
    }
  }

  export function orientTwoNodes(graph: Digraph, first_node: Vertex, second_node: Vertex, target_angle: number, swap?: boolean) {
    if (first_node && second_node) {
      const x = second_node.pos.x - first_node.pos.x
      const y = second_node.pos.y - first_node.pos.y

      const angle = Math.atan2(y, x)
      LayoutPipeline.rotateGraphAround(graph, first_node.pos.x,
        first_node.pos.y, angle, target_angle, swap)
    }
  }

  export function orient(
    rotation_info: ReturnType<typeof prepareRotateAround>,
    postconditions: GraphAlgorithmPostConditions,
    graph: Digraph,
    scope: Scope,
  ) {
    if (graph.vertices.size < 2) return

    const f = (orient: number | undefined, tail: string | undefined, head: string | undefined, flag: boolean) => {
      if (orient && head && tail) {
        const n1 = scope.node_names[tail]
        const n2 = scope.node_names[head]
        if (graph.contains(n1) && graph.contains(n2)) {
          LayoutPipeline.orientTwoNodes(graph, n1, n2, orient / 360 * 2 * Math.PI, flag)
          return true
        }
      }
    }

    if (f(graph.option("orient"), graph.option("orient tail"), graph.option("orient head"), false)) { return }
    if (f(graph.option("orient'"), graph.option("orient tail"), graph.option("orient head"), true)) { return }

    const reg = /^(.*) to (.*)$/

    let [_, tail, head] = reg.exec(graph.option('horizontal') || "") ?? []
    if (f(0, tail, head, false)) { return }
    [_, tail, head] = reg.exec(graph.option(`horizontal'`) || "") ?? []
    if (f(0, tail, head, true)) { return }
    [_, tail, head] = reg.exec(graph.option(`vertical`) || "") ?? []
    if (f(-90, tail, head, false)) { return }
    [_, tail, head] = reg.exec(graph.option(`vertical'`) || "") ?? []
    if (f(-90, tail, head, true)) { return }

    for (const v of graph.vertices) {
      const h = (key: Prime<'orient'>, flag: boolean) => {
        const orient = v.option(key)
        const head = v.option('orient head')
        const tail = v.option('orient tail')

        if (orient && head) {
          const n2 = scope.node_names[head]
          if (graph.contains(n2)) {
            LayoutPipeline.orientTwoNodes(graph, v, n2, orient / 360 * 2 * Math.PI, flag)
            return true
          }
        } else if (orient && tail) {
          const n1 = scope.node_names[tail]
          if (graph.contains(n1)) {
            LayoutPipeline.orientTwoNodes(graph, n1, v, orient / 360 * 2 * Math.PI, flag)
            return true
          }
        }
      }

      if (h('orient', false)) { return }
      if (h(`orient'`, true)) { return }
    }

    for (const a of graph.arcs) {
      const aorient = Arc.options(a, 'orient', true)
      if (aorient) {
        const aorient_val = Arc.options(a, 'orient')
        assert(aorient_val)

        return LayoutPipeline.orientTwoNodes(graph,
          a.tail,
          a.head,
          (aorient_val) / 360 * 2 * Math.PI,
          false)
      }

      const aorientp = Arc.options(a, `orient'`, true)
      if (aorientp) {
        const aorientp_val = Arc.options(a, `orient'`)
        assert(aorientp_val)

        return LayoutPipeline.orientTwoNodes(graph,
          a.tail,
          a.head,
          (aorientp_val) / 360 * 2 * Math.PI,
          true)
      }
    }

    let first: Vertex | undefined
    let second: Vertex | undefined
    let third: Vertex | undefined

    for (const v of graph.vertices) {
      if (v.option('desired at')) {
        if (first) {
          if (second) {
            third = v
            break
          } else {
            second = v
          }
        } else {
          first = v
        }
      }
    }

    if (second) {
      assert(first)

      const a = first.option('desired at')
      const b = second.option('desired at')

      assert(a)
      assert(b)

      return LayoutPipeline.orientTwoNodes(
        graph, first, second,
        Math.atan2(b.y - a.y, b.x - a.x),
        false
      )
    }

    if (rotation_info.from_node && postconditions.fixed !== true) {
      const { x, y } = rotation_info.from_node.pos
      const from_angle = rotation_info.from_angle ?? Math.atan2(rotation_info.to_node.pos.y - y, rotation_info.to_node.pos.x - x)

      LayoutPipeline.rotateGraphAround(
        graph, x, y, from_angle,
        rotation_info.to_angle,
        rotation_info.swap,
      )
    }
  }

  export function decompose(digraph: Digraph): Digraph[] {
    const components: Digraph[] = []
    const visited = new WeakSet<Vertex>()

    for (const v of digraph.vertices) {
      if (!visited.has(v)) {
        const stack: Vertex[] = [v]
        const component = new Digraph({
          syntactic_digraph: digraph.syntactic_digraph,
        }, digraph)

        while (stack.length >= 1) {
          const tos = stack.pop()!

          if (!visited.has(tos)) {
            component.add(tos)
            visited.add(tos)

            for (const a of digraph.incoming(tos)) {
              const neighbor = a.tail
              if (!visited.has(neighbor)) {
                stack.push(neighbor)
              }
            }

            for (const a of digraph.outgoing(tos)) {
              const neighbor = a.head
              if (!visited.has(neighbor)) {
                stack.push(neighbor)
              }
            }
          }
        }

        components.push(component)
      }
    }

    if (components.length < 2) {
      return [digraph]
    }

    for (const c of components) {
      c.vertices.sort((u, v) => {
        assert(u.event)
        assert(v.event)

        return (u.event.index - v.event.index)
      })

      for (const v of c.vertices) {
        for (const a of [...digraph.outgoing(v), ...digraph.incoming(v)]) {
          const new_a = c.connect(a.tail, a.head)
          new_a.syntactic_edges = a.syntactic_edges
        }
      }
    }

    return components
  }

  export function sortComponents(component_order: keyof typeof component_ordering_functions | undefined, subgraphs: Digraph[]) {
    if (component_order) {
      assert(component_order in component_ordering_functions, "unknown component order")

      const f = component_ordering_functions[component_order]
      if (f) {
        // FIXME: this may not work in js...
        subgraphs.sort((g, h) => f(g, h) ? 1 : -1)
      }
    }
  }

  export function packComponents(syntactic_digraph: Digraph, components: Digraph[]) {
    const vertices: Storage<Digraph, Vertex[]> = new WeakMap()
    const bb: Storage<Vertex, IBoundingBox & { c_y: number }> = new WeakMap()

    const sep = syntactic_digraph.option('component sep')
    const _angle = syntactic_digraph.option('component direction')

    assert(sep != null)
    assert(_angle != null)

    const angle = _angle * ( Math.PI / 180 )

    for (const c of components) {
      const vs: Vertex[] = [...c.vertices]

      for (const a of c.arcs) {
        for (const p of Arc.pointCloud(a)) {
          vs.push(new Vertex({ pos: p }))
        }
      }
      vertices.set(c, vs)

      compute_rotated_bb(vs, angle, sep / 2, bb)
    }

    const x_shifts: number[] = [0]
    const y_shifts: number[] = []

    for (const [i, c] of components.entries()) {
      let max_max_y = Number.NEGATIVE_INFINITY
      let max_center_y = Number.NEGATIVE_INFINITY
      let min_min_y = Number.POSITIVE_INFINITY
      let min_center_y = Number.POSITIVE_INFINITY

      for (const v of c.vertices) {
        const info = bb.get(v)
        assert(info)

        max_max_y = Math.max(info.max_y, max_max_y)
        max_center_y = Math.max(info.c_y, max_center_y)
        min_min_y = Math.min(info.min_y, min_min_y)
        min_center_y = Math.min(info.c_y, min_center_y)
      }

      // Compute alignment line
      const valign = syntactic_digraph.option('component align')
      let line: number
      switch (valign) {
        case "counterclockwise bounding box": {
          line = max_max_y
          break
        }

        case "counterclockwise": {
          line = max_center_y
          break
        }

        case "center": {
          line = (max_max_y + min_min_y) / 2
          break
        }

        case "clockwise": {
          line = min_center_y
          break
        }

        case "first node": {
          line = bb.get(c.vertices.at(0)!)!.c_y
          break
        }

        default: {
          line = min_min_y
          break
        }
      }

      // Overruled?
      for (const v of c.vertices) {
        if (v.option('align here')) {
          line = bb.get(v)!.c_y
          break
        }
      }

      // Ok, go!
      y_shifts[i] = -line

      // Adjust nodes:
      for (const v of vertices.get(c)!) {
        const info = bb.get(v)
        assert(info)

        info.min_y = info.min_y - line
        info.max_y = info.max_y - line
        info.c_y = info.c_y - line
      }
    }

    const y_values: number[] = []

    for (const c of components) {
      for (const v of vertices.get(c)!) {
        const info = bb.get(v)
        assert(info)

        y_values.push(info.min_y)
        y_values.push(info.max_y)
        y_values.push(info.c_y)
      }
    }

    y_values.sort((a, b) => a-b)

    const y_ranks: number[] = []
    const right_face: number[] = []
    for (let i = 0; i < y_values.length; i++) {
      y_ranks[y_values[i]] = i
      right_face[i] = Number.NEGATIVE_INFINITY
    }



    for (let _i = 0; _i < components.length - 1; _i++) {
      let touched: boolean[] = []

      for (const v of vertices.get(components[_i])!) {
        const info = bb.get(v)
        assert(info)

        const border = info.max_x

        for (let i = y_ranks[info.min_y]; i <= y_ranks[info.max_y]; i++) {
          touched[i] = true
          right_face[i] = Math.max(right_face[i], border)
        }
      }

      let right_max = Number.NEGATIVE_INFINITY
      for (let i = 0; i < y_values.length; i++) {
        if (!touched[i]) {
          let interpolate = Number.NEGATIVE_INFINITY
          for (let j = i + 1; j < y_values.length; j++) {
            if (touched[j]) {
              interpolate = Math.max(interpolate, right_face[j] - (y_values[j] - y_values[i]))
              break
            }
          }
          for (let j = i - 1; j >= 0; j--) {
            if (touched[j]) {
              interpolate = Math.max(interpolate, right_face[j] - (y_values[i] - y_values[j]))
              break
            }
          }
          right_face[i] = Math.max(interpolate, right_face[i])
        }
        right_max = Math.max(right_max, right_face[i])
      }

      touched = []
      const left_face: number[] = new Array(y_values.length).fill(Number.POSITIVE_INFINITY)
      for (const v of vertices.get(components[_i + 1])!) {
        const info = bb.get(v)
        assert(info)
        const border = info.min_x

        for (let i = y_ranks[info.min_y]; i <= y_ranks[info.max_y]; i++) {
          touched[i] = true
          left_face[i] = Math.min(left_face[i], border)
        }
      }

      let left_min = Number.POSITIVE_INFINITY
      for (let i = 0; i < y_values.length; i++) {
        if (!touched[i]) {
          let interpolate = Number.POSITIVE_INFINITY
          for (let j = i + 1; j < y_values.length; j++) {
            if (touched[j]) {
              interpolate = Math.min(interpolate, left_face[j] + (y_values[j] - y_values[i]))
              break
            }
          }
          for (let j = i - 1; j >= 0; j--) {
            if (touched[j]) {
              interpolate = Math.min(interpolate, left_face[j] + (y_values[i] - y_values[j]))
              break
            }
          }
          left_face[i] = interpolate
        }
        left_min = Math.min(left_min, left_face[i])
      }

      let shift = Number.NEGATIVE_INFINITY

      if (syntactic_digraph.option('component packing') === 'rectangular') {
        shift = right_max - left_min
      } else {
        for (let i = 0; i < y_values.length; i++) {
          shift = Math.max(shift, right_face[i] - left_face[i])
        }
      }

      x_shifts[_i + 1] = shift
      for (const v of vertices.get(components[_i + 1])!) {
        const info = bb.get(v)
        assert(info)

        info.min_x = info.min_x + shift
        info.max_x = info.max_x + shift
      }
    }

    for (const [i, c] of components.entries()) {
      assert(x_shifts[i] != null && y_shifts[i] != null)

      const x = x_shifts[i] * Math.cos(angle) - y_shifts[i] * Math.sin(angle)
      const y = x_shifts[i] * Math.sin(angle) + y_shifts[i] * Math.cos(angle)

      for (const v of vertices.get(c)!) {
        v.pos.x = v.pos.x + x
        v.pos.y = v.pos.y + y
      }
    }
  }

  export function cutEdges(graph: Digraph) {
    for (const a of graph.arcs) {
      for (const e of a.syntactic_edges) {
        const p = e.path
        p.makeRigid()
        const orig = p.clone()

        if (e.option('tail cut') && e.tail.option('cut policy') === 'as edge requests'
          || e.head.option('cut policy') === 'all') {

          const vpath = e.head.path.clone()
          vpath.shiftByCoordinate(e.head.pos)
          const x = p.intersectionsWith(vpath)
          if (x.length > 0) {
            p.cutAtEnd(x[x.length - 1].index, x[x.length - 1].time)
          } else {
            const x2 = orig.intersectionsWith(vpath)
            if (x2.length > 0) {
              if (e.option('allow inside edges') && p.length > 1) {
                const from = p._commands[1]
                assert(from instanceof Coordinate)

                const to = x2[0].point
                p.clear()
                p.appendMoveto(from)
                p.appendLineto(to)
              } else {
                p.clear()
              }
            }
          }
        }
      }
    }
  }
}

function runOldGraphModel(scope: Scope, digraph: Digraph, algorithm_class: GraphAlgorithm, _algorithm: IGraphAlgorithm & IAlgorithm) {
  const graph = compatibility_digraph_to_graph(scope, digraph)

  _algorithm.graph = graph
  const algorithm = _algorithm as IOldGraphAlgorithm & IAlgorithm

  graph.registerAlgorithm(algorithm)

  if (algorithm_class.preconditions.loop_free) {
    Simplifiers.removeLoopsOldModel(algorithm)
  }

  if (algorithm_class.preconditions.simple) {
    Simplifiers.collapseMultiedgesOldModel(algorithm)
  }

  if (graph.nodes.length > 1) {
    algorithm.run()
  }

  if (algorithm_class.preconditions.simple) {
    Simplifiers.expandMultiedgesOldModel(algorithm)
  }

  if (algorithm_class.preconditions.loop_free) {
    Simplifiers.removeLoopsOldModel(algorithm)
  }

  compatibility_graph_to_digraph(graph)
}

let unique_count = 0

function compatibility_digraph_to_graph(scope: Scope, g: Digraph): OldGraph {
  const graph = new OldGraph()

  graph._options = g._options
  graph._options_proxy = g._options_proxy
  graph.orig_digraph = g

  for (const e of scope.events) {
    graph.events.push(e)
  }

  for (const v of g.vertices) {
    if (!v.name) {
      v.name = "auto generated node nameINTERAL" + unique_count
      unique_count++
    }
    const [minX, minY, maxX, maxY] = v.boundingBox()
    const node = new Node({
      name: v.name,
      tex: {
        // tex_node skipped
        shape: v.shape,
        minX, maxX, minY, maxY,
      },
      event_index: v.event?.index,
      index: v.event?.index,
    })
    node._options = v._options
    node._options_proxy = v._options_proxy
    node.orig_vertex = v

    graph.addNode(node)
    const idx = v.event?.index ?? graph.events.length
    graph.events[idx] = new Event({ kind: 'old_node', parameters: node, index: idx })
  }

  // Edges
  const createEdge = (da: IArc | undefined) => {
    if (da) {
      for (const m of da.syntactic_edges) {
        if (!mark.has(m)) {
          mark.add(m)
          const [from_node] = graph.findNode(da.tail.name)
          const [to_node] = graph.findNode(da.head.name)
          assert(from_node && to_node)

          const edge = graph.createEdge(from_node, to_node, m.direction, undefined, m._options, m._options_proxy, undefined)
          edge.event_index = m.event.index
          edge.orig_m = m

          graph.events[m.event.index] = new Event({ kind: 'old_edge', parameters: edge, index: m.event.index })
        }
      }
    }
  }

  const mark: WeakSet<Edge> = new WeakSet()
  for (const a of g.arcs) {
    createEdge(g.syntactic_digraph.arc(a.tail, a.head))
    createEdge(g.syntactic_digraph.arc(a.head, a.tail))
  }

  graph.edges.sort((e1, e2) => e1.event_index! - e2.event_index!)
  for (const n of graph.nodes) {
    n.edges.sort((e1, e2) => e1.event_index! - e2.event_index!)
  }

  // Clusters
  for (const c of scope.collections['same layer'] ?? []) {
    const cluster = new Cluster("cluster" + unique_count)
    unique_count++
    graph.addCluster(cluster)
    for (const v of c.vertices) {
      if (g.contains(v)) {
        const found_node = graph.findNode(v.name)[0]
        assert(found_node)

        cluster.addNode(found_node)
      }
    }
  }

  return graph
}

function compatibility_graph_to_digraph(graph: OldGraph) {
  for (const n of graph.nodes) {
    n.orig_vertex!.pos.x = n.pos.x
    n.orig_vertex!.pos.y = n.pos.y
  }
  for (const e of graph.edges) {
    if (e.bend_points.length > 0) {
      const c: Coordinate[] = []
      for (const x of e.bend_points) {
        c.push(new Coordinate(x.x, x.y))
      }
      e.orig_m!.setPolylinePath(c)
    }
  }
}

function compute_rotated_bb(vertices: Vertex[], angle: number, sep: number, bb: WeakMap<Vertex, IBoundingBox & { c_y?: number }>) {
  const r = Transform.new_rotation(-angle)

  for (const v of vertices) {
    // Find the rotated bounding box field,
    const t = Transform.concat(r, Transform.new_shift(v.pos.x, v.pos.y))

    let min_x = Number.POSITIVE_INFINITY
    let max_x = Number.NEGATIVE_INFINITY
    let min_y = Number.POSITIVE_INFINITY
    let max_y = Number.NEGATIVE_INFINITY

    for (const e of v.path) {
      if (typeof e === 'object') {
        const c = e.clone()
        c.apply(t)

        min_x = Math.min(min_x, c.x)
        max_x = Math.max(max_x, c.x)
        min_y = Math.min(min_y, c.y)
        max_y = Math.max(max_y, c.y)
      }
    }

    // Enlarge by sep:
    min_x = min_x - sep
    max_x = max_x + sep
    min_y = min_y - sep
    max_y = max_y + sep

    const [_, __, ___, ____, c_x, c_y] = v.boundingBox()
    const center = new Coordinate(c_x, c_y)

    center.apply(t)

    const _bb = getOrSet(bb, v, { min_x, max_x, min_y, max_y, c_y })

    _bb.min_x = min_x
    _bb.max_x = max_x
    _bb.min_y = min_y
    _bb.max_y = max_y
    _bb.c_y = center.y
  }
}

export type ComponentOrderingFunction = keyof typeof component_ordering_functions

const component_ordering_functions = {
  'increasing node number': (g: Digraph, h: Digraph) => {
    if (g.vertices.size === h.vertices.size) {
      return g.vertices.at(0)!.event!.index < h.vertices.at(0)!.event!.index
    } else {
      return g.vertices.size < h.vertices.size
    }
  },
  'decreasing node number': (g: Digraph, h: Digraph) => {
    if (g.vertices.size === h.vertices.size) {
      return g.vertices.at(0)!.event!.index < h.vertices.at(0)!.event!.index
    } else {
      return g.vertices.size > h.vertices.size
    }
  },
  'by first specified node': undefined,
}

function prepare_events(events: Event[]) {
  const stack: number[] = []

  for (const [i, event] of events.entries()) {
    if (event.kind === 'begin') {
      stack.push(i)
    } else if (event.kind === 'end') {
      const tos = stack.pop()
      assert(tos)

      events[tos].end_index = i
      events[tos].begin_index = tos
    }
  }
}
