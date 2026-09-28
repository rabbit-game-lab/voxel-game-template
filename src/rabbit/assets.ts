/** GLB, texture and audio assets. Canonical kit source; sync into templates.
 * GLB clips are discovered by default. Inspect modelInfo(key) after load for
 * available vs enabled clips; declare animationMap only to override semantics.
 * Before runtime, npm run check inventories GLBs under public/ automatically;
 * node scripts/models.mjs --json returns current metadata without an engine.
 */
import * as pc from 'playcanvas'
import { abortable, assetUrl, type LoadOptions } from './asset-source'
import { requireReady } from './sdk'
import { describeClips, selectClip, type AnimationClip, type AnimationMap } from './animation-clips'
export interface ModelAsset {
  key: string
  /** Local public path or an HTTP(S)/blob URL. External servers must permit CORS. */
  path: string
  /** Omitted/'auto': discover every clip. false/{}: explicitly disable clips. */
  animations?: Record<string, string | number> | 'auto' | false
  /** Semantic state -> real clip name/index; null disables that state. */
  animationMap?: AnimationMap
  /** Critical by default. Optional assets may finish after ready. */
  required?: boolean
}
export interface FileAsset { key: string; path: string; required?: boolean }
export interface ModelInfo {
  key: string
  path: string
  availableClips: AnimationClip[]
  enabledClips: string[]
  /** Validated semantic overrides, resolved to enabled playback keys. */
  animationMap: Record<string, string | null>
}
export interface AssetManifest {
  models?: readonly ModelAsset[]
  textures?: readonly FileAsset[]
  audio?: readonly FileAsset[]
}
export interface SpawnOptions {
  position?: readonly [number, number, number]
  rotation?: readonly [number, number, number]
  scale?: number | readonly [number, number, number]
  normalizeHeight?: number
  parent?: pc.Entity
  name?: string
  /** False for a static object or a deliberately unanimated character. */
  animate?: boolean
}
export interface AssetsHandle {
  load(options?: LoadOptions): Promise<void>
  loadModel(model: ModelAsset, options?: LoadOptions): Promise<void>
  spawn(key: string, options?: SpawnOptions): pc.Entity
  trySpawn(key: string, options?: SpawnOptions): pc.Entity | null
  /** Replaces only the owned visual child, preserving actor identity and components. */
  replaceModel(entity: pc.Entity, key: string, options?: Omit<SpawnOptions, 'parent' | 'position' | 'name'>): void
  playAnimation(entity: pc.Entity, name: string, options?: { loop?: boolean; blendTime?: number; restart?: boolean }): boolean
  clipNames(key: string): string[]
  /** Throws before load/after failure; an empty inventory means a loaded static model. */
  modelInfo(key: string): ModelInfo
  texture(key: string): pc.Texture | null
  audioUrl(key: string): string | null
  destroy(): void
}
interface GlbContainer extends pc.ContainerResource { animations: pc.Asset[] }
export function defineAssets<T extends AssetManifest>(manifest: T): T { return manifest }

