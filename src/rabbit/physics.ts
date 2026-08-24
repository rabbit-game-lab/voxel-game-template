/* =============================================================================
 * SDK MODULE: physics — kinematic movement, ground and collisions (PlayCanvas).
 * Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
 * ⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the options object
 * your game code passes; if the module falls short, that is a kit change.
 * Kind: playcanvas-3d — PlayCanvas math and entities.
 * =============================================================================
 *
 * WHAT
 *   Gravity, ground and "did these two things touch" WITHOUT a physics engine.
 *   The base template ships no Ammo build on purpose (`npm ci` must stay tiny
 *   and boots fast), and kid-game requests — walk, jump, pick up coins, don't
 *   walk through walls — are all covered by boxes and spheres:
 *
 *     const world = createPhysicsWorld({ gravity: -22, groundY: 0 })
 *     world.addStatic(wallEntity, { size: [4, 3, 0.5] })       // solid box
 *     const player = world.addKinematic(heroEntity, { radius: 0.4, height: 1.7 })
 *
 *     // in update(dt):
 *     player.move(velocityX, velocityZ, dt)      // gravity + collisions applied
 *     if (player.grounded) { ... }
 *
 *     world.onOverlap(heroEntity, coinEntity, () => coin.destroy())
 *
 * TYPICAL REQUESTS → WHAT TO TOUCH
 *   "que caiga más rápido"      → gravity (negative = down; -22 feels arcade-y,
 *                                 -9.8 is realistic and reads as floaty).
 *   "que no atraviese paredes"  → addStatic() on the wall. Without it, nothing
 *                                 stops the player.
 *   "que junte monedas"         → onOverlap() (or overlaps() polled in update).
 *   "que el piso tenga altura"  → groundY, or a static box as a platform.
 *   "quiero física de verdad"   → that means vendoring Ammo and rebuilding the
 *                                 template around rigidbodies: a kit change,
 *                                 not a local one. Ask before promising it.
 *
 * NOTES
 *   - Collisions are axis-aligned boxes (AABB) and spheres. Rotated colliders
 *     are approximated by their bounding box — good enough for these games.
 *   - Resolution is per-axis sliding: you walk along a wall instead of sticking.
 *   - This module never renders anything: shapes are invisible, attached to the
 *     entity you pass.
 * =============================================================================
 */
import * as pc from 'playcanvas'

export interface BoxShape {
  /** Full size in metres [x, y, z]. */
  size: readonly [number, number, number]
  /** Offset from the entity origin, in metres. */
  offset?: readonly [number, number, number]
}

export interface KinematicOptions {
  /** Capsule radius in metres. Default 0.4. */
  radius?: number
  /** Total height in metres. Default 1.8. */
  height?: number
  /** Max height the body climbs without jumping (kerbs, stairs). Default 0.35. */
  stepHeight?: number
}

export interface KinematicBody {
  entity: pc.Entity
  /** True while standing on the ground plane or a static box. */
  grounded: boolean
  /** Vertical speed in m/s (negative = falling). Set it to jump. */
  velocityY: number
  /** Applies horizontal speed + gravity + collisions for this frame. */
  move(velocityX: number, velocityZ: number, dt: number): void
  /** Teleport without inheriting speed. */
  teleport(x: number, y: number, z: number): void
  destroy(): void
}

export interface PhysicsWorldOptions {
  /** Vertical acceleration in m/s². Negative is down. Default -22. */
  gravity?: number
  /** Height of the infinite ground plane. Pass null for no ground. Default 0. */
  groundY?: number | null
  /** Terminal fall speed in m/s. Default 45. */
  maxFallSpeed?: number
}

export interface PhysicsWorld {
  addStatic(entity: pc.Entity, shape: BoxShape): void
  removeStatic(entity: pc.Entity): void
  addKinematic(entity: pc.Entity, options?: KinematicOptions): KinematicBody
  /** True when the two entities' shapes intersect right now. */
  overlaps(a: pc.Entity, b: pc.Entity, radius?: number): boolean
  /** Fires once per enter (not every frame). Call update() for it to work. */
  onOverlap(a: pc.Entity, b: pc.Entity, callback: () => void): () => void
  /** Call once per frame, after moving bodies, to dispatch overlap callbacks. */
  update(): void
  destroy(): void
}

interface StaticBox {
  entity: pc.Entity
  shape: BoxShape
  aabb: pc.BoundingBox
}

interface OverlapWatch {
  a: pc.Entity
  b: pc.Entity
  radius: number
  callback: () => void
  inside: boolean
}

