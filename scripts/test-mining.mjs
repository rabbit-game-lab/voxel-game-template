import assert from 'node:assert/strict'
import { createServer } from 'vite'

// Headless checks for progressive (Minecraft-style) block breaking and pickaxe tiers.
// Run: node --import ./scripts/register-tests.mjs scripts/test-mining.mjs
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const FRAME = 1 / 60
try {
  const { CONFIG } = await vite.ssrLoadModule('/src/game.config.ts')
  const { BLOCKS } = await vite.ssrLoadModule('/src/data/blocks.ts')
  const { GameSession } = await vite.ssrLoadModule('/src/sim/session.ts')
  const { breakSeconds } = await vite.ssrLoadModule('/src/sim/mining.ts')
  const { validateConfig } = await vite.ssrLoadModule('/src/systems/config-validator.ts')

  const withPickaxe = (pickaxe, timeScale = 1) => {
    const config = structuredClone(CONFIG)
    config.interaction.mining = { pickaxe, timeScale }
    return config
  }
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`)

  // Minecraft break times: hardness × 1.5 / tool speed.
  close(breakSeconds(BLOCKS.dirt, withPickaxe('stone')), 0.75)
  close(breakSeconds(BLOCKS.wood, withPickaxe('diamond')), 3)
  close(breakSeconds(BLOCKS.stone, withPickaxe('none')), 2.25)
  close(breakSeconds(BLOCKS.stone, withPickaxe('wood')), 1.125)
  close(breakSeconds(BLOCKS.stone, withPickaxe('stone')), 0.5625)
  close(breakSeconds(BLOCKS.stone, withPickaxe('iron', 0.5)), 0.1875)
  assert.throws(() => validateConfig(withPickaxe('netherite')), /interaction\.mining\.pickaxe/)
  assert.throws(() => validateConfig(withPickaxe('stone', 0)), /interaction\.mining\.timeScale/)

  function sessionAimingAtStone(config) {
    const session = new GameSession(config)
    session.begin()
    const { x, z } = session.player.position
    const vx = Math.floor(x); const vz = Math.floor(z) - 2
    let y = session.world.bounds.maxExclusive.y - 1
    while (y > 0 && session.world.getBlock(vx, y, vz) === BLOCKS.air.id) y -= 1
    session.world.setBlock(vx, y, vz, BLOCKS.stone.id)
    const voxel = { x: vx, y, z: vz }
    session.updateTarget({
      origin: { x: vx + 0.5, y: y + 3, z: vz + 0.5 }, direction: { x: 0, y: -1, z: 0 }, maxDistance: 6,
    }, 'first-person')
    assert.deepEqual(session.targetSnapshot().hit?.voxel, voxel)
    session.consumeEvents()
    return { session, voxel }
  }
  function holdUntilBroken(session, voxel, maxSeconds) {
    let seconds = 0
    const events = []
    while (seconds < maxSeconds && session.world.getBlock(voxel.x, voxel.y, voxel.z) === BLOCKS.stone.id) {
      session.applyInteraction(true, false, FRAME)
      events.push(...session.consumeEvents())
      seconds += FRAME
    }
    return { seconds, events }
  }

  {
    // Cracks advance through the destroy stages, then the block breaks and drops.
    const { session, voxel } = sessionAimingAtStone(withPickaxe('stone'))
    const stages = new Set()
    let seconds = 0
    while (session.world.getBlock(voxel.x, voxel.y, voxel.z) === BLOCKS.stone.id && seconds < 2) {
      session.applyInteraction(true, false, FRAME)
      const snapshot = session.miningSnapshot()
      if (snapshot) stages.add(snapshot.stage)
      seconds += FRAME
    }
    assert.ok(seconds > 0.5 && seconds < 0.62, `stone pickaxe breaks stone in ~0.56 s (${seconds.toFixed(3)})`)
    assert.ok(stages.size >= 8, `crack stages shown: ${[...stages].join(',')}`)
    const events = session.consumeEvents()
    assert.ok(events.filter((event) => event.type === 'dig').length >= 2, 'dig swings while mining')
    assert.ok(events.some((event) => event.type === 'edit' && event.action === 'break' && event.block === 'stone'))
    assert.equal(session.miningSnapshot(), null)
  }

  {
    // Releasing the button resets progress, like Minecraft.
    const { session, voxel } = sessionAimingAtStone(withPickaxe('stone'))
    for (let frame = 0; frame < 20; frame += 1) session.applyInteraction(true, false, FRAME)
    assert.ok(session.miningSnapshot().stage > 0)
    session.applyInteraction(false, false, FRAME)
    assert.equal(session.miningSnapshot(), null)
    const { seconds } = holdUntilBroken(session, voxel, 2)
    assert.ok(seconds > 0.5, 'progress restarted from zero')
  }

  {
    // A better pickaxe mines stone faster; the bare hand is slowest.
    const times = ['none', 'wood', 'iron'].map((tier) => {
      const { session, voxel } = sessionAimingAtStone(withPickaxe(tier))
      return holdUntilBroken(session, voxel, 4).seconds
    })
    assert.ok(times[0] > times[1] && times[1] > times[2], `hand > wood > iron (${times.map((t) => t.toFixed(2))})`)
  }
  console.log('Progressive mining scenarios passed.')
} finally {
  await vite.close()
}
