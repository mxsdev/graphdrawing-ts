export type MappedC<A, B> = {
    [K in keyof A & keyof B]:
    A[K] extends B[K]
      ? never
      : K
  }

export type OptionalKeys<T> = MappedC<T, Required<T>>[keyof T];
export type RequiredKeys<T> = Exclude<keyof T, OptionalKeys<T>>

export type UnionToIntersection<U> = 
(U extends any ? (k: U)=>void : never) extends ((k: infer I)=>void) ? I : never

type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N ? R : _TupleOf<T, N, [T, ...R]>;
export type Tuple<T, N extends number> = N extends N ? number extends N ? T[] : _TupleOf<T, N, []> : never;

export type Modify<T, Req extends keyof T = never, Opt extends keyof T = never> = Omit<T, Req|Opt> & Required<Pick<T, Req>> & Partial<Pick<T, Opt>> 
export type Extend<T, E> = Omit<T, keyof E> & E 
export type RequiredExcept<T, E extends keyof T> = Required<Omit<T, E>> & Pick<T, E>

export type ExpandObject<
    T extends object,
    Key extends string = 'key',
    Value extends string = 'value',
    S extends keyof T = keyof T
  > = S extends string ? {
    [key in Key|Value]: key extends Key ? S : T[S];
  } : never 
