import assert from 'assert'
import { Scope } from "./Scope";

export class ScopeManager {
  private stack: Scope[] = []

  topScope(): Scope {
    assert(this.stack.length !== 0, "scope stack empty")
    const top = this.stack[this.stack.length - 1]

    return top
  }
} 
