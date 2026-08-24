/* =============================================================================
 * SDK MODULE: assets — GLB models (animated or not), textures and audio.
 * Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
 * ⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the manifest your
 * game code declares; if the module falls short, that is a kit change.
 * Kind: playcanvas-3d — PlayCanvas asset registry, containers and anim.
 * =============================================================================
 *
 * WHAT
 *   Loading a .glb in PlayCanvas engine-only is the step everyone gets wrong
 *   (container asset → render entity → animations as separate assets). This
 *   module is that flow, declared once and awaited once:
 *
 *     const ASSETS = defineAssets({
 *       models: [
 *         { key: 'tree',  path: 'assets/tree.glb' },              // static prop
 *         { key: 'hero',  path: 'assets/hero.glb',                // animated
 *           animations: { idle: 'Idle', run: 'Run', jump: 'Jump' } },
 *       ],
 *       textures: [{ key: 'grass', path: 'assets/grass.png' }],
 *       audio: [{ key: 'coin', path: 'assets/coin.mp3' }],
 *     })
 *
 *     const assets = createAssets(app, ASSETS)
 *     await assets.load()                       // once, before the game starts
 *
 *     const tree = assets.spawn('tree', { position: [0, 0, -5], scale: 2 })
 *     const hero = assets.spawn('hero')         // anim component already wired
 *     assets.playAnimation(hero, 'run')         // by the name you declared
 *
 * TYPICAL REQUESTS → WHAT TO TOUCH
 *   "ponele un modelo 3D"        → drop the .glb in public/assets/ and add a
 *                                  models entry. spawn() puts it in the scene.
 *   "que corra la animación"     → the `animations` map: your name → the clip
 *                                  name inside the GLB. Wrong name? load()
 *                                  logs the clips the file actually contains.
 *   "que aparezcan varios"       → spawn() as many times as you want: each call
 *                                  is an independent instance.
 *   "es gigante / está de lado"  → scale and rotation in the spawn options.
 *                                  scale is RELATIVE to how the file was
 *                                  authored: 1 = untouched. The model's own
 *                                  root transform is preserved (exporters put
 *                                  unit conversions there — Blender ships an
 *                                  "Armature" root scaled 0.01), so you never
 *                                  compensate for units by hand.
 *                                  normalizeHeight forces a height in metres,
 *                                  but only for props: a rigged model is posed
 *                                  by its skeleton, so measuring it at spawn
 *                                  time is meaningless and the module warns.
 *   "no se mueve / brazos en T"  → playAnimation(entity, name). The clip only
 *                                  ticks once it is played; a spawned model
 *                                  sits in bind pose until then.
 *   "sonido al saltar"           → audio entries load as ArrayBuffers for the
 *                                  `sound` SDK module (WebAudio, mute-aware).
 *   "personaje importado"        → animations: 'auto' here, then spawnCharacter()
 *                                  from the `character` module: it maps the
 *                                  clips to idle/walk/run/jump for you.
 *
 * NOTES
 *   - spawn() returns a WRAPPER entity with the model inside it. Move, rotate
 *     and scale the wrapper (that is what you get back); the model keeps the
 *     transform the file was authored with. The anim component lives on the
 *     model, so always go through playAnimation() instead of entity.anim.
 *   - GLB paths are relative to public/, with NO leading slash.
 *   - load() resolves when everything is ready; failures reject with the list
 *     of files that failed, so a typo is visible instead of a silent white scene.
 *   - Static props (no `animations`) get no anim component: zero cost.
 *   - `animations: 'auto'` maps every clip in the file under its own name, so
 *     you never type a clip name. clipNames(key) tells you what came back.
 * =============================================================================
 */
import * as pc from 'playcanvas'

/** What a loaded .glb container actually exposes at runtime. */
interface GlbContainer extends pc.ContainerResource {
  animations: pc.Asset[]
}

export interface ModelAsset {
  key: string
  /** Path relative to public/, no leading slash (e.g. 'assets/hero.glb'). */
  path: string
  /**
   * Your animation name → the clip name inside the GLB, or 'auto' to map every
   * clip the file contains under its own exact name. Omit for static props.
   * 'auto' is what an imported character wants: you never type a clip name, so
   * you cannot typo one that does not exist.
   */
  animations?: Record<string, string> | 'auto'
}

export interface FileAsset {
  key: string
  path: string
}

export interface AssetManifest {
  models?: readonly ModelAsset[]
  textures?: readonly FileAsset[]
  audio?: readonly FileAsset[]
}

