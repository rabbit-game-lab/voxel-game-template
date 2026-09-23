/* =============================================================================
 * SDK MODULE: character — an imported GLB wired as a playable actor.
 * Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
 * ⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the options object
 * you pass to spawnCharacter(); if the module falls short, that is a kit change.
 * Kind: playcanvas-3d — sits on top of the `assets` module.
 * =============================================================================
 *
 * WHAT
 *   A model arrives with the clip names its author happened to use — "Armature|
 *   Sprint", "walk_cycle_01", "Idle". The game wants to say "run". This module
 *   is that translation, plus the two degenerate cases, so nobody hand-builds a
 *   PlayCanvas animation graph:
 *
 *     // src/data/assets.ts — 'auto' maps every clip under its own exact name,
 *     // so you never type a clip name and cannot typo one.
 *     const ASSETS = defineAssets({
 *       models: [{ key: 'hero', path: 'assets/models/hero.glb', animations: 'auto' }],
 *     })
 *
 *     const hero = spawnCharacter(assets, 'hero', {
 *       clips: ['Idle', 'Armature|Walk', 'Sprint'],   // exact names, or omit
 *       position: [0, 0, 0],
 *     })
 *     hero.play('run')            // -> "Sprint"
 *
 *     const rock = spawnObject(assets, 'rock')        // prop: no anim, no clips
 *
 *   It plugs straight into the `controller` module, whose states are a subset:
 *
 *     createController({ entity: hero.entity, ..., onStateChange: (s) => hero.play(s) })
 *
 * TYPICAL REQUESTS -> WHAT TO TOUCH
 *   "que el personaje camine"    -> nothing: play('walk') picks the walk clip.
 *   "no tiene animación de idle" -> it stays in the first clip you passed. The
 *                                  module never substitutes a clip that is not
 *                                  in the file.
 *   "es un objeto, no un perso"  -> spawnObject(). No anim component at all.
 *   "el modelo no está riggeado" -> rigged: false. It spawns as a plain actor;
 *                                  position and physics still work, play()
 *                                  returns false and the game does not branch.
 *   "que la transición sea suave"-> blendTime (seconds).
 *
 * NOTES
 *   - The sim still owns position, physics and state. This handle only mirrors:
 *     it never moves the entity, and play() is a render-side call.
 *   - handle.entity is the wrapper assets.spawn() returns — pass `parent` in the
 *     options if your template nests models under its own root.
 *   - Clip matching is exact-word first, then substring, and each clip is used
 *     for at most one state. Unmatched states resolve to null: no invention.
 * =============================================================================
 */
import type * as pc from 'playcanvas'
import type { AssetsHandle, SpawnOptions, ModelAsset } from './assets'
import type { LoadOptions } from './asset-source'

/** What the game asks for. The controller module's states are a subset. */
export type CharacterState = 'idle' | 'walk' | 'run' | 'jump' | 'fall'

const STATES: readonly CharacterState[] = ['idle', 'walk', 'run', 'jump', 'fall']

/**
 * Word -> state. Only words a model author would actually use; anything else
 * stays unmatched rather than being guessed into the wrong locomotion.
 */
const SYNONYMS: Readonly<Record<string, CharacterState>> = {
  idle: 'idle',
  idles: 'idle',
  stand: 'idle',
  standing: 'idle',
  tpose: 'idle',
  apose: 'idle',
  breathing: 'idle',
  rest: 'idle',
  resting: 'idle',
  wait: 'idle',
  waiting: 'idle',
  walk: 'walk',
  walks: 'walk',
  walking: 'walk',
  move: 'walk',
  moving: 'walk',
  movement: 'walk',
  step: 'walk',
  run: 'run',
  runs: 'run',
  running: 'run',
  sprint: 'run',
  sprinting: 'run',
  jog: 'run',
  jogging: 'run',
  dash: 'run',
  jump: 'jump',
  jumps: 'jump',
  jumping: 'jump',
  leap: 'jump',
  hop: 'jump',
  fall: 'fall',
  falls: 'fall',
  falling: 'fall',
  air: 'fall',
  airborne: 'fall',
  descend: 'fall',
}

/**
 * Exporters prefix clips with the armature ("Armature|Walk") and glue words
 * together in every style there is (walk_cycle, WalkCycle, walk-01). Reduce all
 * of that to lowercase words.
 */
function tokenize(clipName: string): string[] {
  const bare = clipName.slice(clipName.lastIndexOf('|') + 1)
  return bare
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0)
}

/**
 * Exact clip names from the GLB -> the state each one plays. Pure: no engine,
 * no side effects, so the kit tests cover it directly.
 *
 * A state with no matching clip is `null`. Callers must treat that as "this
 * character cannot do that" — never as "pick something close".
 */
export function resolveClips(clipNames: readonly string[]): Record<CharacterState, string | null> {
  const resolved: Record<CharacterState, string | null> = {
    idle: null,
    walk: null,
    run: null,
    jump: null,
    fall: null,
  }
  const used = new Set<string>()
  const tokens = new Map<string, string[]>()
  for (const name of clipNames) tokens.set(name, tokenize(name))

  // Pass 1: a whole word matches ("Armature|Run", "run_01"). Unambiguous.
  for (const state of STATES) {
    for (const name of clipNames) {
      if (used.has(name) || resolved[state]) continue
      const words = tokens.get(name) ?? []
      if (words.some((word) => SYNONYMS[word] === state)) {
        resolved[state] = name
        used.add(name)
      }
    }
  }

  // Pass 2: the word is glued into a longer one ("runcycle"). Weaker, so it
  // only fills states pass 1 left empty, and never reuses a claimed clip.
  for (const state of STATES) {
    if (resolved[state]) continue
    for (const name of clipNames) {
      if (used.has(name)) continue
      const joined = (tokens.get(name) ?? []).join('')
      const hit = Object.keys(SYNONYMS).some(
        (word) => SYNONYMS[word] === state && joined.includes(word)
      )
      if (hit) {
        resolved[state] = name
        used.add(name)
        break
      }
    }
  }

  return resolved
}

