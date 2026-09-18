# Procedural content and missions

`CONFIG.content` is the public catalog of procedural assets. An AI can select archetypes and adjust counts, colors, scales, or zones while the planner, batching, and lifecycle remain internal.

## Changing the preset

Full forest:

```ts
content: {
  preset: 'forest',
  presets: { /* keep forest and minimal */ },
  limits: { /* keep budgets */ },
}
```

Lightweight version:

```ts
content: { preset: 'minimal', /* keep definitions */ }
```

Presets are complete definitions. There are no hidden overrides or merges.

## Trees and props

- `trees.oak`, `pine`, and `deadTree` control whether each archetype is enabled, its count, spacing, height range, and allowed zones.
- Trees, fallen logs, ruins, and overlooks become editable voxel blocks before meshing.
- Bushes, flowers, reeds, rocks, signposts, and the campfire are merged by category and have no collision. Their lightweight interaction bounds allow them to be broken without creating one entity per prop.
- `zones` accepts `spawn-meadow`, `forest`, `shore`, `highland`, and `coast`.
- `color` uses six-digit hex values; `scale` and `height` are ascending ranges.

AI recipes:

- “I want more pine trees”: increase `content.presets.forest.trees.pine.count` without exceeding `limits.maxTrees`.
- “Remove all trees”: set `enabled: false` for all three species while keeping the remaining values valid.
- “Make the flowers blue”: change only `scatter.flowers.color`.
- “Add another place to discover”: add a landmark with a unique `id`, archetype, center, and label.

## Collectibles and discoveries

`apple` and `mushroom` are merged visual objects kept separate from the block inventory. They are collected automatically within `pickupRadius`, never enter the hotbar, and respawn only after a restart.

Apples are placed near oak trees. Mushrooms use reachable forest ground. A `collect` mission deterministically adds any missing units needed to satisfy `required`.

Landmarks and the lake emit a toast once per session when `discoveries.enabled` is active. Restart clears discoveries; respawn preserves them.

## Decoration interaction

`content.interaction.breakableDecorations` lets the center ray select and break merged decorations. `removeUnsupportedDecorations` removes an active decoration when its exact supporting voxel becomes non-solid. Both default to `true`.

Decoration state uses one bitset for the current content plan. A direct break plays the normal break feedback; support removal silently clears the prop alongside the block edit. Removed decorations stay removed across respawn when world edits are preserved and return on restart. This behavior does not add colliders, per-instance entities, materials, or draw calls.

## Choosing a mission

Sandbox:

```ts
mission: { active: 'none', definitions: { /* keep definitions */ } }
```

Classic beacon:

```ts
mission: { active: 'beacon', definitions: { /* keep definitions */ } }
```

Collection mission:

```ts
collect: {
  title: 'Forest Collector',
  item: 'apple',
  required: 8,
  onComplete: 'victory',
}
```

Changing `onComplete` to `continue` celebrates once and keeps the sandbox active. Only one mission is active per session.

## Extending the catalog

A new archetype must declare a typed key, generate deterministic placements, and select one of two backends:

- `voxel`: a solid, editable structure applied before chunks are created.
- `merged-mesh`: a merged visual prop with no entity or material per instance.

Do not expose paths, PlayCanvas internals, algorithms, or factories in `game.config.ts`. Keep the total below six additional draw calls, and update validation, documentation, and the local skill.
