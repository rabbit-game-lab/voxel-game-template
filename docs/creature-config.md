# Creature configuration

`CONFIG.creatures` is the only public tuning surface for animals, enemies, and NPC-style characters. Species internals live in the catalog; presets only decide what appears and how it is distributed.

The final population is built in this order (`creatureGroupEntries()` in `src/creatures/planner.ts`):

1. every animal whose `creatures.animals.<species>.enabled` is `true`;
2. the groups of the active `creatures.preset`;
3. the Iron Golem, when `creatures.ironGolem.enabled` is `true`.

## Animals

Animals (`horse`, `chicken`, `sheep`, `pig`, `dog`, `raccoon`, `wolf`) live in code but are **disabled by default**, like the Iron Golem. Each species has its own switch in `CONFIG.creatures.animals` and is added on top of whichever preset is active:

```ts
creatures: {
  animals: {
    horse: { enabled: true, count: 2, zones: ['spawn-meadow', 'forest'], scale: 1, minSpacing: 4, roamRadius: 8 },
    dog: { enabled: true, count: 1, zones: ['spawn-meadow'], scale: 1, minSpacing: 3, roamRadius: 10 },
    // …the other species keep enabled: false
  },
}
```

Each entry takes the same fields as a preset group (below) plus `enabled`. With every animal disabled the default world has no creatures and zero creature draw calls. The `wolf` is territorial: enabling it makes the population hostile and shows the health HUD while `combat.enabled` is true.

Declare animals only here: a species that also appears in a preset group is reported as duplicated. The binding is declared in `rabbit.json` (`rules` → `src/game.config.ts#animals` and `src/creatures/planner.ts#creatureGroupEntries`).

## Presets

Presets hold the hostile population:

- `empty`: no preset creatures.
- `peacefulForest`: the default; no enemies.
- `forestAdventure`: slimes, a skeleton, a goblin, and a zombie.

Switch the hostile population with one edit:

```ts
creatures: {
  preset: 'forestAdventure',
  // keep the existing presets, animals, combat, simulation and limits
}
```

Presets do not inherit from each other; animals and the golem are layered on top of whichever one is active.

## Groups

Each group contains:

- `species`: a key from the built-in catalog.
- `count`: deterministic population for the selected seed.
- `behavior`: optional override; omission uses the catalog default.
- `zones`: allowed world zones.
- `scale`: visual and gameplay scale in the supported `[0.5, 2]` range.
- `minSpacing`: minimum spawn distance from every other creature.
- `roamRadius`: maximum ordinary wandering distance from its spawn.

Example: add three villagers to a preset without changing simulation code:

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

Example: make ponies from the horse asset in `creatures.animals`:

```ts
horse: { enabled: true, count: 1, zones: ['spawn-meadow'], scale: 0.75, minSpacing: 4, roamRadius: 6 },
```

## Behavior and combat

Available behavior keys are `grazer`, `wanderer`, `skittish`, `companion`, `territorial`, `chaser-melee`, `stationary`, `npc-wander`, and `guardian`.

Enemy and territorial behavior only damages the player when `combat.enabled` is true. Friendly animals reject attacks by default through `animalsDamageable: false`. Primary action attacks a targeted damageable creature; otherwise it retains the existing block/decor break behavior.

### Guardian (Iron Golem)

The Iron Golem companion is **disabled by default**. Enable it with one edit; it is added on top of whichever preset is active (use `forestAdventure` to give it enemies to fight):

```ts
creatures: {
  ironGolem: { enabled: true, zones: ['spawn-meadow'], scale: 1 },
  // keep the existing preset, presets, animals, combat, simulation and limits
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

AI decisions run at `decisionHz`; movement stays in the fixed simulation step. Creatures beyond `sleepDistance` stop updating until the player returns. The delivered limits allow at most 16 active creatures, six enemies, and 24 creature draw calls (an Iron Golem uses five). Every animal enabled plus `forestAdventure` plus the golem is exactly 16 creatures and 20 draw calls; raise `limits` before adding more.

Spawn planning is deterministic for `world.seed`. Creatures avoid water, steep steps, solid body cells, the immediate spawn clearing, and non-grass surfaces. Pause freezes simulation and rendering. Restart regenerates the initial population without recreating materials or meshes; ordinary respawn preserves the current population unless the world itself is regenerated.
