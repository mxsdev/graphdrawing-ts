import ControlDeclare from './ControlDeclare'
import ControlStart from './ControlStart'
import ControlIteration from './ControlIteration'
import ControlSprings from './ControlSprings'
import ControlElectric from './ControlElectric'
import ControlCoarsening from './ControlCoarsening'

// import SpringLayouts from "./SpringLayouts"
// import SpringElectricalLayouts from "./SpringElectricalLayouts"

import SpringHu2006 from './SpringHu2006'
// import SpringElectricalHu2006 from './SpringElectricalHu2006'
// import SpringElectricalWalshaw2000 from './SpringElectricalWalshaw2000'

const Declare = {
  ...ControlDeclare,
  ...ControlStart,
  ...ControlIteration,
  ...ControlSprings,
  ...ControlElectric,
  ...ControlCoarsening,
  ...SpringHu2006,
} as const

export default Declare
