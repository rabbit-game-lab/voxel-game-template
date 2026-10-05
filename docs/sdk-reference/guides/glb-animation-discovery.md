<!-- Generated from @rabbit-game-lab/sdk@1.0.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# Automatic GLB animation discovery

GLB files are the source of truth. No hand-maintained clip inventory, minimum
animation count, skeleton requirement, or platform registry is necessary.

## Discovery before and during play

After `rabbit-kit sync-check`, **every `npm run check` automatically inventories
the GLBs under `public/`**, including models not yet added to the asset manifest.
It prints clip indices, authored names, durations and skin counts. Invalid files
produce inspection warnings, distinct from a valid model with zero clips. This
inventory is advisory; it is not a full glTF validator or a playback test.

For structured output in a template, without a kit checkout or dependencies:

```sh
node scripts/models.mjs --json
node scripts/models.mjs public/assets/models/hero.glb --json
```

The kit also exposes `rabbit-kit inspect-model [file.glb|directory] --json`.
Omitting the path scans `public/`. Each result contains its current SHA-256,
clip indices, names (`null` when unnamed), timing and targeted property kinds.
Unknown duration is `null`, never zero. Each invocation reads current file bytes;
there is no persistent cache to invalidate when a model is replaced. An explicit
inspection command exits nonzero on unreadable/invalid files, retaining other
models and per-file errors in its JSON. Symlinks are not followed.

At runtime, `createAssets` discovers decoded tracks automatically, including
models loaded from external URLs. It uses `AnimTrack.name`, not PlayCanvas's
generated asset registration names such as `hero/animation/0`.

```ts
const assets = createAssets(app, {
  models: [{ key: 'hero', path: 'assets/models/hero.glb' }],
})
await assets.load()
console.log(assets.modelInfo('hero'))
// availableClips: [{ index, name, key, duration }, ...]
// enabledClips: the playback keys configured for this model
// animationMap: validated explicit semantic overrides
const hero = spawnCharacter(assets, 'hero')
console.log(hero.animations()) // bindings, ambiguous candidates, unused clips
hero.play('run')
```

Calling `modelInfo` before a successful load throws; an empty `availableClips`
array means the model was loaded and has no clips. `clipNames()` retains its
original meaning: enabled playback keys, not all clips in the file.

## Per-model semantic maps

Unambiguous names automatically bind `idle`, `walk`, `run`, `jump`, `fall`,
`attack`, `death`, `hurt` and `wave`. Names are tokenized across prefixes,
camelCase, separators and digits. Exact state names rank above synonyms and
variants. Mixed actions such as `Run_Attack` are not inferred; ties such as
`Walk_A`/`Walk_B` remain unresolved and are reported in `ambiguous`.

Specify only the exceptions or additional actions in the model's `animationMap`:

```ts
{
  key: 'hero', path: 'assets/models/hero.glb',
  animationMap: {
    idle: 'Breathing',
    run: 'Armature|Sprint',
    attack: 'Punch',
    dance: 7,       // zero-based index in this GLB, useful for opaque/duplicate names
    fall: null,    // deliberately disable this semantic state
  },
}
```

References must exist and be enabled. Duplicate authored names require an index;
they never silently pick the first track. Auto-discovery keeps every duplicate
or empty-named track under a unique playback key, visible in `availableClips`.
PlayCanvas's own fallback for a missing glTF name is `animation_<index>`.
Private engine state IDs keep dots and reserved words in authored names safe.

Instance options may override the model map with enabled playback keys:
`spawnCharacter(assets, 'hero', { animationMap: { run: 'Run_Hold' } })`.
Custom actions work with `play`, `has` and `clipFor`, just like locomotion.
`attack`, `death` and `hurt` default to one-shot playback; override with `loop`.
For repeated action events, call `hero.play('attack', { restart: true })`.

Missing or ambiguous states return `false`; no clip is invented or borrowed.
Unused clips remain available through `assets.playAnimation`. Automatic discovery
does not choose an arbitrary first clip when idle cannot be resolved. An explicit
legacy `clips` list still opts into first-clip resting, unless idle is explicitly
disabled by a null mapping. `state()` records the last requested state, not proof
that the renderer is playing it. Gameplay must still call `hero.play(state)` as
its state changes; discovery does not create movement or combat behavior.

## Static objects and selective enablement

`spawnObject` always stays static, even if its model contains animations. For an
animated door, prop or non-skinned character, use `assets.spawn/playAnimation` or
`spawnCharacter`. A skeleton and animation clips are independent capabilities.

- Omitted `animations` or `'auto'`: enable every discovered clip.
- `animations: false` or `{}`: retain the inventory but enable no clips.
- `animations: { resting: 'Idle', moving: 2 }`: enable only these tracks under
  those playback aliases. Model `animationMap` selectors still refer to the
  original clip name/index, and resolve to the enabled aliases.
- Instance `animate: false`, legacy `rigged: false`, or `clips: []`: static actor.

`switchCharacter` loads and validates the new model/map before replacing the
visual, then reapplies the requested state if supported. Mappings from the old
model do not leak into the new model. Invalid mappings, failed loads and
superseded requests retain the old actor. No rig retargeting is attempted.

## Migration and verification

This changes the default for previously omitted `animations`: clips are now
enabled. Audit deliberately static raw `assets.spawn` callers and use
`spawnObject`, `animate: false` or an explicit manifest opt-out. Invalid explicit
clip references now reject loading instead of silently warning. Semantic handles
accept custom state strings; `state()` consequently returns `string`.

Release this behavior with the kit's coordinated SDK API migration policy.
Sync **both SDK and checker from the same reviewed commit** into a template;
commit the generated provenance receipt with the vendored files. No published
template or existing Studio project changes until its normal update workflow.

Run `npm test` in the kit, then template `npm ci`, `npm run check`, `npm run build`
and the iframe harness. `node harness/features.mjs --screenshot <directory>`
additionally tests actual PlayCanvas parsing, automatic names, playback time and
node movement, plus internal/external replacement with semantic maps on a GPU.
