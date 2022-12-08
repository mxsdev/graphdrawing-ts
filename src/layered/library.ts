import CycleRemoval from './cycle_removal'
import NodeRanking from './node_ranking'
import CrossingMin from './crossing_minimization'
import NodePositioning from './node_positioning'
import EdgeRouting from './edge_routing'
import Sugiyama from './Sugiyama'

const Declare = {
  ...CycleRemoval,
  ...NodeRanking,
  ...CrossingMin,
  ...NodePositioning,
  ...EdgeRouting,
  ...Sugiyama,
} as const

export default Declare
