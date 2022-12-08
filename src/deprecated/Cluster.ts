import { Node } from './Node'
import { OldEdge } from './OldEdge'

export class Cluster {
  name: string
  nodes: Node[] = []
  contains_node: WeakSet<Node> = new WeakSet()

  constructor(name: string) {
    this.name = name
  }

  getName() {
    return this.name
  }

  addNode(node: Node) {
    if(!this.findNode(node)) {
      this.contains_node.add(node)
      this.nodes.push(node)
    }
  }

  findNode(node: Node): boolean {
    return this.contains_node.has(node)
  }
}