export interface CharacterOptions extends SpawnOptions {
  /**
   * The EXACT clip names from the model manifest. Omit to use whatever the
   * manifest's `animations` mapped; pass `[]` for a model that must not
   * animate.
   */
  clips?: readonly string[]
  /** false -> spawn as a plain actor with no anim component. */
  rigged?: boolean
  /** Seconds to blend between states. Omit for an instant cut. */
  blendTime?: number
}

export interface CharacterHandle {
  /** The wrapper entity from assets.spawn() — move and parent THIS. */
  entity: pc.Entity
  /** Plays the clip that means `state`. false when this model has no such clip. */
  play(state: CharacterState): boolean
  /** The last state asked for, animated or not. */
  state(): CharacterState
  /** The exact clip name behind a state, or null. */
  clipFor(state: CharacterState): string | null
  has(state: CharacterState): boolean
  /** Latest request wins. Failure keeps the old visual; physics/entity remain unchanged. */
  switchCharacter(source: string | ModelAsset, options?: CharacterSwitchOptions): Promise<boolean>
  destroy(): void
}

export interface CharacterSwitchOptions extends LoadOptions {
  clips?: readonly string[]
  rigged?: boolean
  blendTime?: number
  /** Visual adjustment relative to the stable actor, not a physics resize. */
  scale?: number | readonly [number, number, number]
  rotation?: readonly [number, number, number]
}

/**
 * Spawns an imported character. Three shapes, one call:
 *   - rigged with clips   -> anim wired, states resolved, resting clip played;
 *   - rigged with no idle -> rests in the first clip given;
 *   - unrigged / clips [] -> a plain actor: play() is a no-op returning false.
 */
export function spawnCharacter(
  assets: AssetsHandle,
  key: string,
  options: CharacterOptions = {}
): CharacterHandle {
  const { clips, rigged, ...spawnOptions } = options
  delete spawnOptions.blendTime
  let blendTime = options.blendTime

  // `clips: []` is a decision ("this must not animate"); omitting it is not, so
  // fall back to whatever the manifest actually mapped.
  let declared = clips === undefined ? assets.clipNames(key) : [...clips]
  let animated = rigged !== false && declared.length > 0

  const entity = assets.spawn(key, animated ? spawnOptions : { ...spawnOptions, animate: false })
  let resolved = resolveClips(animated ? declared : [])

  // With no idle clip the character still has to stand somewhere: the first
  // clip the caller listed. Never a clip that is not in the file.
  let resting = animated ? resolved.idle ?? declared[0] ?? null : null

  if (animated && assets.clipNames(key).length === 0) {
    console.warn(
      `character: "${key}" was given clips but its manifest maps none — ` +
        "add `animations: 'auto'` to its models entry so the clips get loaded."
    )
  }

  let current: CharacterState = 'idle'
  let revision = 0
  let destroyed = false

  function clipFor(state: CharacterState): string | null {
    if (!animated) return null
    return resolved[state] ?? (state === 'idle' ? resting : null)
  }

  function play(state: CharacterState): boolean {
    // The state is recorded even when there is no clip, so gameplay code can
    // read state() the same way for animated and unanimated characters.
    current = state
    const clip = clipFor(state)
    if (!clip) return false
    return assets.playAnimation(entity, clip, blendTime ? { blendTime } : undefined)
  }

  // A spawned rigged model stands in bind pose (arms out) until something
  // plays. Start it resting so nobody has to remember this.
  if (resting) play('idle')

  return {
    entity,
    play,
    state: () => current,
    clipFor,
    has: (state) => clipFor(state) !== null,
    async switchCharacter(source, next = {}) {
      if (destroyed) throw new Error('character: handle destroyed')
      const request = ++revision
      const nextKey = typeof source === 'string' ? source : source.key
      if (typeof source !== 'string') await assets.loadModel(source, next)
      if (destroyed || request !== revision || next.signal?.aborted) return false
      const nextClips = next.clips === undefined ? assets.clipNames(nextKey) : [...next.clips]
      const nextAnimated = next.rigged !== false && nextClips.length > 0
      assets.replaceModel(entity, nextKey, { scale: next.scale, rotation: next.rotation, animate: nextAnimated })
      declared = nextClips
      animated = nextAnimated
      resolved = resolveClips(animated ? declared : [])
      resting = animated ? resolved.idle ?? declared[0] ?? null : null
      blendTime = next.blendTime ?? blendTime
      play(current)
      return true
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      revision++
      entity.destroy()
    },
  }
}

/**
 * A static prop: instantiate and place it. No anim component, no clips, no
 * graph — the zero-cost path for `kind: "object"`.
 */
export function spawnObject(
  assets: AssetsHandle,
  key: string,
  options: SpawnOptions = {}
): pc.Entity {
  return assets.spawn(key, { ...options, animate: false })
}
