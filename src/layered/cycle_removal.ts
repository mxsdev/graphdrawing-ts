import {CycleRemovalGansnerKNV1993} from './CycleRemovalGansnerKNV1993'
import {CycleRemovalEadesLS1993} from './CycleRemovalEadesLS1993'
import { CycleRemovalBergerS1990a } from './CycleRemovalBergerS1990a'
import { CycleRemovalBergerS1990b } from './CycleRemovalBergerS1990b'

const Declare = {
  "depth first cycle removal": {
  // key: "depth first cycle removal",
  algorithm: CycleRemovalGansnerKNV1993,
  phase: "cycle removal",
  phase_default: true,

  summary: `"
    Selects a cycle removal algorithm that is especially
    appropriate for graphs specified \`\`by hand''.
  "`,
  documentation: `"
    When graphs are created by humans manually, one can
    make assumptions about the input graph that would otherwise not
    be possible. For instance, it seems reasonable to assume that the
    order in which nodes and edges are entered by the user somehow
    reflects the natural flow the user has had in mind for the graph.

    In order to preserve the natural flow of the input graph, Gansner
    et al.\\ propose to remove cycles by performing a series of
    depth-first searches starting at individual nodes in the order they
    appear in the graph. This algorithm implicitly constructs a spanning
    tree of the nodes reached during the searches. It thereby partitions
    the edges of the graph into tree edges and non-tree edges. The
    non-tree edges are further subdivided into forward edges, cross edges,
    and back edges. Forward edges point from a tree nodes to one of their
    descendants. Cross edges connect unrelated branches in the search tree.
    Back edges connect descendants to one of their ancestors. It is not
    hard to see that reversing back edges will not only introduce no new
    cycles but will also make any directed graph acyclic.
    Gansner et al.\\ argue that this approach is more stable than others
    in that fewer inappropriate edges are reversed compared to other
    methods, despite the lack of a provable upper bound for the number
    of reversed edges.

    See section~4.1.1 of Pohlmann's Diplom thesis for more details.

    This is the default algorithm for cycle removals.
  "`
 },

//-

"prioritized greedy cycle removal": {
  // key: "prioritized greedy cycle removal",
  algorithm: CycleRemovalEadesLS1993,

  phase: "cycle removal",

  summary: `"
    This algorithm implements a greedy heuristic of Eades et al.\\ for
    cycle removal that  prioritizes sources and sinks.
  "`,
  documentation: `"
    See section~4.1.1 of Pohlmann's Diploma theses for details.
  "`
},


//-

"greedy cycle removal": {
  // key: "greedy cycle removal",
  algorithm: CycleRemovalEadesLS1993,
  phase: "cycle removal",

  summary: `"
    This algorithm implements a greedy heuristic of Eades et al.\\ for
    cycle removal that prioritizes sources and sinks.
  "`,
  documentation: `"
    See section~4.1.1 of Pohlmann's Diploma theses for details.
  "`
 },

//-

"naive greedy cycle removal": {
  // key: "naive greedy cycle removal",
  algorithm: CycleRemovalBergerS1990a,
  phase: "cycle removal",

  summary: `"
    This algorithm implements a greedy heuristic of Berger and Shor for
    cycle removal. It is not really compared to the other heuristics and
    only included for demonstration purposes.
  "`,
  documentation: `"
    See section~4.1.1 of Pohlmann's Diploma theses for details.
  "`
 },

//-

"random greedy cycle removal": {
  // key: "random greedy cycle removal",
  algorithm: CycleRemovalBergerS1990b,
  phase: "cycle removal",

  summary: `"
    This algorithm implements a randomized greedy heuristic of Berger
    and Shor for cycle removal. It, too, is not really compared to
    the other heuristics and only included for demonstration purposes.
  "`,
  documentation: `"
    See section~4.1.1 of Pohlmann's Diploma theses for details.
  "`
 },
} as const

export default Declare
