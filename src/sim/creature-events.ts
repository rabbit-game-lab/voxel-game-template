import type { CreatureSimEvent } from './creatures'
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