export interface SpawnOptions {
  position?: readonly [number, number, number]
  /** Euler angles in degrees. */
  rotation?: readonly [number, number, number]
  /** Uniform scale, or per-axis. Default 1. */
  scale?: number | readonly [number, number, number]
  /** Rescale the model so its bounding box is this tall, in metres. */
  normalizeHeight?: number
  /** Parent entity. Default: app.root. */
  parent?: pc.Entity
  name?: string
}

export interface AssetsHandle {
  /** Loads everything in the manifest. Await it before starting the game. */
  load(): Promise<void>
  /** Instantiates a model. Call after load(). */
  spawn(key: string, options?: SpawnOptions): pc.Entity
  /** Plays a declared animation on a spawned entity. Returns false if unknown. */
  playAnimation(entity: pc.Entity, name: string, options?: { loop?: boolean; blendTime?: number }): boolean
  /** The animation names actually mapped for a model. Empty for static props. */
  clipNames(key: string): string[]
  /** A loaded texture, for materials built by game code. */
  texture(key: string): pc.Texture | null
  /** URL of a loaded audio file — hand it to the `sound` module's load(). */
  audioUrl(key: string): string | null
  destroy(): void
}

/** Identity helper: gives you autocompletion and type errors in the manifest. */
export function defineAssets<T extends AssetManifest>(manifest: T): T {
  return manifest
}

