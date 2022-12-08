import { WithOptions } from './Options'
import assert from "assert"

export type RandomGenerator = () => number

// https://stackoverflow.com/a/47593316
function sfc32(a: number, b: number, c: number, d: number): RandomGenerator {
  return function() {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
      let t = (a + b) | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = (c << 21 | c >>> 11);
      d = d + 1 | 0;
      t = t + d | 0;
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    }
}

function seededRandom(seed: number): RandomGenerator {
  assert(typeof seed === 'number', "Seed must be numeric")

  const rand = sfc32(0x9E3779B9, 0x243F6A88, 0xB7E15162, seed);
  for (var i = 0; i < 15; i++) rand();

  return rand
}

const BoringRandomGenerator: RandomGenerator = () => 0.5

export function getRandom(opt: WithOptions<{}>): RandomGenerator {
  if(opt.option('disable random')) {
    return BoringRandomGenerator
  }

  const seed = opt.option('random seed')
  return seededRandom(seed)
} 

export function randomBounded(random: RandomGenerator, l?: number, u?: number) {
  const r = random()

  if(u != null && l != null) {
    assert(l <= u)
    return Math.floor(r*(u-l+1)) + l
  } else if(l != null) {
    assert(1.0 <= l)
    return Math.floor(r*l) + 1 
  } else {
    return r
  }
}

export function randomPermutation(random: RandomGenerator, n: number) {
  const p: number[] = []

  for(let i = 0; i < n; i++) {
    p[i] = i
  }
  for(let i = 0; i <= n-2; i++) {
    const j = randomBounded(random, i, n-1)
    // NOTE: this is broken in the original, but is fixed here...
    const temp = p[i]
    p[i] = p[j]
    p[j] = temp
  }
  return p
}
