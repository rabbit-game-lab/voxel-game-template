import assert from 'node:assert/strict'
import { createServer } from 'vite'

// Headless checks for the Iron Golem guardian companion.
// Run: node --import ./scripts/register-tests.mjs scripts/test-creature-guardian.mjs
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const still = { moveX: 0, moveZ: 0, sprint: false, jumpPressed: false }
const walk = { moveX: 0, moveZ: -1, sprint: true, jumpPressed: false }
try {
  const { CONFIG } = await vite.ssrLoadModule('/src/game.config.ts')
  const { GameSession } = await vite.ssrLoadModule('/src/sim/session.ts')
  const { validateConfig } = await vite.ssrLoadModule('/src/systems/config-validator.ts')

  const find = (session, species) => session.creatures.states().findIndex((item) => item.species === species)
  const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
  const withGolem = (preset = CONFIG.creatures.preset) => {
    const config = structuredClone(CONFIG)
    config.creatures.preset = preset
    config.creatures.ironGolem.enabled = true
    return config
  }

  {
    // Disabled by default: no golem unless CONFIG.creatures.ironGolem.enabled is true.
    assert.equal(CONFIG.creatures.ironGolem.enabled, false)
    const session = new GameSession(structuredClone(CONFIG))
    assert.equal(find(session, 'ironGolem'), -1)
  }

  for (const preset of ['peacefulForest', 'forestAdventure']) {
    const config = withGolem(preset)
    assert.doesNotThrow(() => validateConfig(config), `${preset} config is valid`)
    const session = new GameSession(config)
    session.begin()
    const golem = session.creatures.states()[find(session, 'ironGolem')]
    assert.ok(golem, `${preset} spawns an Iron Golem`)
    assert.ok(flat(golem, session.player.position) < 10, 'golem starts near the camp')
  }

  {
    // Companion: follows the player and never falls far behind.
    const session = new GameSession(withGolem())
    session.begin()
    const golem = session.creatures.states()[find(session, 'ironGolem')]
    for (let step = 0; step < 60 * 6; step += 1) session.stepMovement(walk, 1 / 60)
    for (let step = 0; step < 60 * 6; step += 1) session.stepMovement(still, 1 / 60)
    assert.ok(golem.active)
    assert.ok(flat(golem, session.player.position) < 6, `golem follows (${flat(golem, session.player.position).toFixed(2)})`)
  }

  {
    // Guardian: hunts hostile creatures near the player and defeats them.
    const session = new GameSession(withGolem('forestAdventure'))
    session.begin()
    const states = session.creatures.states()
    const golem = states[find(session, 'ironGolem')]
    const zombieIndex = find(session, 'zombie')
    const zombie = states[zombieIndex]
    Object.assign(zombie, { x: golem.x + 2.5, y: golem.y, z: golem.z })
    let defeated = false; let notice = ''
    for (let step = 0; step < 60 * 12 && !defeated; step += 1) {
      session.stepMovement(still, 1 / 60)
      defeated = session.consumeEvents().some((event) =>
        event.type === 'creature' && event.index === zombieIndex && event.action === 'defeat')
      notice = session.getHudSnapshot('keyboard', false, 'day', 'first-person').notice?.text ?? notice
    }
    assert.ok(defeated && !zombie.active, 'golem defeats the zombie')
    assert.match(notice, /Iron Golem derrotó a Zombie/)
    assert.ok(golem.active && golem.health > 0, 'golem survives one zombie')
  }

  {
    // Friendly: the player cannot damage the golem, even with animalsDamageable.
    const config = withGolem()
    config.creatures.combat.animalsDamageable = true
    const session = new GameSession(config)
    session.begin()
    const index = find(session, 'ironGolem')
    assert.equal(session.creatures.damage(index, 99).accepted, false)
  }

  {
    // Restart restores the golem deterministically.
    const session = new GameSession(withGolem())
    session.begin()
    const index = find(session, 'ironGolem')
    const first = { ...session.creatures.states()[index] }
    for (let step = 0; step < 120; step += 1) session.stepMovement(walk, 1 / 60)
    session.restart(); session.begin()
    const again = session.creatures.states()[index]
    assert.deepEqual([again.x, again.y, again.z, again.health], [first.x, first.y, first.z, first.health])
  }
  console.log('Iron Golem guardian scenarios passed.')
} finally {
  await vite.close()
}
