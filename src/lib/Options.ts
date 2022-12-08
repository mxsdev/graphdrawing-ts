import assert from "assert";
import { ComponentOrderingFunction } from "../control/LayoutPipeline";
import { DefaultDeclarations, UnitType, UnitTypeMap } from "../interface/InterfaceCore";
import { DeclareTable } from "../interface/InterfaceToAlgorithms";
import { Collection } from "../model/Collection";
import { GraphAlgorithm } from "./Algorithm";
import { Declarations } from "./Declarations";
import { SpanningTree } from "./Types";

export function lookup_option    <
      Decl extends Declarations =
        typeof DefaultDeclarations,
      K extends Exclude<keyof GDOptions<Decl, {}>, 'algorithm_phases'> =
        Exclude<keyof GDOptions<Decl, {}>, 'algorithm_phases'>
    >
(option: K, ...objs: WithOptions<{}>[]): GDOptions<Decl, {}>[K] {
  for (const [i, o] of objs.entries()) {
    if (i === objs.length - 1) break

    if (o) {
      const v = o.option<Decl, K>(option, true)

      if (v) {
        return v
      }
    }
  }

  assert(objs.length > 0)
  return objs[objs.length - 1].option<Decl, K>(option)
}

type DeclarationAlgorithmPhase<D extends DeclareTable> = D extends { phase: infer R } ? R : never
type DeclarationsAlgorithmPhases<D extends Declarations> = DeclarationAlgorithmPhase<D[keyof D]>

type DetermineUnitType<D> = D extends { type: infer R } ? R extends UnitType ? UnitTypeMap[R] : any : any

type DeclarationOptionKeys<D extends Declarations, K extends keyof D = keyof D> = 
  K extends keyof D ? D[K] extends { algorithm: any } ? never : K : never

type DeclarationOptionKeysOpt<D extends Declarations, K extends keyof D = DeclarationOptionKeys<D>> =
  K extends keyof D ? D[K] extends { default: any }|{ initial: any } ?  never : K : never

type DeclarationOptionKeysReq<D extends Declarations, K extends keyof D = DeclarationOptionKeys<D>> =
  Exclude<K, DeclarationOptionKeysOpt<D>>

type DeclarationsToOptions<D extends Declarations> =
  // { [key in DeclarationOptionKeysOpt<D>]?: DetermineUnitType<D[key]> } &
  // { [key in DeclarationOptionKeysReq<D>]: DetermineUnitType<D[key]> } &
  { [ key in keyof D]: D[key] extends { algorithm: any } ? never : D[key] extends { type: any } ? 
    (D[key] extends { default: any }|{ initial: any} ? DetermineUnitType<D[key]> : DetermineUnitType<D[key]>|undefined) : never} &
  {
    algorithm_phases: {
      [key in DeclarationsAlgorithmPhases<D> extends string ? DeclarationsAlgorithmPhases<D> : never]?: GraphAlgorithm
    } & {
      [key in DeclarationsAlgorithmPhases<D> extends string ? DeclarationsAlgorithmPhases<D> : never as `${key} stack`]?: GraphAlgorithm[]
    }
  }

type t = DeclarationsToOptions<typeof DefaultDeclarations>
type t2 = t['sibling post sep']

type SpecialOptions = {
  'cut policy': 'as edge requests'|'all'|'none',
  'component order': ComponentOrderingFunction,
}

export type GDOptions<Decl extends Declarations, O> = O & Omit<DeclarationsToOptions<Decl & typeof DefaultDeclarations>, keyof SpecialOptions> & {
  algorithm_phases: {
    ["preprocessing stack"]: GraphAlgorithm[],
    ["edge routing stack"]: GraphAlgorithm[],
    ["postprocessing stack"]: GraphAlgorithm[],
    'main'?: GraphAlgorithm,
    'spanning tree computation'?: GraphAlgorithm<SpanningTree>,
  },
  collections: Collection[],
} & SpecialOptions

export interface WithOptions<O> {
  _options: O
  _options_proxy?: O

  option
    <
      Decl extends Declarations =
        typeof DefaultDeclarations,
      K extends keyof GDOptions<Decl, O> =
        keyof GDOptions<Decl, O>
    >
    (
      key: K,
      raw?: boolean
    ): GDOptions<Decl, O>[K]

  option_algorithm_phase
  <
    Decl extends Declarations =
      typeof DefaultDeclarations,
    K extends keyof GDOptions<Decl, O>['algorithm_phases'] =
      keyof GDOptions<Decl, O>['algorithm_phases']
  >
  (
    key: K,
    raw?: boolean
  ): GDOptions<Decl, O>['algorithm_phases'][K]

}

export const optFunc: <O>() => WithOptions<O>['option'] = 
  <O>() => 
    function<
      Decl extends Declarations = typeof DefaultDeclarations,
      K extends keyof GDOptions<Decl, O> = keyof GDOptions<Decl, O>
    >(this: WithOptions<O>, key: K, raw?: boolean): GDOptions<Decl, O>[K] {

    if(raw) return this._options[key as unknown as keyof O] as any
    return this._options[key as unknown as keyof O] ?? this._options_proxy?.[key as unknown as keyof O]  as any
}

export const algPhaseFunc: <O>() => WithOptions<O>['option_algorithm_phase'] = 
  <O>() => 
    function<
      Decl extends Declarations = typeof DefaultDeclarations,
      K extends keyof GDOptions<Decl, O>['algorithm_phases'] = keyof GDOptions<Decl, O>['algorithm_phases']
    >(this: WithOptions<O>, key: K, raw?: boolean): GDOptions<Decl, O>['algorithm_phases'][K] {

    // @ts-ignore
    if(raw) return this._options['algorithm_phases'][key] as any
    // @ts-ignore
    return this._options['algorithm_phases'][key] ?? this._options_proxy?.['algorithm_phases'][key] as any
}

