import { Digraph } from '../model/Digraph'

export namespace Direct {
  export function digraphFromSyntacticDigraph(syntactic_digraph: Digraph) {
    const digraph = syntactic_digraph.copy() // copy

    // Now go over all arcs of the syntactic_digraph and turn them into
    // arcs with the correct direction in the digraph:
    for(const a of syntactic_digraph.arcs) {
      for(const m of a.syntactic_edges) {
        const { direction } = m
        switch(direction) {
          case "->": {
            digraph.connect(a.tail, a.head)
            break
          }

          case "<-": {
            digraph.connect(a.head, a.tail)
            break
          }

          case "--":
          case "<->": {
            digraph.connect(a.tail, a.head)
            digraph.connect(a.head, a.tail)
            break
          }
          
          default:
          // Case -!-: No edges...
        }
      }
    }

    return digraph
  }

  export function ugraphFromDigraph(digraph: Digraph) {
    const ugraph = digraph.copy()

    for(const a of digraph.arcs) {
      ugraph.connect(a.head, a.tail)
      ugraph.connect(a.tail, a.head)
    }

    return ugraph
  }
}
