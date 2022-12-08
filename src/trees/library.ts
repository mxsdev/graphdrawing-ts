import ChildSpec from './ChildSpec'
import ReingoldTilford from './ReingoldTilford1981'
import SpanningTreeComputation from './SpanningTreeComputation'

const Declare = {
  ...ChildSpec,
  ...ReingoldTilford,
  ...SpanningTreeComputation,
} as const

export default Declare
