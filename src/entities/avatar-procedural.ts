import * as pc from 'playcanvas'
import type { GameConfig } from '../game.config'
import { makeMat, prim } from './helpers'
import type { AvatarMotion, AvatarVisual } from './avatar-types'

export function createProceduralAvatar(parent: pc.Entity, config: GameConfig): AvatarVisual {
  const spec = config.player.avatar.procedural
  const model = new pc.Entity('Procedural Explorer')
  parent.addChild(model)
  const materials = {
    skin: makeMat(spec.colors.skin, { gloss: 0 }),
    hair: makeMat(spec.colors.hair, { gloss: 0 }),
    shirt: makeMat(spec.colors.shirt, { gloss: 0 }),
    pants: makeMat(spec.colors.pants, { gloss: 0 }),
    boots: makeMat(spec.colors.boots, { gloss: 0 }),
  }
  const scale = spec.height / 1.72
  model.setLocalScale(scale, scale, scale)

  prim('Torso', 'box', {
    parent: model, material: materials.shirt, position: [0, 0.99, 0],
    scale: [spec.bodyWidth, 0.62, 0.28],
  })
  prim('Head', 'box', {
    parent: model, material: materials.skin, position: [0, 1.49, 0],
    scale: [0.4 * spec.headScale, 0.42 * spec.headScale, 0.38 * spec.headScale],
  })
  prim('Hair', 'box', {
    parent: model, material: materials.hair, position: [0, 1.7, 0.01],
    scale: [0.42 * spec.headScale, 0.12, 0.4 * spec.headScale],
  })

  function limb(name: string, x: number, y: number, length: number, material: pc.Material): pc.Entity {
    const pivot = new pc.Entity(`${name} Pivot`)
    pivot.setLocalPosition(x, y, 0)
    model.addChild(pivot)
    prim(name, 'box', {
      parent: pivot, material, position: [0, -length * 0.5, 0],
      scale: [0.16, length, 0.18],
    })
    return pivot
  }

  const leftArm = limb('Left Arm', -0.34, 1.24, 0.58, materials.skin)
  const rightArm = limb('Right Arm', 0.34, 1.24, 0.58, materials.skin)
  const leftLeg = limb('Left Leg', -0.14, 0.68, 0.66, materials.pants)
  const rightLeg = limb('Right Leg', 0.14, 0.68, 0.66, materials.pants)
  prim('Left Boot', 'box', {
    parent: leftLeg, material: materials.boots, position: [0, -0.58, -0.035], scale: [0.18, 0.18, 0.27],
  })
  prim('Right Boot', 'box', {
    parent: rightLeg, material: materials.boots, position: [0, -0.58, -0.035], scale: [0.18, 0.18, 0.27],
  })

  const hand = new pc.Entity('Right Hand')
  hand.setLocalPosition(0, -0.56, -0.02)
  rightArm.addChild(hand)
  let rightArmPitch = 0
  let swing = 0

  function pose(left: number, right: number, arms = -left): void {
    leftLeg.setLocalEulerAngles(left, 0, 0)
    rightLeg.setLocalEulerAngles(right, 0, 0)
    leftArm.setLocalEulerAngles(arms, 0, 0)
    rightArmPitch = -arms
    rightArm.setLocalEulerAngles(rightArmPitch + Math.sin(swing * Math.PI) * 95, 0, 0)
  }

  return {
    entity: model,
    drawCalls: 9,
    hand,
    setSwing(amount) {
      swing = amount
      rightArm.setLocalEulerAngles(rightArmPitch + Math.sin(swing * Math.PI) * 95, 0, 0)
    },
    setMotion(motion, phase) {
      model.setLocalPosition(0, motion === 'idle' ? Math.sin(phase) * spec.animation.idleBob : 0, 0)
      if (motion === 'idle') pose(0, 0, Math.sin(phase * 0.55) * 3)
      else if (motion === 'walk' || motion === 'run') {
        const amplitude = motion === 'run' ? spec.animation.runSwing : spec.animation.walkSwing
        const swing = Math.sin(phase) * amplitude
        pose(swing, -swing)
      } else if (motion === 'jump') pose(-22, 22, -34)
      else if (motion === 'fall') pose(14, -14, 38)
      else pose(20, 20, -12)
    },
    reset() { model.setLocalPosition(0, 0, 0); pose(0, 0, 0) },
    destroy() { model.destroy(); Object.values(materials).forEach((material) => material.destroy()) },
  }
}
