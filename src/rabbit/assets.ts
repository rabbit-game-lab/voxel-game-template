/** GLB, texture and audio assets. Canonical kit source; sync into templates. */
import * as pc from 'playcanvas'
import { abortable, assetUrl, type LoadOptions } from './asset-source'
import { requireReady } from './sdk'
export interface ModelAsset {
  key: string
  /** Local public path or an HTTP(S)/blob URL. External servers must permit CORS. */
  path: string
  animations?: Record<string, string> | 'auto'
  /** Critical by default. Optional assets may finish after ready. */
  required?: boolean
}
export interface FileAsset { key: string; path: string; required?: boolean }
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
  playAnimation(entity: pc.Entity, name: string, options?: { loop?: boolean; blendTime?: number }): boolean
  clipNames(key: string): string[]
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
  const models = new Map<string, { signature: string; promise: Promise<void> }>()
  const owned = new Set<pc.Asset>()
  const instances = new Set<pc.Entity>()
  const loopModes = new WeakMap<pc.Entity, Map<string, boolean>>()
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
      app.assets.remove(asset)
      asset.unload()
      // Engine requests cannot all be cancelled. Dispose a late decoded resource.
      void raw.then(() => asset.unload(), () => undefined)
      throw error
    })
    return { asset, promise }
  }

  function loadModel(model: ModelAsset, options: LoadOptions = {}): Promise<void> {
    assertAlive()
    const signature = JSON.stringify([assetUrl(model.path), model.animations ?? null])
    const prior = models.get(model.key)
    if (prior && prior.signature !== signature) return Promise.reject(new Error('assets: key already bound to another model: ' + model.key))
    if (prior) return abortable(prior.promise, options)
    const { asset, promise: downloaded } = loadAsset(model.key, 'container', model.path)
    containers.set(model.key, asset)
    const promise = downloaded.then(() => {
      assertAlive()
      const tracks = (asset.resource as GlbContainer | undefined)?.animations ?? []
      const mapped = new Map<string, pc.AnimTrack>()
      if (model.animations === 'auto') {
        for (const track of tracks) {
          const resource = track.resource as pc.AnimTrack
          const name = track.name || resource?.name
          if (name && resource) mapped.set(name, resource)
        }
      } else for (const [name, clipName] of Object.entries(model.animations ?? {})) {
        const track = tracks.find(track => track.name === clipName || (track.resource as pc.AnimTrack)?.name === clipName)
        if (track?.resource) mapped.set(name, track.resource as pc.AnimTrack)
        else console.warn('assets: missing clip ' + clipName + ' in ' + model.key)
      }
      clips.set(model.key, mapped)
    }).catch(error => { models.delete(model.key); containers.delete(model.key); throw error })
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
      for (const [name, track] of tracks) model.anim?.assignAnimation(name, track, undefined, 1, true)
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
  function playAnimation(entity: pc.Entity, name: string, options: { loop?: boolean; blendTime?: number } = {}): boolean {
    const record = spawned.get(entity)
    const track = record ? clips.get(record.key)?.get(name) : undefined
    const anim = record?.model.anim
    if (!anim?.baseLayer || !track) return false
    const modes = loopModes.get(record!.model) ?? new Map<string, boolean>()
    const loop = options.loop !== false
    if ((modes.get(name) ?? true) !== loop) anim.assignAnimation(name, track, undefined, 1, loop)
    modes.set(name, loop)
    loopModes.set(record!.model, modes)
    anim.playing = true
    if (anim.baseLayer.activeState !== name) {
      if (options.blendTime) anim.baseLayer.transition(name, options.blendTime)
      else anim.baseLayer.play(name)
    }
    return true
  }
  return {
    load, loadModel, spawn, replaceModel, playAnimation,
    trySpawn: (key, options) => containers.get(key)?.resource && !destroyed ? spawn(key, options) : null,
    clipNames: key => [...(clips.get(key)?.keys() ?? [])],
    texture: key => (textures.get(key)?.resource as pc.Texture | undefined) ?? null,
    audioUrl: key => audioUrls.get(key) ?? null,
    destroy() {
      if (destroyed) return
      destroyed = true
      lifetime.abort()
      for (const entity of [...instances]) if (instances.has(entity)) entity.destroy()
      for (const asset of owned) { app.assets.remove(asset); asset.unload() }
      owned.clear(); instances.clear(); containers.clear(); textures.clear(); clips.clear(); audioUrls.clear(); models.clear()
    },
  }
}
