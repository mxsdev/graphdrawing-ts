import { AbstractGraphAlgorithm } from "../lib/Algorithm"
import { Node } from "../deprecated/Node"
import { OldEdge } from "../deprecated/OldEdge"
import assert from "assert"
import { find } from "../lib/Types"

export class CycleRemovalEadesLS1993 extends AbstractGraphAlgorithm {
  run() {
    assert(this.graph)

    const copied_graph = this.graph.copy()

    const copied_node: WeakMap<Node, Node> = new WeakMap()
    // const origin_node: WeakMap<Node, Node> = new WeakMap()
    const copied_edge: WeakMap<OldEdge, OldEdge> = new WeakMap()
    // const origin_edge: WeakMap<OldEdge, OldEdge> = new WeakMap()

    const preserve: WeakSet<OldEdge> = new WeakSet()

    for(const edge of this.graph.edges) {
      copied_edge.set(edge, edge.copy())

      for(const node of edge.nodes) {
        const copied = copied_node.get(node)
        if(copied){
          copied_edge.get(edge)!.addNode(copied)
        } else {
          const copy = node.copy()

          copied_node.set(node, copy)

          copied_graph.addNode(copy)
          copied_edge.get(edge)!.addNode(copy)
        }
      }
    }

    const node_is_sink = (node: Node) => node.getOutDegree() === 0
    const node_is_source = (node: Node) => node.getInDegree() === 0
    const node_is_isolated = (node: Node) => node.getDegree() === 0

    while(copied_graph.nodes.length > 0) {
      let [sink] = find(copied_graph.nodes, node_is_sink)
      while(sink) {
        for(const edge of sink.getIncomingEdges()) {
          preserve.add(edge)
        }
        copied_graph.deleteNode(sink)
        ;[sink] = find(copied_graph.nodes, node_is_sink)
      }

      let [isolated_node] = find(copied_graph.nodes, node_is_isolated)
      while(isolated_node) {
        copied_graph.deleteNode(isolated_node)
        ;[isolated_node] = find(copied_graph.nodes, node_is_isolated)
      }

      let [source] = find(copied_graph.nodes, node_is_source)
      while(source) {
        for(const edge of source.getOutgoingEdges()) {
          preserve.add(edge)
        }
        copied_graph.deleteNode(source)
        ;[source] = find(copied_graph.nodes, node_is_source)
      }

      if(copied_graph.nodes.length > 0) {
        let max_node: Node|undefined
        let max_out_edges: OldEdge[]|undefined
        let max_in_edges: OldEdge[]|undefined

        for(const node of copied_graph.nodes) {
          const out_edges = node.getOutgoingEdges()
          const in_edges = node.getIncomingEdges()

          if(max_node == null || (out_edges.length - in_edges.length > max_out_edges!.length - max_in_edges!.length)) {
            max_node = node
            max_out_edges = out_edges
            max_in_edges = in_edges
          }
        }

        assert(max_node && max_out_edges && max_in_edges)

        for(const edge of max_out_edges) {
          preserve.add(edge)
          copied_graph.deleteEdge(edge)
        }
        for(const edge of max_in_edges) {
          copied_graph.deleteEdge(edge)
        }

        copied_graph.deleteNode(max_node)
      }
    }

    for(const edge of this.graph.edges) {
      const cedge = copied_edge.get(edge)
      assert(cedge) 

      if(!preserve.has(cedge)) {
        edge.reversed = true
      }
    }
  }
}
