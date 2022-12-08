import { lerpDist } from "./geometry"
import { RenderGraphResult } from "graphdrawing-ts"

type GraphCoord = { x: number, y: number }

type NodeToDraw = { pos: GraphCoord, text: string, name: string }

type EdgeToDraw = { from: GraphCoord, to: GraphCoord, arrow?: { end?: boolean, start?: boolean } }

type GraphToDraw = {
  vertices: NodeToDraw[],
  edges: EdgeToDraw[],
}

const stroke_size = 2
const arrow_width = 5.5
const arrow_height = arrow_width * Math.sqrt(3) / 2 * 1.5

export function SVGGraphResult(
    { graph: res, text, nodeSize }: {
        graph: RenderGraphResult, 
        text?: Record<any, string | { toString: () => string }>, 
        nodeSize: number
    }
) {
    return <SVGGraph 
        graph={{
            vertices: res.vertices.map(({ name, pos }) => (
                { pos, name: name!, text: text ? (name ? text[name]?.toString() : '') : name ?? '' }
            )),
            edges: res.edges.map(({ head, tail, direction }) => ({
                from: head.pos, to: tail.pos,
                arrow: { start: direction === '<-' || direction === '<->', end: direction === '->' || direction === '<->' }
            }))
        }}
        nodeSize={nodeSize}
    />
}

export function SVGGraph(
    { 
        graph: g, 
        nodeSize,
    }: {
        graph: GraphToDraw,
        nodeSize: number
    }
) {
  if (g.vertices.length === 0) return <></>

  const min_x = Math.min(...g.vertices.map(v => v.pos.x)) - nodeSize - stroke_size
  const max_x = Math.max(...g.vertices.map(v => v.pos.x)) + nodeSize + stroke_size
  const min_y = Math.min(...g.vertices.map(v => v.pos.y)) - nodeSize - stroke_size
  const max_y = Math.max(...g.vertices.map(v => v.pos.y)) + nodeSize + stroke_size

  const width = max_x - min_x
  const height = max_y - min_y

  const viewBox = `${min_x} ${min_y} ${width} ${height}`

  return (
    <svg
      viewBox={viewBox}
      width={width}
      height={height}
    >
      <marker 
        id="arrowhead" 
        markerWidth={arrow_height} 
        markerHeight={arrow_width}
        refX={arrow_height} 
        refY={arrow_width / 2} 
        orient="auto-start-reverse"
    >
        <polygon 
            style={{ fill: 'inherit' }} 
            points={`0 0, ${arrow_height} ${arrow_width / 2}, 0 ${arrow_width}`} 
        />
      </marker>

      {g.edges.map(e => drawEdge(e, nodeSize))}
      {g.vertices.map((v) => drawNode(v, nodeSize))}
    </svg>
  )
}

function drawNode(node: NodeToDraw, nodeSize: number) {
  return (
    <g key={node.name}>
      <circle
        cx={node.pos.x}
        cy={node.pos.y}
        r={nodeSize}

        // style
        strokeWidth={stroke_size}

        style={{
          stroke: 'inherit',
          fill: 'none',
        }}
      />
      <text
        x={node.pos.x}
        y={node.pos.y}
        textAnchor="middle"
        alignmentBaseline="central"
        style={{
          lineHeight: 0,
          fill: 'inherit',
          stroke: 'none'
        }}
        fontSize={(nodeSize) * 1}
      >
        {node.text}
      </text>
    </g>
  )
}

function drawEdge(edge: EdgeToDraw, nodeSize: number) {
  const start = lerpDist(edge.from, edge.to, nodeSize)
  const end = lerpDist(edge.to, edge.from, nodeSize)

  const arrowHeadProps = {
    ...(edge.arrow?.end && { markerStart: `url(#arrowhead)` }),
    ...(edge.arrow?.start && { markerEnd: `url(#arrowhead)` }),
  }

  return <line
    x1={start.x}
    y1={start.y}
    x2={end.x}
    y2={end.y}
    strokeWidth={stroke_size}
    style={{
      stroke: 'inherit'
    }}

    {...arrowHeadProps}
  />
}
