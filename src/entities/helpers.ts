/**
 * PlayCanvas entity and material construction helpers.
 * The base scene uses procedural primitives: no external assets.
 */
import * as pc from 'playcanvas'

export function color(hex: string): pc.Color {
  const c = new pc.Color()
  c.fromString(hex)
  return c
}

export interface MatOptions {
  /** Emissive color (for glows). */
  emissive?: string
  emissiveIntensity?: number
  /** 0–1: enables transparency when < 1. */
  opacity?: number
  metalness?: number
  /** 0–1 (equivalent to 1 - roughness). */
  gloss?: number
  /** Unlit: the color is emitted flat (sky, distant mountains). */
  unlit?: boolean
  /** Render both faces. */
  twoSided?: boolean
}

export function makeMat(diffuseHex: string, options: MatOptions = {}): pc.StandardMaterial {
  const material = new pc.StandardMaterial()

  if (options.unlit) {
    material.useLighting = false
    material.diffuse = new pc.Color(0, 0, 0)
    material.emissive = color(diffuseHex)
  } else {
    material.diffuse = color(diffuseHex)
  }

  if (options.emissive) {
    material.emissive = color(options.emissive)
    material.emissiveIntensity = options.emissiveIntensity ?? 1
  }

  if (options.metalness !== undefined) {
    material.useMetalness = true
    material.metalness = options.metalness
  }
  if (options.gloss !== undefined) material.gloss = options.gloss

  if (options.opacity !== undefined && options.opacity < 1) {
    material.opacity = options.opacity
    material.blendType = pc.BLEND_NORMAL
    material.depthWrite = false
  }

  if (options.twoSided) material.cull = pc.CULLFACE_NONE

  material.update()
  return material
}

export type PrimitiveType = 'box' | 'sphere' | 'cone' | 'cylinder' | 'capsule' | 'plane' | 'torus'

export interface PrimOptions {
  parent: pc.Entity
  material: pc.Material
  position?: [number, number, number]
  /** Euler in degrees (PlayCanvas uses degrees). */
  rotation?: [number, number, number]
  scale?: [number, number, number]
  castShadows?: boolean
  receiveShadows?: boolean
  enabled?: boolean
}

/** Creates an entity with a primitive render component. */
export function prim(name: string, type: PrimitiveType, options: PrimOptions): pc.Entity {
  const entity = new pc.Entity(name)
  entity.addComponent('render', {
    type,
    castShadows: options.castShadows ?? false,
    receiveShadows: options.receiveShadows ?? false,
  })
  entity.render!.material = options.material

  if (options.position) entity.setLocalPosition(...options.position)
  if (options.rotation) entity.setLocalEulerAngles(...options.rotation)
  if (options.scale) entity.setLocalScale(...options.scale)
  if (options.enabled === false) entity.enabled = false

  options.parent.addChild(entity)
  return entity
}

export const RAD_TO_DEG = 180 / Math.PI