export function createAssets(app: pc.Application, manifest: AssetManifest): AssetsHandle {
  const containers = new Map<string, pc.Asset>()
  const textures = new Map<string, pc.Asset>()
  const audioUrls = new Map<string, string>()
  const clips = new Map<string, Map<string, pc.AnimTrack>>()
  const inventories = new Map<string, ModelInfo>()
  const models = new Map<string, { signature: string; promise: Promise<void> }>()
  const owned = new Set<pc.Asset>()
  const instances = new Set<pc.Entity>()
  const loopModes = new WeakMap<pc.Entity, Map<string, boolean>>()
  const stateKeys = new WeakMap<pc.Entity, Map<string, string>>()
  const spawned = new WeakMap<pc.Entity, { key: string; model: pc.Entity; visual: pc.Entity }>()
  const lifetime = new AbortController()
  let destroyed = false
  let loading: Promise<void> | undefined
  function assertAlive(): void { if (destroyed) throw new Error('assets: handle destroyed') }

  function loadAsset(name: string, type: 'container' | 'texture', path: string): { asset: pc.Asset; promise: Promise<void> } {
    assertAlive()
    const asset = new pc.Asset(name, type, { url: assetUrl(path) })
    owned.add(asset)
    app.assets.add(asset)
    const raw = new Promise<void>((resolve, reject) => {
      const loaded = () => { asset.off('error', failed); resolve() }
      const failed = (error: unknown) => { asset.off('load', loaded); reject(new Error(name + ': ' + String(error))) }
      asset.once('load', loaded)
      asset.once('error', failed)
      app.assets.load(asset)
    })
    const promise = abortable(raw, { signal: lifetime.signal }).catch(error => {
      if (owned.delete(asset)) { app.assets.remove(asset); asset.unload() }
      // Engine requests cannot all be cancelled. Dispose a late decoded resource.
      void raw.then(() => asset.unload(), () => undefined)
      throw error
    })
    return { asset, promise }
  }

  function loadModel(model: ModelAsset, options: LoadOptions = {}): Promise<void> {
    assertAlive()
    const signature = JSON.stringify([assetUrl(model.path), model.animations ?? 'auto', model.animationMap ?? null])
    const prior = models.get(model.key)
    if (prior && prior.signature !== signature) return Promise.reject(new Error('assets: key already bound to another model: ' + model.key))
    if (prior) return abortable(prior.promise, options)
    const { asset, promise: downloaded } = loadAsset(model.key, 'container', model.path)
    containers.set(model.key, asset)
    const promise = downloaded.then(() => {
      assertAlive()
      const tracks = (asset.resource as GlbContainer | undefined)?.animations ?? []
      // Asset.name is e.g. hero/animation/0; AnimTrack.name is the authored Idle/Run.
      const availableClips = describeClips(tracks.map(track => {
        const resource = track.resource as pc.AnimTrack | undefined
        if (!resource) throw new Error('assets: animation resource unavailable in ' + model.key)
        return { name: resource.name, duration: resource.duration }
      }))
      const mapped = new Map<string, pc.AnimTrack>()
      const enabledIndices = new Map<number, string>()
      const enable = (name: string, index: number) => {
        if (!name) throw new Error('assets: empty animation playback key in ' + model.key)
        mapped.set(name, tracks[index].resource as pc.AnimTrack)
        if (!enabledIndices.has(index)) enabledIndices.set(index, name)
      }
      if (model.animations === undefined || model.animations === 'auto') {
        for (const clip of availableClips) enable(clip.key, clip.index)
      } else for (const [name, selector] of Object.entries(model.animations || {})) {
        enable(name, selectClip(availableClips, selector).index)
      }
      const animationMap: Record<string, string | null> = Object.create(null)
      for (const [state, selector] of Object.entries(model.animationMap ?? {})) {
        if (selector === null) { animationMap[state] = null; continue }
        const clip = selectClip(availableClips, selector)
        const enabled = enabledIndices.get(clip.index)
        if (!enabled) throw new Error(`assets: ${model.key}.${state} references disabled clip "${clip.name}"`)
        animationMap[state] = enabled
      }
      clips.set(model.key, mapped)
      inventories.set(model.key, { key: model.key, path: model.path, availableClips, enabledClips: [...mapped.keys()], animationMap })
    }).catch(error => {
      models.delete(model.key); containers.delete(model.key); clips.delete(model.key); inventories.delete(model.key)
      if (owned.delete(asset)) { app.assets.remove(asset); asset.unload() }
      throw error
    })
    models.set(model.key, { signature, promise })
    return abortable(promise, options)
  }

  function load(options: LoadOptions = {}): Promise<void> {
    assertAlive()
    if (!loading) {
      const required: Promise<void>[] = []
      const queue = (work: Promise<void>, critical = true) => {
        if (critical) required.push(work)
        else void work.catch(error => console.warn('assets: optional resource unavailable', error))
      }
      for (const model of manifest.models ?? []) queue(loadModel(model), model.required !== false)
      for (const texture of manifest.textures ?? []) {
        const { asset, promise } = loadAsset(texture.key, 'texture', texture.path)
        textures.set(texture.key, asset)
        queue(promise, texture.required !== false)
      }
      for (const audio of manifest.audio ?? []) {
        const url = assetUrl(audio.path)
        const work = abortable(fetch(url, { signal: lifetime.signal }).then(async response => {
          if (!response.ok) throw new Error('assets: audio HTTP ' + response.status + ': ' + audio.key)
          await response.arrayBuffer()
          assertAlive()
          audioUrls.set(audio.key, url)
        }), { signal: lifetime.signal })
        queue(work, audio.required !== false)
      }
      loading = Promise.all(required).then(() => undefined)
      if (options.critical !== false) loading = requireReady(loading)
    }
    return abortable(loading, options)
  }

  function spawn(key: string, options: SpawnOptions = {}): pc.Entity {
    assertAlive()
    const resource = containers.get(key)?.resource as pc.ContainerResource | undefined
    if (!resource) throw new Error('assets: model not loaded: ' + key + '; await load() or loadModel()')
    const model = resource.instantiateRenderEntity()
    const entity = new pc.Entity(options.name ?? key)
    entity.addChild(model)
    if (options.position) entity.setLocalPosition(...options.position)
    if (options.rotation) entity.setLocalEulerAngles(...options.rotation)
    if (typeof options.scale === 'number') entity.setLocalScale(options.scale, options.scale, options.scale)
    else if (options.scale) entity.setLocalScale(...options.scale)
    ;(options.parent ?? app.root).addChild(entity)
    if (options.normalizeHeight) {
      const renders = model.findComponents('render') as pc.RenderComponent[]
      if (renders.some(render => render.meshInstances.some(instance => instance.skinInstance))) {
        console.warn('assets: normalizeHeight is unsupported on skinned models; use explicit scale')
      } else {
        const box = new pc.BoundingBox()
        let initialized = false
        for (const render of renders) for (const instance of render.meshInstances) {
          if (!initialized) { box.copy(instance.aabb); initialized = true } else box.add(instance.aabb)
        }
        if (initialized && box.halfExtents.y > 0) {
          const factor = options.normalizeHeight / (box.halfExtents.y * 2)
          const scale = entity.getLocalScale()
          entity.setLocalScale(scale.x * factor, scale.y * factor, scale.z * factor)
        }
      }
    }
    const tracks = clips.get(key)
    if (options.animate !== false && tracks?.size) {
      model.addComponent('anim', { activate: false })
      const states = new Map<string, string>()
      for (const [name, track] of tracks) {
        // Dots and START/END/ANY have special meaning to PlayCanvas state paths.
        // Public clip keys stay authored; private state IDs are always safe.
        const state = `clip_${states.size}`
        states.set(name, state)
        model.anim?.assignAnimation(state, track, undefined, 1, true)
      }
      stateKeys.set(model, states)
    }
    spawned.set(entity, { key, model, visual: model })
    instances.add(entity)
    entity.once('destroy', () => instances.delete(entity))
    return entity
  }
  function replaceModel(entity: pc.Entity, key: string, options: Omit<SpawnOptions, 'parent' | 'position' | 'name'> = {}): void {
    const old = spawned.get(entity)
    if (!old || !instances.has(entity)) throw new Error('assets: actor is not owned by this handle')
    const replacement = spawn(key, { ...options, parent: entity })
    const next = spawned.get(replacement)!
    spawned.set(entity, { key, model: next.model, visual: replacement })
    old.visual.destroy()
  }
  function playAnimation(entity: pc.Entity, name: string, options: { loop?: boolean; blendTime?: number; restart?: boolean } = {}): boolean {
    const record = spawned.get(entity)
    const track = record ? clips.get(record.key)?.get(name) : undefined
    const anim = record?.model.anim
    const state = record ? stateKeys.get(record.model)?.get(name) : undefined
    if (!anim?.baseLayer || !track || !state) return false
    const modes = loopModes.get(record!.model) ?? new Map<string, boolean>()
    const loop = options.loop !== false
    if ((modes.get(name) ?? true) !== loop) anim.assignAnimation(state, track, undefined, 1, loop)
    modes.set(name, loop)
    loopModes.set(record!.model, modes)
    anim.playing = true
    if (options.restart || anim.baseLayer.activeState !== state) {
      if (options.blendTime && !options.restart) anim.baseLayer.transition(state, options.blendTime)
      else anim.baseLayer.play(state)
    }
    return true
  }
  return {
    load, loadModel, spawn, replaceModel, playAnimation,
    trySpawn: (key, options) => containers.get(key)?.resource && !destroyed ? spawn(key, options) : null,
    clipNames: key => [...(clips.get(key)?.keys() ?? [])],
    modelInfo(key) {
      assertAlive()
      const info = inventories.get(key)
      if (!info) throw new Error('assets: model not loaded: ' + key + '; await load() or loadModel()')
      return { ...info, availableClips: info.availableClips.map(clip => ({ ...clip })),
        enabledClips: [...info.enabledClips], animationMap: { ...info.animationMap } }
    },
    texture: key => (textures.get(key)?.resource as pc.Texture | undefined) ?? null,
    audioUrl: key => audioUrls.get(key) ?? null,
    destroy() {
      if (destroyed) return
      destroyed = true
      lifetime.abort()
      for (const entity of [...instances]) if (instances.has(entity)) entity.destroy()
      for (const asset of owned) { app.assets.remove(asset); asset.unload() }
      owned.clear(); instances.clear(); containers.clear(); textures.clear(); clips.clear(); inventories.clear(); audioUrls.clear(); models.clear()
    },
  }
}
