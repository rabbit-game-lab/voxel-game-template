# Creature configuration

`CONFIG.creatures` is the only public tuning surface for animals, enemies, and NPC-style characters. Species internals live in the catalog; presets only decide what appears and how it is distributed.

## Presets

- `empty`: no creatures and zero creature draw calls.
- `peacefulForest`: the default; horses, chickens, sheep, a pig, a dog, and a raccoon.
- `forestAdventure`: the peaceful population plus a wolf, slimes, skeleton, goblin, and zombie.

Switch the entire population with one edit:

```ts
creatures: {
  preset: 'forestAdventure',
  // keep the existing presets, combat, simulation and limits
}
```

Every preset is complete. There are no implicit merges between presets.

## Groups

Each group contains:

- `species`: a key from the built-in catalog.
- `count`: deterministic population for the selected seed.
- `behavior`: optional override; omission uses the catalog default.
- `zones`: allowed world zones.
- `scale`: visual and gameplay scale in the supported `[0.5, 2]` range.
- `minSpacing`: minimum spawn distance from every other creature.
- `roamRadius`: maximum ordinary wandering distance from its spawn.

Example: add three villagers without changing simulation code:

```ts
{
  species: 'villager',
  count: 3,
  zones: ['spawn-meadow', 'forest'],
  scale: 1,
  minSpacing: 4,
  roamRadius: 8,
}
```

Example: make a pony from the horse asset:

```ts
{
  species: 'horse',
  count: 1,
  zones: ['spawn-meadow'],
  scale: 0.75,
  minSpacing: 4,
  roamRadius: 6,
}
```

## Behavior and combat

Available behavior keys are `grazer`, `wanderer`, `skittish`, `companion`, `territorial`, `chaser-melee`, `stationary`, and `npc-wander`.

Enemy and territorial behavior only damages the player when `combat.enabled` is true. Friendly animals reject attacks by default through `animalsDamageable: false`. Primary action attacks a targeted damageable creature; otherwise it retains the existing block/decor break behavior.

`playerMaxHealth`, damage, and attack cooldowns are validated before boot. Health appears only when the active population contains enemies.

## Performance and lifecycle

AI decisions run at `decisionHz`; movement stays in the fixed simulation step. Creatures beyond `sleepDistance` stop updating until the player returns. The delivered limits allow at most 16 active creatures, six enemies, and 20 creature draw calls.

Spawn planning is deterministic for `world.seed`. Creatures avoid water, steep steps, solid body cells, the immediate spawn clearing, and non-grass surfaces. Pause freezes simulation and rendering. Restart regenerates the initial population without recreating materials or meshes; ordinary respawn preserves the current population unless the world itself is regenerated.
