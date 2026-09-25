import type { CreatureSimEvent, CreatureSimulation } from './creatures'
import type { GameEvent } from './types'

export interface CreatureEventOutcome {
  events: GameEvent[]
  notice: string | null
  seconds: number
}

/** Maps creature-vs-creature fights (the Iron Golem guardian) onto session events and HUD notices. */
export function creatureEventOutcome(event: CreatureSimEvent): CreatureEventOutcome {
  const defeated = event.type === 'guardianDown' || event.defeated
  const events: GameEvent[] = [
    { type: 'sound', sound: defeated ? 'creatureDefeat' : 'creatureHit' },
    { type: 'creature', index: event.index, action: defeated ? 'defeat' : 'hit', position: event.position },
  ]
  if (event.type === 'guardianDown') return { events, notice: `${event.guardian} cayó en combate`, seconds: 2 }
  if (event.defeated) return { events, notice: `${event.guardian} derrotó a ${event.target}`, seconds: 1.4 }
  return { events, notice: null, seconds: 0 }
}

/** Player melee on a targeted creature: damage, sounds, particles and the HUD notice. */
export function playerAttackOutcome(creatures: CreatureSimulation, index: number, damage: number): CreatureEventOutcome {
  const state = creatures.states()[index]
  const result = creatures.damage(index, damage)
  if (!result.accepted) {
    return { events: [{ type: 'sound', sound: 'invalid' }], notice: `${result.label} es amistoso`, seconds: 1.2 }
  }
  return {
    events: [
      { type: 'sound', sound: result.defeated ? 'creatureDefeat' : 'creatureHit' },
      {
        type: 'creature', index, action: result.defeated ? 'defeat' : 'hit',
        position: { x: state.x, y: state.y + 0.5, z: state.z },
      },
    ],
    notice: result.defeated ? `${result.label} derrotado` : `Golpeaste a ${result.label}`,
    seconds: 1.1,
  }
}
