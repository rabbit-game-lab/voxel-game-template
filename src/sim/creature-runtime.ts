import type { CreatureState } from '../creatures/types'

export interface RuntimeCreature extends CreatureState {
  directionX: number
  directionZ: number
  decisionRemaining: number
  attackRemaining: number
  /** Guardian only: index of the hostile creature being engaged, or -1. */
  targetIndex: number
  /** Guardian only: seconds spent trying to move without progress. */
  stuckTime: number
  airborne: boolean
  launchX: number
  launchY: number
  launchZ: number
}

export function isHostileCreature(item: CreatureState): boolean {
  return item.category === 'enemy' || item.behavior === 'chaser-melee' || item.behavior === 'territorial'
}

/** Horizontal distance between two creature/player positions. */
export function flatDistance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(b.x - a.x, b.z - a.z)
}
