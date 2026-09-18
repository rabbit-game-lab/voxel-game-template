# Configurable environment

`CONFIG.environment` in `src/game.config.ts` is the environment's only public contract. An AI can change presets without knowing PlayCanvas, the mesher, or the Rabbit lifecycle. Validation fails before boot if a value exceeds a limit or a lake overlaps protected landmarks.

## Sky and visual time of day

The system provides two coordinated presets, `day` and `night`. It does not simulate the passage of time: switching modes activates resources that already exist and updates the sky, sun or moon, stars, light, fog, clouds, terrain, and water without regenerating chunks.

To make the game always start at night:

```ts
sky: {
  initialMode: 'night',
  showToggleButton: false,
  presets: { /* keep day and night */ },
  stars: { /* keep a valid configuration */ },
}
```

`initialMode` is the only change required for requests such as “make the game take place at night.” `showToggleButton: false` removes the temporary button without disabling the system. When set to `true`, the moon/sun button appears next to Pause during gameplay.

Each preset includes:

- `zenith`, `horizon`, `ambient`, and `fogColor` for the atmosphere.
- `fogStart/fogEnd` for visibility.
- `celestialColor`, `celestialEuler`, and `celestialScale` for the sun or moon.
- `lightColor/lightIntensity` for directional lighting.
- `cloudColor`, `worldTint`, and `waterTint` so the rest of the scene matches the mode.

Stars are generated once using `count`, `seedOffset`, `color`, and `size`, and are rendered only at night. The limit is 96.

### AI recipes

- “Make it always nighttime”: change only `initialMode` to `night`.
- “Remove the day/night button”: change only `showToggleButton` to `false`.
- “Make the night darker”: adjust the `night` preset, especially `zenith`, `horizon`, `worldTint`, and `fogColor`.
- “Create a sunset”: modify the `day` preset with a warm horizon, a low celestial body, and coordinated fog.
- “I want more stars”: increase `stars.count` without exceeding 96; do not create one entity per star.

Always use six-digit hex colors. Keep `fogStart < fogEnd`, with the end value below or near `camera.farClip`.

## Moving or adding lakes

Each lake is defined as follows:

```ts
{
  id: 'north-pond',
  center: [12, 8, 13],
  radius: [5, 4],
  shoreWidth: 2,
  edgeNoise: 0.12,
}
```

`center[1]` is the water voxel's Y coordinate; its surface is rendered at `y + 1 - surfaceInset`. Choose a stable `id` because it participates in deterministic deformation. The entire shore must fit within the world and remain separate from the spawn, plateau, beacon, sockets, and crystals. To create multiple lakes, add objects to `water.lakes`; the generator, water restoration, and decorations detect them automatically.

## Disabling features

Change only the corresponding `enabled` value:

```ts
clouds: { enabled: false, ... },
water: { enabled: false, ... },
decorations: {
  particles: { enabled: false, ... },
},
ambience: { enabled: false, ... },
```

Values are still validated when a feature is disabled so that re-enabling it remains safe. Disabled water is neither generated nor considered by movement. Reeds, rocks, flowers, and bushes are configured in `CONFIG.content`.

## Density and performance budget

- Clouds: up to 16 across all layers; each layer costs one draw call.
- Particles: up to 24 within one fixed-capacity system.
- Water: one shared material and at most one additional draw call per chunk containing liquid faces.

For a mobile preset, reduce particles and clouds first, then use `content.preset: 'minimal'`. Do not create entities per prop or materials per lake.

## Minimal preset

To keep only the sky and terrain:

```ts
clouds: { enabled: false, seedOffset: 7001, layers: [] },
water: { enabled: false, /* keep valid colors/ranges */ lakes: [] },
decorations: {
  particles: { enabled: false, count: 0, color: '#e8e58c' },
},
ambience: { enabled: false, volume: 0, waterInterval: [5, 9], windInterval: [8, 14] },
```

## Extending the system

A new feature internally implements `update`, `reset`, `setPaused`, `setTimeOfDay`, `destroy`, and `stats`, then registers itself in `FEATURE_FACTORIES`. Only its typed, validated configuration is exposed in `game.config.ts`; the main loop remains unchanged. Keep geometry merged, capacity fixed, generation deterministic by seed, and resources reusable across restarts.
