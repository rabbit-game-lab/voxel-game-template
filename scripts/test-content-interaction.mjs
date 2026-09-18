import assert from 'node:assert/strict'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { CONFIG } = await vite.ssrLoadModule('/src/game.config.ts')
  const { GameSession } = await vite.ssrLoadModule('/src/sim/session.ts')
  const interaction = await vite.ssrLoadModule('/src/content/interaction.ts')

  const flower = {
    id: 'flower-0', archetype: 'flower', x: 4, y: 8, z: -3,
    zone: 'forest', rotation: 0, scale: 1, color: '#f2b6cb',
  }
  const rock = {
    id: 'rock-0', archetype: 'rock', x: 7, y: 6, z: 2,
    zone: 'highland', rotation: 0, scale: 1.2, color: '#7b8580',
  }
  const placements = [flower, rock]
  const active = new Uint8Array([1, 1])
  assert.equal(interaction.decorationLabel(flower), 'Flor')
  assert.deepEqual(interaction.decorationSupport(flower), { x: 4, y: 7, z: -3 })
  assert.deepEqual(interaction.decorationsOnSupport(placements, active, { x: 4, y: 7, z: -3 }), [0])
  assert.equal(interaction.raycastDecorations(
    placements, active, { x: 4.5, y: 10, z: -2.5 }, { x: 0, y: -1, z: 0 }, 6,
  )?.index, 0)

  function aimDown(item) {
    return {
      origin: { x: item.x + 0.5, y: item.y + 2, z: item.z + 0.5 },
      direction: { x: 0, y: -1, z: 0 }, maxDistance: 6,
    }
  }

  {
    const session = new GameSession(structuredClone(CONFIG))
    session.begin()
    const index = session.contentPlan.meshes.findIndex((item) => item.archetype === 'flower')
    const item = session.contentPlan.meshes[index]
    assert.ok(item)
    session.updateTarget(aimDown(item), 'first-person')
    assert.equal(session.targetSnapshot().decoration?.index, index)
    assert.equal(session.targetSnapshot().label, 'Flor')
    session.applyInteraction(true, false)
    assert.equal(session.decorationActiveSnapshot()[index], false)
    assert.ok(session.consumeEvents().some((event) =>
      event.type === 'decoration' && event.index === index && event.reason === 'break'))
  }

  {
    const config = structuredClone(CONFIG)
    config.content.interaction.breakableDecorations = false
    const session = new GameSession(config)
    session.begin()
    const index = session.contentPlan.meshes.findIndex((item) => item.archetype === 'flower')
    const item = session.contentPlan.meshes[index]
    assert.ok(item)
    session.updateTarget(aimDown(item), 'first-person')
    assert.deepEqual(session.targetSnapshot().hit?.voxel, { x: item.x, y: item.y - 1, z: item.z })
    session.applyInteraction(true, false)
    assert.equal(session.decorationActiveSnapshot()[index], false)
    const events = session.consumeEvents()
    assert.ok(events.some((event) => event.type === 'edit' && event.action === 'break'))
    assert.ok(events.some((event) =>
      event.type === 'decoration' && event.index === index && event.reason === 'unsupported'))
  }
  console.log('Breakable and support-aware decoration scenarios passed.')
} finally {
  await vite.close()
}
