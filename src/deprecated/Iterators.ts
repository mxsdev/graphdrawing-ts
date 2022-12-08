import { OldEdge } from "./OldEdge";
import { OldGraph } from "./OldGraph";

export function *topologicallySorted(dag: OldGraph) {
  const deleted_edges: WeakSet<OldEdge> = new WeakSet()

  const sources = dag.nodes.filter(n => n.getInDegree() === 0)

  while(sources.length > 0) {
    const source = sources.shift()!

    const out_edges = source.getOutgoingEdges()

    for(const edge of out_edges) {
      if(!deleted_edges.has(edge)) {
        deleted_edges.add(edge)

        const neighbour = edge.getNeighbour(source)

        const in_edges = neighbour.getIncomingEdges().filter(e => !deleted_edges.has(e))

        if(in_edges.length === 0) {
          sources.push(neighbour)
        }
      }
    }

    yield source
  }
}
