import type * as pc from 'playcanvas'
import { PICKAXE_HANDLE, PICKAXE_TIERS, type PickaxeTier } from '../data/tools'
import { addBox, builder, createMesh, rgb } from './environment-geometry'

/**
 * Minecraft held items are 16×16 pixel sprites extruded one pixel deep. The
 * pickaxe head is symmetric about the handle diagonal (x + y = 15), so only
 * one half of the arc is listed and the other half is mirrored.
 */
const HEAD_OUTER = [[3, 2], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 2], [10, 2], [11, 3]] as const
const HEAD_INNER = [[4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 3], [10, 3], [10, 4], [11, 4]] as const
const HEAD_TIPS = [[2, 3], [3, 3]] as const
const HANDLE_LIGHT = [[1, 14], [2, 13], [3, 12], [4, 11], [5, 10], [6, 9], [7, 8], [8, 7], [9, 6], [10, 5]] as const
const HANDLE_DARK = [[2, 14], [3, 13], [4, 12], [5, 11], [6, 10], [7, 9], [8, 8], [9, 7]] as const

/** Sprite pixel where a hand grips the handle. */
export const PICKAXE_GRIP = [3, 12] as const

const mirror = (points: readonly (readonly [number, number])[]): [number, number][] =>
  points.flatMap(([x, y]) => [[x, y], [15 - y, 15 - x]] as [number, number][])

/** Extruded pixel-art pickaxe; `size` is the sprite's edge length in world units. */
export function createPickaxeMesh(device: pc.GraphicsDevice, tier: PickaxeTier, size: number): pc.Mesh {
  const [light, mid, dark] = PICKAXE_TIERS[tier].head.map(rgb)
  const pixels = new Map<string, readonly [number, number, number]>()
  const paint = (points: readonly (readonly [number, number])[], color: readonly [number, number, number]): void => {
    for (const [x, y] of points) pixels.set(`${x},${y}`, color)
  }
  paint(HANDLE_DARK, rgb(PICKAXE_HANDLE[1]))
  paint(HANDLE_LIGHT, rgb(PICKAXE_HANDLE[0]))
  paint(mirror(HEAD_INNER), mid)
  paint(mirror(HEAD_OUTER), light)
  paint(mirror(HEAD_TIPS), dark)
  const pixel = size / 16
  const data = builder()
  for (const [key, color] of pixels) {
    const [x, y] = key.split(',').map(Number)
    addBox(data, [(x - PICKAXE_GRIP[0]) * pixel, (PICKAXE_GRIP[1] - y) * pixel, 0], [pixel, pixel, pixel], color)
  }
  return createMesh(device, data)
}
