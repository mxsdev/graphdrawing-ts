import assert from "assert";
import { AbstractGraphAlgorithm, GraphAlgorithm } from "../lib/Algorithm";
import { Declarations } from "../lib/Declarations";
import { Event, EventKind, EventParams } from "../lib/Event";
import { Coordinate, ICoordinate } from "../model/Coordinate";
import { IBinding } from "./IBinding";
import { DeclareTable, QualifiedDeclareTable } from "./InterfaceToAlgorithms";
import { Scope } from "./Scope";
import ControlDeclarations from "../control/library"
import ModelDeclarations from "../model/library"

export const DefaultDeclarations = {
  ...ControlDeclarations,
  ...ModelDeclarations,
} as const

export type UnitTypeMap = {
  number: number,
  length: number,
  time: number,
  string: string,
  'canvas coordinate': ICoordinate,
  coordinate: ICoordinate,
  boolean: boolean,
  raw: any,
  direction: number,
  nil: undefined,
}

export type UnitType = keyof UnitTypeMap

const UnitTypeReg = /([\d.]+)(.*)/

type ConvertRes<T, K extends UnitType> = (T extends string ? UnitTypeMap[K] : T)

export class InterfaceCore {
  keys: Record<string, QualifiedDeclareTable> = { }

  option_aliases: Record<string, any> = {}
  algorithm_classes: Record<string, GraphAlgorithm> = {}
  option_initial: Record<string, any> = {
    algorithm_phases: {
      ["preprocessing stack"]: [],
      ["edge routing stack"]: [],
      ["postprocessing stack"]: [],
    }
  }
  option_stack: any[] = [] 
  option_cache_height?: number

  private scopes: Scope[] = []

  collection_kinds: Map<string, {kind: string, layer: number}> = new Map()

  binding?: IBinding

  constructor() { }

  topScope(): Scope { 
    const ts = this.scopes[this.scopes.length - 1]
    assert(ts, "no graph drawing scope open")

    return ts
  }

  pushScope(scope: Scope) {
    this.scopes.push(scope)
  }

  popScope() {
    assert(this.scopes.length > 0, "no gd scope open")
    return this.scopes.pop()
  } 

  private static factors = {
    cm: 28.45274,
    mm: 2.84526,
    pt: 1.0,
    bp: 1.00374,
    sp: 0.00002,
    pc: 12.0,
    em: 10,
    ex: 4.30554,
    ["in"]: 72.27,
    dd: 1.07,
    cc: 12.8401,
    [""]: 1,
  }

  private static time_factors = {
    s: 1,
    ms: 0.001,
    min: 60,
    h: 3600
  }

  private static directions = {
    down: -90,
    up: 90,
    left: 180,
    right: 0,
    south: -90,
    north: 90,
    west: 180,
    east: 0,
    ["north east"]: 45,
    ["north west"]: 135,
    ["south east"]: -45,
    ["south west"]: -135,
    ["-"]: 0,
    ["|"]: -90,
  }

  createEvent<K extends EventKind>(kind: K, param: EventParams[K], scope?: Scope): Event<K> {
    scope = scope ?? this.topScope()

    const n = scope.events.length 
    const e = new Event({ kind, parameters: param, index: n })
    scope.events.push(e)

    return e
  }

  static convert(s: any, t?: string): any {
    if(typeof s !== 'string') {
      return s 
    } else {
      switch(t) {
        case "number": {
          return Number(s) 
        }

        case "boolean": {
          return s.toLowerCase() === "true"
        }

        case "length": {
          const [ _, num, dim ] = UnitTypeReg.exec(s) ?? []

          const fac = InterfaceCore.factors[dim as keyof typeof InterfaceCore.factors]

          assert(fac, "unknown unit")

          return Number(num) * fac
        }

        case "time": {
          const [ _, num, dim ] = UnitTypeReg.exec(s) ?? []

          const fac = InterfaceCore.time_factors[dim as keyof typeof InterfaceCore.time_factors]

          assert(fac, "unknown time unit")

          return Number(num) * fac 
        }

        case "string": {
          return s 
        }

        case "canvas coordinate":
        case "coordinate": {
          const [ _, x, y ] = /\(([\d.]+)pt,([\d.]+)pt\)/.exec(s) ?? []

          assert(x, "invalid coordinate")
          assert(y, "invalid coordinate")

          return new Coordinate(Number(x), Number(y)) 
        }

        case "raw": {
          return eval(s)
        }
        
        case "direction": {
          return (InterfaceCore.directions[s as keyof typeof InterfaceCore.directions] ?? Number(s))
        }

        case "nil":
        case undefined: {
          return undefined 
        }

        default: {
          throw new Error("unknown parameter type")
        }
      }
    }
  }
}
