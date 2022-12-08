import { useState } from 'react'
import { GraphBuilder, ForceDeclarations, Path } from 'graphdrawing-ts'
import { SVGGraphResult } from './renderGraph'

const nodeSize = 25
const siblingSep = 20

const builder = new GraphBuilder(ForceDeclarations)

builder
  .pushOption('spring Hu 2006 layout')
  .pushOption('node distance', nodeSize * 3.5)
  .pushOption('sibling sep', siblingSep)

builder.beginGraphDrawingScope().pushLayout()

builder.createVertex("1", undefined, Path.squarePath(nodeSize))
builder.createVertex("2", undefined, Path.squarePath(nodeSize))
builder.createVertex("3", undefined, Path.squarePath(nodeSize))

builder.createEdge("1", "2")
builder.createEdge("1", "3")
builder.createEdge("2", "3")

builder.runGraphDrawingAlgorithm()

const renderedGraph = builder.renderGraph()

function App() {
  const [count, setCount] = useState(0)

  return (
    <div id="container">
      <SVGGraphResult 
        graph={renderedGraph}
        nodeSize={nodeSize}
      />
    </div>
  )
}

export default App
