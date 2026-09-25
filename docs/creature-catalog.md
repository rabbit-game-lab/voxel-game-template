# Creature catalog

The creature catalog is a lightweight library of procedural voxel archetypes. It provides reusable visuals, dimensions, movement defaults, health, combat ranges, and aliases without downloading one model per species.

## Built-in species

| Key | Category | Default behavior | Common aliases |
| --- | --- | --- | --- |
| `horse` | animal | grazer | horse, pony, caballo, caballito |
| `chicken` | animal | skittish | chicken, hen, gallina, pollo |
| `sheep` | animal | grazer | sheep, lamb, oveja, cordero |
| `pig` | animal | grazer | pig, piglet, cerdo, chanchito |
| `dog` | animal | companion | dog, puppy, perro, perrito |
| `raccoon` | animal | skittish | raccoon, mapache |
| `wolf` | animal | territorial | wolf, lobo |
| `slime` | enemy | chaser-melee | slime, blob, baba |
| `skeleton` | enemy | chaser-melee | skeleton, esqueleto |
| `goblin` | enemy | chaser-melee | goblin, duende |
| `zombie` | enemy | chaser-melee | zombie, zombi |
| `explorer` | character | stationary | explorer, adventurer, explorador |
| `villager` | character | npc-wander | villager, aldeano, aldeana |
| `ironGolem` | character | guardian | iron golem, golem, golem de hierro |

Aliases are defined in `src/creatures/catalog.ts`. They let an AI map natural-language requests to a stable `CreatureSpeciesKey`; aliases are never written into saved config.

## Rendering contract

Built-in species use code-authored voxel meshes from `src/entities/creature-archetypes.ts`. One mesh is created per active species and shared by every instance. Each active creature contributes one draw call and no DOM node, rigidbody, or downloaded file.

The `golem` shape (`src/entities/creature-golem.ts`) is the one exception: a Minecraft-style Iron Golem built on the 1/16-block pixel grid whose arms and legs are separate child parts so they can swing while walking and rise for the two-handed slam attack. Body, arm, and leg meshes are shared by every golem, and each golem costs five draw calls (`creatureDrawCalls()` in the catalog, which the validator sums against `limits.maxDrawCalls`).

The renderer is a read-only mirror of `CreatureSimulation`. Gameplay bounds, health, targeting, and behavior remain engine-independent.

## Adding a missing species

1. Append its stable key to `CreatureSpeciesKey`.
2. Register label, aliases, category, shape, colors, bounds, movement, health, and behavior in `CREATURE_CATALOG`.
3. Reuse an existing procedural shape or add a focused builder in `creature-archetypes.ts`.
4. Add the species to a group in `CONFIG.creatures`.
5. Run validation, build, audit, and visually inspect scale, ground contact, targeting, water avoidance, pause, and restart.

An imported animated GLB can be introduced as another renderer backend later. It must use Rabbit assets/character helpers, document provenance in `THIRD_PARTY.md`, load only when selected, and preserve the catalog's simulation bounds.
