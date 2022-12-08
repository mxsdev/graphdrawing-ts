import assert from 'assert'
import { Storage } from './Storage'
import { EdgeDirection } from "../model/Edge"
import { Tuple } from "./Tuple"
import { Digraph } from '../model/Digraph'

export type Modify<T, Req extends keyof T = never, Opt extends keyof T = never> = Omit<T, Req|Opt> & Required<Pick<T, Req>> & Partial<Pick<T, Opt>> 

type ExpandPairs<T, S extends keyof T = keyof T> = S extends any ? [S, T[S]] : never

export type SpanPriorityOption = `span priority${' reversed'|''}${` ${EdgeDirection}`|''}`

export type Prime<T extends string> = `${T}${`'`|``}`

export type Primify<T> = { [key in keyof T as key extends string ? Prime<key> : never]: T[key] }

export type RandomSeed = number

export type SpanningTree = Digraph

export function pairs<T extends object>(obj: T) {
  return Object.entries(obj) as ExpandPairs<T>[]
}

export function removeEl<V>(arr: V[], val: V, errorIfNotFound: boolean = true) {
    const idx = arr.indexOf(val)
    if(errorIfNotFound) assert(idx > -1)

    arr.splice(idx, 1)

    return idx
  }

export function popEl<V>(arr: V[], val: V, errorIfNotFound: boolean = true) {
    const idx = arr.indexOf(val)
    if(errorIfNotFound) assert(idx > -1)

    const [ res ] = arr.splice(idx, 1)

    return res
}


export function find<T, R>(arr: Iterable<T>, predicate: (el: T) => R): [T, number, NonNullable<R>]|Tuple<undefined, 3> {
  let resEl: T|undefined = undefined
  let resVal: R|undefined = undefined
  let i = 0

  for(const el of arr) {
    resVal = predicate(el)

    if(resVal) {
      resEl = el
      break
    }

    i++
  }

  if(resEl != null && resVal != null) {
    return [resEl, i, resVal as NonNullable<R>]
  }
  
  return [ undefined, undefined, undefined ]
}

export function find_min<T, R>(arr: Iterable<T>, predicate: (el: T, i: number) => [R, number]|undefined): [T, number, R, number]|undefined {
  let best = Number.POSITIVE_INFINITY
  let best_result: R|undefined = undefined
  let best_index: number|undefined = undefined
  let best_el: T|undefined = undefined

  let i = 0
  for(const el of arr) {
    const pred = predicate(el, i)

    if(pred) {
      const [result, p] = pred

      if(p < best) {
        best = p
        best_result = result
        best_index = i
        best_el = el
      }
    }

    i++
  }

  if(best_result && best_index && best_el) {
    return [ best_el, best_index, best_result, best ]
  }
}

export function getOrSet<K extends object, V>(storage: Storage<K, V>, key: K, value: V){
  const val = storage.get(key)

  if(val) {
    return val
  } else {
    storage.set(key, value)
    return value
  }
} 

export function denull<T>(obj: T, msg?: string): NonNullable<T> {
  assert(obj != null, msg)
  return obj as NonNullable<T>
}
