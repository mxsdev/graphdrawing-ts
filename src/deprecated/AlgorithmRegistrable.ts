import { OldGraph } from "./OldGraph"

// import { IOldGraphAlgorithm } from "../lib/Algorithm";
type IOldGraphAlgorithm = { graph: OldGraph }

// export type AlgorithmRecord = Record<string, never>
export type AlgorithmRegister<Record> = WeakMap<IOldGraphAlgorithm, Record>

export interface AlgorithmRegistrable<Record> {
  registerAlgorithm(algorithm: IOldGraphAlgorithm): void
  getAlgorithmRecord(algorithm: IOldGraphAlgorithm): Record|undefined
}
