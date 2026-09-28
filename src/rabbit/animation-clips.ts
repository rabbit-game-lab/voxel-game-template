/** Pure animation discovery and semantic matching, shared by assets/character.
 * Vendored SDK: configure animationMap in game data, never edit this module.
 * Names describe intent only when unambiguous; explicit mappings win.
 */
export interface AnimationClip {
  index: number
  /** Track name (not PlayCanvas's generated asset registration name). */
  name: string
  /** Unique playback key; duplicate/empty names receive an indexed key. */
  key: string
  duration: number
}
export type AnimationMap = Record<string, string | number | null>
export interface AnimationResolution {
  bindings: Record<string, string | null>
  ambiguous: Record<string, string[]>
  unused: string[]
}

/** Preserve all clips, including duplicate and unnamed tracks. */
export function describeClips(tracks: readonly { name: string; duration: number }[]): AnimationClip[] {
  const counts = new Map<string, number>()
  for (const track of tracks) counts.set(track.name, (counts.get(track.name) ?? 0) + 1)
  const reserved = new Set(tracks.map(track => track.name))
  return tracks.map((track, index) => {
    let key = track.name
    if (!key || counts.get(key)! > 1) {
      key = `clip_${index}`
      while (reserved.has(key)) key = '_' + key
      reserved.add(key)
    }
    return { index, name: track.name, key, duration: track.duration }
  })
}

export function selectClip(clips: readonly AnimationClip[], selector: string | number): AnimationClip {
  if (typeof selector === 'number') {
    const clip = Number.isInteger(selector) ? clips[selector] : undefined
    if (clip) return clip
  } else {
    const matches = clips.filter(clip => clip.name === selector)
    if (matches.length > 1) throw new Error(`animations: ambiguous clip "${selector}"; use its index`)
    const clip = matches[0] ?? clips.find(clip => clip.key === selector)
    if (clip) return clip
  }
  throw new Error(`animations: missing clip ${JSON.stringify(selector)}`)
}

const SYNONYMS: Record<string, readonly string[]> = {
  idle: ['idle', 'idles', 'stand', 'standing', 'breathing', 'rest', 'resting', 'wait', 'waiting'],
  walk: ['walk', 'walks', 'walking', 'move', 'moving', 'movement', 'step'],
  run: ['run', 'runs', 'running', 'sprint', 'sprinting', 'jog', 'jogging', 'dash'],
  jump: ['jump', 'jumps', 'jumping', 'leap', 'hop'],
  fall: ['fall', 'falls', 'falling', 'air', 'airborne', 'descend'],
  attack: ['attack', 'attacking', 'punch', 'strike'],
  death: ['death', 'die', 'dying'],
  hurt: ['hurt', 'hit', 'damage'],
  wave: ['wave', 'waving'],
}
function words(name: string): string[] {
  return name.slice(name.lastIndexOf('|') + 1)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
    .split(/[^a-z]+/).filter(Boolean)
}

/** Best unique candidate wins. Ties and mixed actions stay unresolved. */
export function resolveAnimationMap(
  names: readonly string[], overrides: Record<string, string | null> = {},
): AnimationResolution {
  const bindings: Record<string, string | null> = Object.create(null)
  const ambiguous: Record<string, string[]> = Object.create(null)
  for (const [state, value] of Object.entries(overrides)) {
    if (value !== null && !names.includes(value)) throw new Error(`animations: ${state} references disabled or missing clip "${value}"`)
    bindings[state] = value
  }
  const claimed = new Set(Object.values(bindings).filter(value => value !== null))
  for (const [state, synonyms] of Object.entries(SYNONYMS)) {
    if (Object.hasOwn(bindings, state)) continue
    const candidates = names.filter(name => !claimed.has(name)).map(name => {
      const tokens = words(name)
      const states = Object.entries(SYNONYMS).filter(([, aliases]) => tokens.some(token => aliases.includes(token)))
      if (states.length !== 1 || states[0][0] !== state) return { name, score: 0 }
      const pure = tokens.filter(token => !['cycle', 'loop', 'start'].includes(token))
      const bare = name.slice(name.lastIndexOf('|') + 1).toLowerCase()
      const score = bare === state ? 5 : synonyms.includes(bare) ? 4 : pure.length === 1 ? 3 : 1
      return { name, score: tokens.some(token => synonyms.includes(token)) ? score : 0 }
    })
    const best = Math.max(0, ...candidates.map(candidate => candidate.score))
    const matches = candidates.filter(candidate => best > 0 && candidate.score === best).map(candidate => candidate.name)
    bindings[state] = matches.length === 1 ? matches[0] : null
    if (matches.length === 1) claimed.add(matches[0])
    if (matches.length > 1) ambiguous[state] = matches
  }
  return { bindings, ambiguous, unused: names.filter(name => !claimed.has(name)) }
}
