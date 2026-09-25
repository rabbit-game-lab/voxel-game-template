import assert from 'node:assert/strict'
import { createServer } from 'vite'

// Headless checks for the per-species animal toggles in CONFIG.creatures.animals.
// Run: node --import ./scripts/register-tests.mjs scripts/test-creature-animals.mjs
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { CONFIG } = await vite.ssrLoadModule('/src/game.config.ts')
  const { GameSession } = await vite.ssrLoadModule('/src/sim/session.ts')
  const { validateConfig } = await vite.ssrLoadModule('/src/systems/config-validator.ts')

  const species = (session) => session.creatures.states().map((item) => item.species)
  const animals = Object.keys(CONFIG.creatures.animals)
  assert.deepEqual(animals.sort(), ['chicken', 'dog', 'horse', 'pig', 'raccoon', 'sheep', 'wolf'])

  {
    // Every animal is disabled by default, so the default world has no creatures.
    for (const key of animals) assert.equal(CONFIG.creatures.animals[key].enabled, false, `${key} disabled`)
    assert.deepEqual(species(new GameSession(structuredClone(CONFIG))), [])
  }

  {
    // Enabling one species spawns exactly its configured count and nothing else.
    const config = structuredClone(CONFIG)
    config.creatures.animals.horse.enabled = true
    assert.doesNotThrow(() => validateConfig(config))
    assert.deepEqual(species(new GameSession(config)), ['horse', 'horse'])
  }

  {
    // Animals stack on top of the preset and the golem; the fullest setup still fits the limits.
    const config = structuredClone(CONFIG)
    for (const key of animals) config.creatures.animals[key].enabled = true
    config.creatures.preset = 'forestAdventure'
    config.creatures.ironGolem.enabled = true
    assert.doesNotThrow(() => validateConfig(config))
    const spawned = species(new GameSession(config))
    for (const key of [...animals, 'slime', 'zombie', 'ironGolem']) assert.ok(spawned.includes(key), `${key} spawned`)
    assert.equal(spawned.length, 16)
  }

  {
    // Enabling the wolf alone makes the population hostile (health HUD appears).
    const config = structuredClone(CONFIG)
    config.creatures.animals.wolf.enabled = true
    const session = new GameSession(config)
    assert.ok(session.creatures.hasHostiles())
  }

  {
    // An animal declared both in a preset and in creatures.animals is rejected.
    const config = structuredClone(CONFIG)
    config.creatures.animals.pig.enabled = true
    config.creatures.presets.peacefulForest = {
      groups: [{ species: 'pig', count: 1, zones: ['forest'], scale: 1, minSpacing: 3, roamRadius: 6 }],
    }
    assert.throws(() => validateConfig(config), /species is duplicated/)
  }

  {
    // Invalid toggle values fail validation with the animal's config path.
    const config = structuredClone(CONFIG)
    config.creatures.animals.sheep.enabled = 'yes'
    config.creatures.animals.dog.enabled = true
    config.creatures.animals.dog.scale = 5
    assert.throws(() => validateConfig(config), /creatures\.animals\.sheep\.enabled must be boolean/)
    assert.throws(() => validateConfig(config), /creatures\.animals\.dog\.scale must be in \[0\.5, 2\]/)
  }
  console.log('Animal toggle scenarios passed.')
} finally {
  await vite.close()
}
