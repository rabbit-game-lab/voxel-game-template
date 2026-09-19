import * as pc from 'playcanvas'
import { creatureSpec } from '../creatures/catalog'
import type { CreatureSpeciesKey } from '../creatures/config'
import { addBox, builder, createMesh, rgb, type MeshBuilder } from './environment-geometry'

function addLegs(data: MeshBuilder, color: string, x: number, z: number, height: number, width: number): void {
  for (const dx of [-x, x]) for (const dz of [-z, z]) {
    addBox(data, [dx, height * 0.5, dz], [width, height, width], rgb(color))
  }
}

function quadruped(data: MeshBuilder, key: CreatureSpeciesKey): void {
  const spec = creatureSpec(key); const [body, accent, detail] = spec.colors
  const horse = key === 'horse'; const small = key === 'raccoon' || key === 'dog'
  const bodyY = horse ? 0.95 : small ? 0.46 : 0.58
  const bodySize: [number, number, number] = horse ? [0.78, 0.72, 1.35] : small ? [0.55, 0.42, 0.82] : [0.75, 0.55, 0.98]
  const legHeight = horse ? 0.68 : small ? 0.3 : 0.42
  addLegs(data, accent, bodySize[0] * 0.31, bodySize[2] * 0.31, legHeight, small ? 0.13 : 0.16)
  addBox(data, [0, bodyY, 0], bodySize, rgb(body))
  const headY = bodyY + bodySize[1] * 0.24
  addBox(data, [0, headY, -bodySize[2] * 0.62], [bodySize[0] * 0.72, bodySize[1] * 0.72, bodySize[2] * 0.48], rgb(accent))
  addBox(data, [0, headY - 0.06, -bodySize[2] * 0.9], [bodySize[0] * 0.48, bodySize[1] * 0.38, 0.25], rgb(body))
  addBox(data, [-bodySize[0] * 0.18, headY + bodySize[1] * 0.4, -bodySize[2] * 0.68], [0.13, 0.22, 0.12], rgb(accent))
  addBox(data, [bodySize[0] * 0.18, headY + bodySize[1] * 0.4, -bodySize[2] * 0.68], [0.13, 0.22, 0.12], rgb(accent))
  addBox(data, [-bodySize[0] * 0.18, headY + 0.04, -bodySize[2] * 0.93], [0.07, 0.07, 0.05], rgb(detail))
  addBox(data, [bodySize[0] * 0.18, headY + 0.04, -bodySize[2] * 0.93], [0.07, 0.07, 0.05], rgb(detail))
  addBox(data, [0, bodyY + 0.04, bodySize[2] * 0.67], [0.14, 0.14, horse ? 0.62 : 0.38], rgb(accent))
  if (key === 'sheep') addBox(data, [0, bodyY + 0.12, 0], [0.86, 0.64, 1.08], rgb(body))
  if (key === 'raccoon') {
    addBox(data, [0, headY + 0.02, -bodySize[2] * 0.88], [0.5, 0.16, 0.06], rgb(detail))
    addBox(data, [0, bodyY + 0.04, bodySize[2] * 0.86], [0.2, 0.2, 0.25], rgb(detail))
  }
}

function bird(data: MeshBuilder, key: CreatureSpeciesKey): void {
  const [body, accent, beak] = creatureSpec(key).colors
  addBox(data, [0, 0.33, 0], [0.52, 0.48, 0.58], rgb(body))
  addBox(data, [0, 0.58, -0.22], [0.38, 0.36, 0.38], rgb(body))
  addBox(data, [0, 0.55, -0.47], [0.2, 0.14, 0.18], rgb(beak))
  addBox(data, [0, 0.43, -0.42], [0.13, 0.16, 0.12], rgb(accent))
  addBox(data, [-0.12, 0.76, -0.2], [0.08, 0.17, 0.08], rgb(accent))
  addBox(data, [0.12, 0.76, -0.2], [0.08, 0.17, 0.08], rgb(accent))
  addBox(data, [-0.13, 0.09, 0], [0.06, 0.18, 0.06], rgb(beak))
  addBox(data, [0.13, 0.09, 0], [0.06, 0.18, 0.06], rgb(beak))
}

function humanoid(data: MeshBuilder, key: CreatureSpeciesKey): void {
  const [skin, clothes, detail] = creatureSpec(key).colors
  addBox(data, [0, 1.03, 0], [0.54, 0.65, 0.3], rgb(clothes))
  addBox(data, [0, 1.52, -0.01], [0.43, 0.42, 0.4], rgb(skin))
  addBox(data, [-0.13, 1.56, -0.22], [0.07, 0.07, 0.05], rgb(detail))
  addBox(data, [0.13, 1.56, -0.22], [0.07, 0.07, 0.05], rgb(detail))
  addBox(data, [-0.36, 1.0, 0], [0.15, 0.62, 0.17], rgb(skin))
  addBox(data, [0.36, 1.0, 0], [0.15, 0.62, 0.17], rgb(skin))
  addBox(data, [-0.15, 0.42, 0], [0.2, 0.72, 0.23], rgb(clothes))
  addBox(data, [0.15, 0.42, 0], [0.2, 0.72, 0.23], rgb(clothes))
  if (key === 'skeleton') {
    addBox(data, [0, 1.05, 0], [0.18, 0.55, 0.16], rgb(skin))
    for (const y of [0.88, 1.04, 1.2]) addBox(data, [0, y, 0], [0.55, 0.06, 0.13], rgb(skin))
  }
}

function slime(data: MeshBuilder, key: CreatureSpeciesKey): void {
  const [body, accent, detail] = creatureSpec(key).colors
  addBox(data, [0, 0.36, 0], [0.82, 0.72, 0.82], rgb(body))
  addBox(data, [0, 0.72, 0], [0.64, 0.14, 0.64], rgb(accent))
  addBox(data, [-0.18, 0.5, -0.42], [0.1, 0.16, 0.05], rgb(detail))
  addBox(data, [0.18, 0.5, -0.42], [0.1, 0.16, 0.05], rgb(detail))
}

export function createCreatureMesh(device: pc.GraphicsDevice, key: CreatureSpeciesKey): pc.Mesh {
  const data = builder(); const shape = creatureSpec(key).shape
  if (shape === 'quadruped') quadruped(data, key)
  else if (shape === 'bird') bird(data, key)
  else if (shape === 'humanoid') humanoid(data, key)
  else slime(data, key)
  return createMesh(device, data)
}
