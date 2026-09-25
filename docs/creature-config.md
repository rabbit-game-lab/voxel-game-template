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

Available behavior keys are `grazer`, `wanderer`, `skittish`, `companion`, `territorial`, `chaser-melee`, `stationary`, `npc-wander`, and `guardian`.

Enemy and territorial behavior only damages the player when `combat.enabled` is true. Friendly animals reject attacks by default through `animalsDamageable: false`. Primary action attacks a targeted damageable creature; otherwise it retains the existing block/decor break behavior.

### Guardian (Iron Golem)

The Iron Golem companion is **disabled by default**. Enable it with one edit; it is added on top of whichever preset is active (use `forestAdventure` to give it enemies to fight):

```ts
creatures: {
  ironGolem: { enabled: true, zones: ['spawn-meadow'], scale: 1 },
  // keep the existing preset, presets, combat, simulation and limits
}
```

`zones` chooses where it spawns (the spawn meadow keeps it next to the player) and `scale` accepts `[0.5, 2]`. When enabled it counts toward `limits.maxCreatures` and uses five of `limits.maxDrawCalls`; the validator reports a preset that no longer fits. The binding is declared in `rabbit.json` (`rules` → `src/game.config.ts#ironGolem` and `src/sim/creature-guardian.ts`, `presentation` → `src/entities/creature-golem.ts`).

`guardian` is the Iron Golem's default behavior. The golem:

- follows the player (walks when more than 4.5 blocks away, stops at 3, speeds up when far behind) and never sleeps;
- teleports next to the player when left more than 22 blocks behind or stuck, like a Minecraft pet;
- engages hostile creatures (enemies and territorial animals) within its detection range and within 14 blocks of the player, raising both arms and slamming them for `attackDamage` every `enemyAttackCooldown` seconds;
- launches struck creatures up and away, Minecraft style;
- is friendly: the player cannot damage it, even with `animalsDamageable: true`;
- takes hits from the hostiles it is fighting, regenerates slowly out of combat, and stays down until restart if defeated.

Golem fights only happen while `combat.enabled` is true. Internal follow/teleport distances live in `GUARDIAN` inside `src/sim/creature-guardian.ts`; species stats live in the catalog.

`playerMaxHealth`, damage, and attack cooldowns are validated before boot. Health appears only when the active population contains enemies.

## Performance and lifecycle

AI decisions run at `decisionHz`; movement stays in the fixed simulation step. Creatures beyond `sleepDistance` stop updating until the player returns. The delivered limits allow at most 16 active creatures, six enemies, and 24 creature draw calls (an Iron Golem uses five).

Spawn planning is deterministic for `world.seed`. Creatures avoid water, steep steps, solid body cells, the immediate spawn clearing, and non-grass surfaces. Pause freezes simulation and rendering. Restart regenerates the initial population without recreating materials or meshes; ordinary respawn preserves the current population unless the world itself is regenerated.
