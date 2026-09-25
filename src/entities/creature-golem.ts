import * as pc from 'playcanvas'
import { creatureSpec } from '../creatures/catalog'
import type { CreatureState } from '../creatures/types'
import { addBox, builder, createMesh, rgb, type MeshBuilder, type Rgb } from './environment-geometry'

/**
 * Minecraft-style Iron Golem built on the classic 1/16-block pixel grid:
 * 16 px legs, 5 px waist, 12 px chest, 10 px head with a long nose and
 * 30 px arms that reach the knees. Forward is -Z like every creature.
 */
const PX = 1 / 16
const EYE = '#6e211b'
const VINE_DARK = '#35652a'
const CRACK = '#8c867b'

export const GOLEM_PIVOTS = {
  shoulderY: 31 * PX, shoulderX: 11 * PX, shoulderZ: -1 * PX,
  hipY: 16 * PX, hipX: 4 * PX,
} as const

function box(data: MeshBuilder, center: readonly [number, number, number], size: readonly [number, number, number], color: Rgb): void {
  addBox(data, [center[0] * PX, center[1] * PX, center[2] * PX], [size[0] * PX, size[1] * PX, size[2] * PX], color)
}

function body(data: MeshBuilder): void {
  const [iron, shade, vine] = creatureSpec('ironGolem').colors.map(rgb)
  box(data, [0, 18.5, 0], [9, 5, 6], shade)
  box(data, [0, 27, -1], [18, 12, 11], iron)
  box(data, [0, 37, -3.5], [8, 10, 8], iron)
  box(data, [0, 34.5, -8.5], [2, 4, 2], iron)
  box(data, [0, 38.6, -7.7], [8.2, 1.2, 0.6], shade)
  box(data, [-2, 37.4, -7.6], [1.4, 1, 0.4], rgb(EYE))
  box(data, [2, 37.4, -7.6], [1.4, 1, 0.4], rgb(EYE))
  // Vines creeping over the chest, shoulders, back and waist.
  box(data, [-5.5, 27.5, -6.7], [3, 6, 0.5], vine)
  box(data, [-3.5, 23.5, -6.7], [2, 3, 0.5], rgb(VINE_DARK))
  box(data, [4.5, 30.5, -6.7], [2, 3, 0.5], vine)
  box(data, [5, 33.2, -1], [5, 0.5, 5], vine)
  box(data, [-6, 33.2, 1.5], [3, 0.5, 4], rgb(VINE_DARK))
  box(data, [3, 26, 4.7], [4, 7, 0.5], vine)
  box(data, [-2, 18, -3.2], [2, 3, 0.5], vine)
  // Weathered cracks in the iron plating.
  box(data, [1.5, 25, -6.7], [0.6, 4, 0.4], rgb(CRACK))
  box(data, [2.3, 23.2, -6.7], [1.6, 0.6, 0.4], rgb(CRACK))
}

function arm(data: MeshBuilder): void {
  const [iron, shade, vine] = creatureSpec('ironGolem').colors.map(rgb)
  box(data, [0, -13, 0], [4, 30, 6], iron)
  box(data, [0, -26.5, 0], [4.2, 3, 6.2], shade)
  box(data, [0, -7, -3.2], [2.5, 5, 0.5], vine)
}

function leg(data: MeshBuilder): void {
  const [iron, , vine] = creatureSpec('ironGolem').colors.map(rgb)
  box(data, [0, -8, 0], [6, 16, 5], iron)
  box(data, [1.2, -10, -2.7], [2, 4, 0.5], vine)
}

export interface GolemMeshes { body: pc.Mesh; arm: pc.Mesh; leg: pc.Mesh }

export function createGolemMeshes(device: pc.GraphicsDevice): GolemMeshes {
  const make = (build: (data: MeshBuilder) => void): pc.Mesh => {
    const data = builder(); build(data); return createMesh(device, data)
  }
  return { body: make(body), arm: make(arm), leg: make(leg) }
}

export interface GolemLimbs { leftArm: pc.Entity; rightArm: pc.Entity; leftLeg: pc.Entity; rightLeg: pc.Entity }

/** Arm pose in degrees for a melee swing: both arms rise fast, then slam down. */
function swingAngle(state: CreatureState, swingSeconds: number): number {
  if (state.swing <= 0) return 0
  const t = 1 - state.swing / swingSeconds
  return t < 0.35 ? (t / 0.35) * 125 : 125 * (1 - (t - 0.35) / 0.65)
}

export function poseGolem(limbs: GolemLimbs, state: CreatureState, swingSeconds: number): void {
  const stride = state.moving ? Math.sin(state.phase * 0.6) : 0
  const attack = swingAngle(state, swingSeconds)
  const armWalk = stride * 26
  limbs.leftArm.setLocalEulerAngles(attack > 0 ? attack : armWalk, 0, 0)
  limbs.rightArm.setLocalEulerAngles(attack > 0 ? attack : -armWalk, 0, 0)
  limbs.leftLeg.setLocalEulerAngles(-stride * 24, 0, 0)
  limbs.rightLeg.setLocalEulerAngles(stride * 24, 0, 0)
}