export function createPhysicsWorld(options: PhysicsWorldOptions = {}): PhysicsWorld {
  const gravity = options.gravity ?? -22
  const groundY = options.groundY === undefined ? 0 : options.groundY
  const maxFallSpeed = options.maxFallSpeed ?? 45
  const statics: StaticBox[] = []
  const watches: OverlapWatch[] = []

  function refreshAabb(box: StaticBox): pc.BoundingBox {
    const position = box.entity.getPosition()
    const offset = box.shape.offset ?? [0, 0, 0]
    box.aabb.center.set(position.x + offset[0], position.y + offset[1], position.z + offset[2])
    box.aabb.halfExtents.set(box.shape.size[0] / 2, box.shape.size[1] / 2, box.shape.size[2] / 2)
    return box.aabb
  }

  /** Highest static top surface under this XZ column, within reach. */
  function supportHeight(x: number, z: number, radius: number, fromY: number): number | null {
    let best: number | null = null
    for (const box of statics) {
      const aabb = refreshAabb(box)
      const withinX = Math.abs(x - aabb.center.x) <= aabb.halfExtents.x + radius
      const withinZ = Math.abs(z - aabb.center.z) <= aabb.halfExtents.z + radius
      if (!withinX || !withinZ) continue
      const top = aabb.center.y + aabb.halfExtents.y
      if (top <= fromY + 0.001 && (best === null || top > best)) best = top
    }
    return best
  }

  /** Pushes a horizontal position out of any static box it is inside of. */
  function resolveHorizontal(x: number, y: number, z: number, radius: number, height: number): { x: number; z: number } {
    let outX = x
    let outZ = z
    for (const box of statics) {
      const aabb = refreshAabb(box)
      const feet = y
      const head = y + height
      const boxBottom = aabb.center.y - aabb.halfExtents.y
      const boxTop = aabb.center.y + aabb.halfExtents.y
      if (head <= boxBottom || feet >= boxTop) continue

      const dx = outX - aabb.center.x
      const dz = outZ - aabb.center.z
      const overlapX = aabb.halfExtents.x + radius - Math.abs(dx)
      const overlapZ = aabb.halfExtents.z + radius - Math.abs(dz)
      if (overlapX <= 0 || overlapZ <= 0) continue

      // Push out along the shallower axis: that is what makes you slide.
      if (overlapX < overlapZ) outX += Math.sign(dx || 1) * overlapX
      else outZ += Math.sign(dz || 1) * overlapZ
    }
    return { x: outX, z: outZ }
  }

  function entityRadius(entity: pc.Entity, fallback: number): number {
    const scale = entity.getLocalScale()
    return fallback * Math.max(scale.x, scale.z)
  }

  return {
    addStatic(entity, shape) {
      statics.push({ entity, shape, aabb: new pc.BoundingBox() })
    },

    removeStatic(entity) {
      const index = statics.findIndex((box) => box.entity === entity)
      if (index >= 0) statics.splice(index, 1)
    },

    addKinematic(entity, kinematicOptions = {}) {
      const radius = kinematicOptions.radius ?? 0.4
      const height = kinematicOptions.height ?? 1.8
      const stepHeight = kinematicOptions.stepHeight ?? 0.35

      const bodyState: KinematicBody = {
        entity,
        grounded: false,
        velocityY: 0,

        move(velocityX, velocityZ, dt) {
          const position = entity.getPosition()
          let nextX = position.x + velocityX * dt
          let nextZ = position.z + velocityZ * dt

          bodyState.velocityY = Math.max(bodyState.velocityY + gravity * dt, -maxFallSpeed)
          let nextY = position.y + bodyState.velocityY * dt

          const resolved = resolveHorizontal(nextX, position.y, nextZ, radius, height)
          nextX = resolved.x
          nextZ = resolved.z

          // Landing: ground plane or the top of a static box within step reach.
          const support = supportHeight(nextX, nextZ, radius, position.y + stepHeight)
          const floor = Math.max(support ?? Number.NEGATIVE_INFINITY, groundY ?? Number.NEGATIVE_INFINITY)

          if (Number.isFinite(floor) && nextY <= floor) {
            nextY = floor
            bodyState.velocityY = 0
            bodyState.grounded = true
          } else {
            bodyState.grounded = false
          }

          entity.setPosition(nextX, nextY, nextZ)
        },

        teleport(x, y, z) {
          bodyState.velocityY = 0
          bodyState.grounded = false
          entity.setPosition(x, y, z)
        },

        destroy() {
          bodyState.grounded = false
        },
      }
      return bodyState
    },

    overlaps(a, b, radius = 1) {
      const pa = a.getPosition()
      const pb = b.getPosition()
      const reach = entityRadius(a, radius) + entityRadius(b, radius)
      return pa.distance(pb) <= reach
    },

    onOverlap(a, b, callback) {
      const watch: OverlapWatch = { a, b, radius: 1, callback, inside: false }
      watches.push(watch)
      return () => {
        const index = watches.indexOf(watch)
        if (index >= 0) watches.splice(index, 1)
      }
    },

    update() {
      for (const watch of watches) {
        const distance = watch.a.getPosition().distance(watch.b.getPosition())
        const reach = entityRadius(watch.a, watch.radius) + entityRadius(watch.b, watch.radius)
        const inside = distance <= reach
        if (inside && !watch.inside) watch.callback()
        watch.inside = inside
      }
    },

    destroy() {
      statics.length = 0
      watches.length = 0
    },
  }
}