export function createAssets(app: pc.Application, manifest: AssetManifest): AssetsHandle {
  const containers = new Map<string, pc.Asset>()
  const textures = new Map<string, pc.Asset>()
  const audioUrls = new Map<string, string>()
  /** key → (your animation name → clip track). Filled after load(). */
  const clips = new Map<string, Map<string, pc.AnimTrack>>()
  /** Spawned wrapper → its model key and the GLB root that owns the anim. */
  const spawned = new WeakMap<pc.Entity, { key: string; model: pc.Entity }>()

  /** The asset types this module loads (pc.Asset's type is a literal union). */
  type AssetType = 'container' | 'texture'

  function addAsset(name: string, type: AssetType, url: string): pc.Asset {
    const asset = new pc.Asset(name, type, { url })
    app.assets.add(asset)
    return asset
  }

  function loadAsset(asset: pc.Asset): Promise<void> {
    return new Promise((resolve, reject) => {
      asset.ready(() => resolve())
      asset.once('error', (error: string) => reject(new Error(`${asset.name}: ${error}`)))
      app.assets.load(asset)
    })
  }

  async function load(): Promise<void> {
    const pending: Promise<void>[] = []

    for (const model of manifest.models ?? []) {
      const asset = addAsset(model.key, 'container', model.path)
      containers.set(model.key, asset)
      pending.push(loadAsset(asset))
    }
    for (const texture of manifest.textures ?? []) {
      const asset = addAsset(texture.key, 'texture', texture.path)
      textures.set(texture.key, asset)
      pending.push(loadAsset(asset))
    }
    for (const audio of manifest.audio ?? []) {
      audioUrls.set(audio.key, audio.path)
    }

    const results = await Promise.allSettled(pending)
    const failed = results.filter((result) => result.status === 'rejected')
    if (failed.length > 0) {
      const reasons = failed.map((result) => String((result as PromiseRejectedResult).reason))
      throw new Error(`assets: failed to load — ${reasons.join('; ')}`)
    }

    // Map declared animation names to the tracks inside each container.
    for (const model of manifest.models ?? []) {
      if (!model.animations) continue
      // The GLB container resource carries its clips as animation assets; the
      // engine types only describe the base ContainerResource, hence the cast.
      const container = containers.get(model.key)?.resource as GlbContainer | undefined
      const tracks = container?.animations ?? []
      const byName = new Map<string, pc.AnimTrack>()

      if (model.animations === 'auto') {
        // Every clip under its own name. The engine exposes the name on the
        // wrapper asset for some exporters and on the track for others, hence
        // the same double probe the declared path uses below.
        for (const track of tracks) {
          const name = track.name ?? (track.resource as pc.AnimTrack | undefined)?.name
          if (name) byName.set(name, track.resource as pc.AnimTrack)
        }
        clips.set(model.key, byName)
        continue
      }

      for (const [declared, clipName] of Object.entries(model.animations)) {
        const match = tracks.find(
          (track) => track.name === clipName || (track.resource as pc.AnimTrack | undefined)?.name === clipName
        )
        if (match) byName.set(declared, match.resource as pc.AnimTrack)
        else {
          const available = tracks.map((track) => track.name).join(', ') || '(none)'
          console.warn(`assets: "${model.key}" has no clip "${clipName}" — available: ${available}`)
        }
      }
      clips.set(model.key, byName)
    }
  }

  function spawn(key: string, options: SpawnOptions = {}): pc.Entity {
    const container = containers.get(key)
    if (!container?.resource) {
      console.warn(`assets: model "${key}" is not loaded — did you await load()?`)
      return new pc.Entity(options.name ?? key)
    }

    const resource = container.resource as pc.ContainerResource
    const model = resource.instantiateRenderEntity()

    // The model goes INSIDE a wrapper and the options are applied to the
    // wrapper. Writing them on the model itself would overwrite the transform
    // authored in the file — and exporters routinely put a unit conversion
    // there (Blender ships an "Armature" root scaled 0.01, cm→m), so a spawn
    // with any scale would silently resize the character by 100x.
    const entity = new pc.Entity(options.name ?? key)
    entity.addChild(model)

    if (options.position) entity.setLocalPosition(...options.position)
    if (options.rotation) entity.setLocalEulerAngles(...options.rotation)
    if (typeof options.scale === 'number') entity.setLocalScale(options.scale, options.scale, options.scale)
    else if (options.scale) entity.setLocalScale(...options.scale)

    ;(options.parent ?? app.root).addChild(entity)

    if (options.normalizeHeight) {
      if (isSkinned(model)) {
        // A rigged mesh is not where its bind-pose box says it is: the skin
        // poses it from the joints, so measuring at spawn time gives a number
        // that has nothing to do with what gets drawn.
        console.warn(
          `assets: "${key}" is rigged — normalizeHeight does not work on skinned models. ` +
            'Set an explicit scale instead (1 = the size the file was authored at).'
        )
      } else {
        const height = boundingHeight(model)
        if (height > 0) {
          const factor = options.normalizeHeight / height
          const current = entity.getLocalScale()
          entity.setLocalScale(current.x * factor, current.y * factor, current.z * factor)
        }
      }
    }

    const tracks = clips.get(key)
    if (tracks && tracks.size > 0) {
      // The anim component belongs on the model root, where the bone names it
      // binds to live — not on the wrapper.
      model.addComponent('anim', { activate: false })
      for (const [name, track] of tracks) {
        // Component-level assign: the base layer does not exist until the first
        // assignment creates it. Loop defaults to true; playAnimation({ loop:
        // false }) reassigns the state.
        model.anim?.assignAnimation(name, track, undefined, 1, true)
      }
      spawned.set(entity, { key, model })
    }
    return entity
  }

  function isSkinned(entity: pc.Entity): boolean {
    const renders = entity.findComponents('render') as pc.RenderComponent[]
    return renders.some((render) => render.meshInstances.some((instance) => instance.skinInstance))
  }

  function boundingHeight(entity: pc.Entity): number {
    const renders = entity.findComponents('render') as pc.RenderComponent[]
    if (renders.length === 0) return 0
    const aabb = new pc.BoundingBox()
    let initialized = false
    for (const render of renders) {
      for (const instance of render.meshInstances) {
        if (!initialized) {
          aabb.copy(instance.aabb)
          initialized = true
        } else aabb.add(instance.aabb)
      }
    }
    return initialized ? aabb.halfExtents.y * 2 : 0
  }

  function playAnimation(
    entity: pc.Entity,
    name: string,
    animOptions: { loop?: boolean; blendTime?: number } = {}
  ): boolean {
    const spawn = spawned.get(entity)
    const track = spawn ? clips.get(spawn.key)?.get(name) : undefined
    const anim = spawn?.model.anim
    const layer = anim?.baseLayer
    if (!anim || !layer || !track) {
      console.warn(`assets: no animation "${name}" on this entity — check the animations map`)
      return false
    }

    if (animOptions.loop === false) anim.assignAnimation(name, track, undefined, 1, false)

    // The component is created with activate:false so it does not auto-play the
    // first clip assigned; that also leaves `playing` false, and the engine
    // only ticks components whose `playing` is true. Without this line the
    // layer sits in the right state, frozen in bind pose.
    anim.playing = true

    if (layer.activeState === name) return true
    if (animOptions.blendTime) layer.transition(name, animOptions.blendTime)
    else layer.play(name)
    return true
  }

  return {
    load,
    spawn,
    playAnimation,
    clipNames: (key) => [...(clips.get(key)?.keys() ?? [])],
    texture: (key) => (textures.get(key)?.resource as pc.Texture | undefined) ?? null,
    audioUrl: (key) => audioUrls.get(key) ?? null,
    destroy() {
      for (const asset of [...containers.values(), ...textures.values()]) {
        app.assets.remove(asset)
        asset.unload()
      }
      containers.clear()
      textures.clear()
      clips.clear()
      audioUrls.clear()
    },
  }
}
