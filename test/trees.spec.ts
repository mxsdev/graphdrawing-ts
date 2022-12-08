// TODO: switch to jest

import { assert } from 'chai'
import { GraphBuilder, TreeDeclarations } from '../src'
import { emptyPath } from './util'

suite("trees", () => {
  test("basic tree", () => {
    const builder = new GraphBuilder(TreeDeclarations)
       .pushOption('disable random')

    const res = 
      builder
        .pushOption('disable random', true)
        .pushOption('tree layout')
        .pushOption('level distance', 6)
        .pushOption('sibling distance', 8)
        .beginGraphDrawingScope()
        .pushLayout()
        .pushVertexOption('root')
        .createVertex("1", undefined, emptyPath())
        .createVertex("2", undefined, emptyPath())
        .createVertex("3", undefined, emptyPath())
        .createEdge("1", "2")
        .createEdge("1", "3")
        .runGraphDrawingAlgorithm()
        .renderGraph()

    const [v1, v2, v3] = res.vertices

    assert.approximately(v1.pos.x, 0, Number.EPSILON)
    assert.approximately(v1.pos.y, 0, Number.EPSILON)

    assert.approximately(v2.pos.x, -4, Number.EPSILON)
    assert.approximately(v2.pos.y, -6.66, Number.EPSILON)

    assert.approximately(v3.pos.x, 4, Number.EPSILON)
    assert.approximately(v3.pos.y, -6.66, Number.EPSILON)
  })
})
