import * as pc from 'playcanvas'

export type Rgb = readonly [number, number, number]

export interface MeshBuilder {
  positions: number[]
  normals: number[]
  colors: number[]
  indices: number[]
}

const BOX_FACES = [
  { normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { normal: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { normal: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { normal: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
] as const

export function rgb(hex: string): Rgb {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ]
}

export function builder(): MeshBuilder {
  return { positions: [], normals: [], colors: [], indices: [] }
}

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000
  }
}

export function vertexMaterial(noFog = false): pc.StandardMaterial {
  const material = new pc.StandardMaterial()
  material.useLighting = false
  material.diffuse.set(0, 0, 0)
  material.emissive.set(1, 1, 1)
  material.emissiveVertexColor = true
  material.gloss = 0
  material.useFog = !noFog
  material.update()
  return material
}

export function renderMesh(name: string, parent: pc.Entity, mesh: pc.Mesh, material: pc.Material): pc.Entity {
  const entity = new pc.Entity(name)
  entity.addComponent('render')
  const instance = new pc.MeshInstance(mesh, material)
  instance.castShadow = false
  instance.receiveShadow = false
  entity.render!.meshInstances = [instance]
  parent.addChild(entity)
  return entity
}

export function addBox(
  target: MeshBuilder,
  center: readonly [number, number, number],
  size: readonly [number, number, number],
  color: Rgb,
): void {
  const origin = [center[0] - size[0] * 0.5, center[1] - size[1] * 0.5, center[2] - size[2] * 0.5]
  for (const face of BOX_FACES) {
    const vertex = target.positions.length / 3
    const shade = face.normal[1] > 0 ? 1 : face.normal[1] < 0 ? 0.68
      : face.normal[0] < 0 || face.normal[2] < 0 ? 0.82 : 0.9
    for (const corner of face.corners) {
      target.positions.push(
        origin[0] + corner[0] * size[0],
        origin[1] + corner[1] * size[1],
        origin[2] + corner[2] * size[2],
      )
      target.normals.push(...face.normal)
      target.colors.push(
        Math.round(color[0] * shade), Math.round(color[1] * shade),
        Math.round(color[2] * shade), 255,
      )
    }
    target.indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3)
  }
}

export function createMesh(device: pc.GraphicsDevice, data: MeshBuilder): pc.Mesh {
  const mesh = new pc.Mesh(device)
  mesh.setPositions(new Float32Array(data.positions))
  mesh.setNormals(new Float32Array(data.normals))
  mesh.setColors32(new Uint8Array(data.colors))
  mesh.setIndices(new Uint32Array(data.indices))
  mesh.update(pc.PRIMITIVE_TRIANGLES)
  return mesh
}

export function createSkyDome(
  device: pc.GraphicsDevice,
  radius: number,
  zenith: Rgb,
  horizon: Rgb,
): pc.Mesh {
  const data = builder()
  const rings = 10
  const segments = 32
  for (let ring = 0; ring <= rings; ring += 1) {
    const t = ring / rings
    const phi = t * Math.PI * 0.52
    const y = Math.cos(phi) * radius
    const ringRadius = Math.sin(phi) * radius
    const blend = Math.min(1, t * 1.08)
    const shade = zenith.map((value, index) => Math.round(value + (horizon[index] - value) * blend)) as number[]
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = segment / segments * Math.PI * 2
      data.positions.push(Math.cos(angle) * ringRadius, y, Math.sin(angle) * ringRadius)
      data.normals.push(0, -1, 0)
      data.colors.push(shade[0], shade[1], shade[2], 255)
    }
  }
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = ring * (segments + 1) + segment
      const b = a + segments + 1
      data.indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  return createMesh(device, data)
}
