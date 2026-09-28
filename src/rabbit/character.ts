/**
 * SDK MODULE: character — imported GLB actors with automatic animation discovery.
 * Canonical kit source. Templates configure options, never patch this file.
 * Composition module: assets owns loading/animation components; this module
 * translates gameplay states. Position, physics and gameplay remain in the sim.
 *
 * Typical use (no clip list or animations:'auto' required):
 *   models: [{ key: 'hero', path: 'assets/models/hero.glb' }]
 *   await assets.load()
 *   const hero = spawnCharacter(assets, 'hero')
 *   hero.play('run')
 *   createController({ ..., onStateChange: state => hero.play(state) })
 *
 * Inspect assets.modelInfo('hero') for available vs enabled clips, and
 * hero.animations() for resolved states, ambiguous candidates and unused clips.
 * Declare animationMap on the model to override names or bind extra actions:
 *   animationMap: { idle: 'Breathing', attack: 'Punch', dance: 3, fall: null }
 * Instance animationMap overrides use enabled playback keys (or null).
 * Missing/ambiguous states return false. Automatic discovery never picks an
 * arbitrary resting clip. An explicit clips list preserves its first-clip rest
 * fallback, unless animationMap.idle is explicitly null.
 *
 * Static actors: animate:false, rigged:false (legacy), or clips:[] suppress anim.
 * Animated objects do not require a skeleton. spawnObject is explicitly static;
 * use assets.spawn/playAnimation for an animated prop. Never build a state graph.
 */
import type * as pc from 'playcanvas'
import type { AssetsHandle, SpawnOptions, ModelAsset } from './assets'
import type { LoadOptions } from './asset-source'
import { resolveAnimationMap, type AnimationResolution } from './animation-clips'

/** Locomotion states used by the controller; handles also accept custom actions. */
export type CharacterState = 'idle' | 'walk' | 'run' | 'jump' | 'fall'
const STATES: readonly CharacterState[] = ['idle', 'walk', 'run', 'jump', 'fall']

/** Compatibility helper with the original five-state shape. */
export function resolveClips(names: readonly string[]): Record<CharacterState, string | null> {
  const { bindings } = resolveAnimationMap(names)
  return Object.fromEntries(STATES.map(state => [state, bindings[state]])) as Record<CharacterState, string | null>
}

interface AnimationOptions {
  /** Enabled playback keys. Omit to discover; [] explicitly disables animation. */
  clips?: readonly string[]
  /** Legacy explicit opt-out; animation discovery does not require a skeleton. */
  rigged?: boolean
  animate?: boolean
  blendTime?: number
  /** Per-instance override of the model's semantic map; null disables a state. */
  animationMap?: Record<string, string | null>
}
export interface CharacterOptions extends SpawnOptions, AnimationOptions {}
export interface CharacterSwitchOptions extends LoadOptions, AnimationOptions {
  /** Relative visual adjustment, not a physics resize. */
  scale?: number | readonly [number, number, number]
  rotation?: readonly [number, number, number]
}
export interface CharacterHandle {
  /** Stable wrapper — move, parent and attach physics to THIS entity. */
  entity: pc.Entity
  play(state: string, options?: { loop?: boolean; restart?: boolean }): boolean
  /** Last requested state, not proof that a clip is currently playing. */
  state(): string
  clipFor(state: string): string | null
  has(state: string): boolean
  animations(): AnimationResolution
  /** Latest request wins; failed loads or invalid mappings retain the old visual. */
  switchCharacter(source: string | ModelAsset, options?: CharacterSwitchOptions): Promise<boolean>
  destroy(): void
}

function configure(assets: AssetsHandle, key: string, options: AnimationOptions) {
  const available = assets.clipNames(key)
  const declared = options.clips === undefined ? available : [...options.clips]
  for (const name of declared) {
    if (!available.includes(name)) throw new Error(`character: ${key} has no enabled clip "${name}"`)
  }
  const animated = options.animate !== false && options.rigged !== false && declared.length > 0
  const overrides = { ...assets.modelInfo(key).animationMap, ...options.animationMap }
  const resolution = resolveAnimationMap(animated ? declared : [], animated ? overrides : {})
  // Only an authored clips list opts into the legacy resting fallback.
  if (animated && options.clips?.length && !Object.hasOwn(overrides, 'idle') && !resolution.bindings.idle) {
    resolution.bindings.idle = declared[0]
    resolution.unused = resolution.unused.filter(name => name !== declared[0])
  }
  return { animated, resolution }
}

export function spawnCharacter(assets: AssetsHandle, key: string, options: CharacterOptions = {}): CharacterHandle {
  const { clips: _clips, rigged: _rigged, animationMap: _map, blendTime: _blend, ...spawnOptions } = options
  let config = configure(assets, key, options)
  let blendTime = options.blendTime
  const entity = assets.spawn(key, config.animated ? spawnOptions : { ...spawnOptions, animate: false })
  let current = 'idle'
  let currentOptions: { loop?: boolean; restart?: boolean } | undefined
  let revision = 0
  let destroyed = false

  function clipFor(state: string): string | null { return config.resolution.bindings[state] ?? null }
  function play(state: string, playback?: { loop?: boolean; restart?: boolean }): boolean {
    current = state
    currentOptions = playback
    const clip = clipFor(state)
    if (destroyed || !clip) return false
    const opts = { ...(blendTime ? { blendTime } : {}), ...playback }
    if (opts.loop === undefined && ['attack', 'death', 'hurt'].includes(state)) opts.loop = false
    return assets.playAnimation(entity, clip, Object.keys(opts).length ? opts : undefined)
  }
  if (clipFor('idle')) play('idle')

  return {
    entity, play, state: () => current, clipFor,
    has: state => clipFor(state) !== null,
    animations: () => ({ bindings: { ...config.resolution.bindings },
      ambiguous: Object.fromEntries(Object.entries(config.resolution.ambiguous).map(([state, names]) => [state, [...names]])),
      unused: [...config.resolution.unused] }),
    async switchCharacter(source, next = {}) {
      if (destroyed) throw new Error('character: handle destroyed')
      const request = ++revision
      const nextKey = typeof source === 'string' ? source : source.key
      if (typeof source !== 'string') await assets.loadModel(source, next)
      if (destroyed || request !== revision || next.signal?.aborted) return false
      const nextConfig = configure(assets, nextKey, next)
      assets.replaceModel(entity, nextKey, { scale: next.scale, rotation: next.rotation, animate: nextConfig.animated })
      config = nextConfig
      blendTime = next.blendTime ?? blendTime
      play(current, currentOptions)
      return true
    },
    destroy() { if (!destroyed) { destroyed = true; revision++; entity.destroy() } },
  }
}

/** Static prop, even if the GLB contains clips. */
export function spawnObject(assets: AssetsHandle, key: string, options: SpawnOptions = {}): pc.Entity {
  return assets.spawn(key, { ...options, animate: false })
}
