# Runtime, assets and character replacement (0.8.0)

The SDK remains vendored per stack. Sync both groups from the same reviewed kit
commit, then run `rabbit-kit status --check --json`, the template checker, build
and iframe verification. `.rabbit-kit.json` records the version, Git commit,
whether that source was dirty, and normalized SHA-256 hashes for each group.
The local checker rejects drift against this receipt; strict CLI status also
compares against the kit checkout. A receipt is provenance, not a signature or
a replacement for reviewing and trusting the source commit.

## Shared lifecycle

`sdk.runtime` is the single coordinator for all common modules. Incoming host
messages retain Contract v1 names and require the parent as sender and boolean
pause/mute payloads. `sdk.init()` now returns a disposer and replaces its previous
handlers. Its pause/mute callbacks receive **effective** state, including local
pause reasons. Existing `createPause()` consumers automatically participate.

```ts
const dialog = Symbol('settings dialog')
sdk.runtime.setPaused(dialog, true)
sdk.runtime.setPaused(dialog, false) // cannot lift another owner's pause
const off = sdk.runtime.subscribe(({ paused }) => { app.timeScale = paused ? 0 : 1 })
off()
```

Remove each reason on teardown. Use a symbol for each owner. Per-input
`setPaused` and `sound.setPaused` compose with runtime pause. Local sound mute
also composes with host mute. `audio.register(context, allowed?)` returns an
unregister function; a gesture cannot resume paused contexts. `observeResize`
returns disconnect. Pair handles with the application/scene lifetime that owns
them. `ready` remains once per document; restarting gameplay does not resend it.

## Required and optional assets

Manifest entries default to `required: true`; mark decoration or fallback art
`required: false`. Phaser `loadAssets(scene, manifest)` returns a promise and
tracks required preload failures. PlayCanvas `assets.load()` is idempotent,
waits for required resources and lets optional resources finish in the background.
Missing models throw on `spawn`; `trySpawn` returns null for optional content.
Loads time out after 30 seconds. `loadModel` supports local paths and HTTP(S) or
blob URLs; external origins must allow CORS. Unsupported protocols are rejected.
An asset key cannot silently change its URL: select a new key for a new resource.

Register all critical work before the first rendered frame requests ready:

```ts
const ready = sdk.requireReady(assets.load().then(() => {
  // Required resources are loaded; build the playable scene here.
  hero = spawnCharacter(assets, 'hero')
}))
return { ready, restart, setMuted, destroy }
```

The boot adapter must track the game's `ready` promise as well: resource loading
alone does not prove scene construction succeeded. A failed critical task emits
`rabbit:error` and prevents `rabbit:ready`. `load({ critical: false })` is for
post-boot work; dynamic character replacement never changes an already completed
handshake. Caller aborts/timeouts stop that caller's wait; shared cached loads can
continue for other consumers. Destroying the assets handle aborts its lifetime,
destroys its owned instances and unloads its registrations, including late loads.

## Pointer lock

For a game that keeps a local resume screen paused until capture completes,
use `allowWhileLocallyPaused: true`. A host pause always denies or releases
capture, including when the effective pause was already true. Runtime snapshots
include `hostPaused` so focus coordinators can distinguish that transition
without installing another message listener.

```ts
const pointer = createPointerLock(canvas, { onChange: updateCursorHint })
canvas.addEventListener('pointerdown', () => { void pointer.request() })
// Use pointer.locked() for relative movement; retain drag/touch while unlocked.
// On application teardown: pointer.destroy()
```

Request directly in a user gesture. `request()` resolves true only after the
browser reports the lock; unsupported, denied, timed-out and paused requests
resolve false. Escape, blur and shared pause release the lock. Recapture needs
another gesture. Declare `embed.pointerLock: true` in authored manifests and
delegate `allow-pointer-lock` in the host iframe. The adapter cannot grant a
permission withheld by the embedding page.

## PlayCanvas character switching

```ts
const hero = spawnCharacter(assets, 'hero', { scale: 1 })
hero.play('run')
await hero.switchCharacter('anotherLoadedModel')
await hero.switchCharacter({
  key: 'visitor', path: 'https://assets.example.org/visitor.glb', animations: 'auto',
}, { scale: 0.8, rotation: [0, 180, 0] })
```

`hero.entity` stays the same entity. Position, orientation, gameplay components,
tags, camera/controller references and physics stay attached to it. Only the
owned visual subtree is replaced after a successful load. The latest requested
semantic animation state is applied to the new model if available. No skeleton
retargeting or missing animation synthesis is performed. Explicit empty clips
or `rigged: false` suppress the animation component.

Replacement scale/rotation are visual adjustments relative to the stable actor.
They do not resize the collider. A missing/failed asset rejects and keeps the old
visual; a superseded/aborted-before-commit request returns false. Latest request
wins. Use `hero.destroy()` to cancel pending application of a swap and destroy
the actor; `assets.destroy()` owns cached model resources. Cached models remain
available for other actors until their asset handle is destroyed.

## Phaser character switching

```ts
const hero = createCharacter(playerSprite, { animations: { run: 'hero.run' } })
await hero.switchCharacter('anotherLoadedTexture')
await hero.switchCharacter({
  key: 'visitor', path: 'https://assets.example.org/visitor.png',
  frameWidth: 32, frameHeight: 48,
  animations: { run: { frames: [0, 1, 2, 3], repeat: -1 } },
})
hero.play('run')
```

Omit frame dimensions for a single image. Internal atlas textures can be selected
with a frame; external atlas JSON loading stays in the asset manifest loader.
The adapter preserves the sprite, display dimensions, origin and Arcade body's
world dimensions/offset, velocity and other gameplay state. Animation mappings
switch to the new character's declared names. The game owns the sprite and the
Phaser texture cache; adapter destroy detaches its listeners and prevents pending
swaps, but does not remove a texture that other sprites may be using. Scene
shutdown also invalidates pending swaps.

## Verification

`npm test` covers real-engine TypeScript, lifecycle composition, input aggregation,
storage, readiness, pointer lock, loaders, provenance and switching races/failure.
`npm run test:browser -- --screenshot <directory>` exercises internal/external
assets on real Phaser and PlayCanvas, retained actor/body, failed replacements
and pause. It starts an isolated CORS asset server and records GPU screenshots.
Set `CHROME_PATH` when Chrome is elsewhere. Fixtures contain authored geometric
characters; this does not certify arbitrary external rigs or every game design.
