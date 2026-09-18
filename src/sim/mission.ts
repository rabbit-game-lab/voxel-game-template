import type { CollectibleKey } from '../content/config'
import type { MissionCompletion, MissionConfig } from './mission-config'

export interface MissionSnapshot {
  active: true
  title: string
  current: number
  required: number
  completed: boolean
}

export interface MissionOutcome {
  title: string
  completion: MissionCompletion
}

export class MissionController {
  private current = 0
  private completed = false

  constructor(private readonly config: MissionConfig) {}

  reset(): void {
    this.current = 0; this.completed = false
  }

  evaluate(placedCrystals: number, collectibleCount: (key: CollectibleKey) => number): MissionOutcome | null {
    if (this.config.active === 'none') return null
    const definition = this.config.active === 'beacon'
      ? this.config.definitions.beacon : this.config.definitions.collect
    this.current = this.config.active === 'beacon'
      ? placedCrystals : collectibleCount(this.config.definitions.collect.item)
    const required = this.config.active === 'beacon'
      ? this.config.definitions.beacon.requiredCrystals : this.config.definitions.collect.required
    if (this.completed || this.current < required) return null
    this.completed = true
    return { title: definition.title, completion: definition.onComplete }
  }

  snapshot(): MissionSnapshot | null {
    if (this.config.active === 'none') return null
    const definition = this.config.active === 'beacon'
      ? this.config.definitions.beacon : this.config.definitions.collect
    return {
      active: true, title: definition.title, current: this.current,
      required: this.config.active === 'beacon'
        ? this.config.definitions.beacon.requiredCrystals : this.config.definitions.collect.required,
      completed: this.completed,
    }
  }
}
