/**
 * SDK MODULE: spatial — bounded, engine-free decoration placement.
 *
 * Templates resolve their moving world into PlacementPoint values. Eve chooses
 * a stable point id and this module checks the model's verified bounds before
 * producing the transform the template adapter applies. It intentionally
 * knows no game names, coordinates, or engine types.
 *
 * Typical use:
 *   const bounds = measureGlbBounds(bytes, { correction: model.correction })
 *   const result = choosePlacementPoint(points, bounds, { meaning: 'curve-side' })
 *   if (result.ok) adapter.encode({ point: result.point, fit: result.fit, bounds, modelKey })
 *
 * ⛔ AGENTS MUST NOT EDIT THIS FILE after it is vendored into a template.
 */

export type Vec3 = readonly [number, number, number]
export type Quat = readonly [number, number, number, number]
export type Mat4 = readonly [
  number, number, number, number, number, number, number, number,
  number, number, number, number, number, number, number, number,
]

export interface PlacementPoint {
  /** Stable within a live world revision; never an array index. */
  id: string
  /** Human-readable semantic role, used for exact capability matching. */
  meaning?: string
  position: Vec3
  /** World yaw in degrees, increasing with the template's forward direction. */
  rotation: number
  /** Full available dimensions (width, height, depth), centred on position. */
  space: Vec3
  /** Null means free; any other value reserves this point. */
  occupiedBy: string | null
  /** Changes when a moving template invalidates its resolved points. */
  revision: string
}

export interface ModelBounds {
  min: Vec3
  max: Vec3
  size: Vec3
  /** True only when every static mesh vertex was inspected successfully. */
  verified: true
  vertexCount: number
}

export interface PlacementRequest {
  pointId?: string
  meaning?: string
  /** Desired world dimensions. Uniform model scaling is still required. */
  explicitSize?: Vec3
  /** Explicit authored scale. A value is never enlarged by the fitter. */
  explicitScale?: number
}

export interface PlacementFit {
  pointId: string
  position: Vec3
  rotation: number
  scale: number
  /** Bounds after the returned transform, useful as write evidence. */
  worldBounds: { min: Vec3; max: Vec3; size: Vec3 }
}

export type PlacementFailureCode =
  | 'invalid_point'
  | 'unknown_point'
  | 'meaning_mismatch'
  | 'unavailable'
  | 'occupied'
  | 'unverified_bounds'
  | 'invalid_bounds'
  | 'explicit_size_not_uniform'
  | 'explicit_size_too_large'
  | 'explicit_scale_too_large'
  | 'no_fit'

export interface PlacementFailure {
  ok: false
  code: PlacementFailureCode
  message: string
}

export interface PlacementSuccess {
  ok: true
  point: PlacementPoint
  fit: PlacementFit
}

export type PlacementResult = PlacementSuccess | PlacementFailure

const EPSILON = 1e-8
const MAX_VERTICES = 10_000_000
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u

function finiteVector(value: unknown, length = 3): value is Vec3 {
  return Array.isArray(value) && value.length === length && value.every((item) => typeof item === 'number' && Number.isFinite(item))
}

function finiteQuat(value: unknown): value is Quat {
  return finiteVector(value, 4) && Math.hypot(...value) > EPSILON
}

function dimensions(min: Vec3, max: Vec3): Vec3 {
  return [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
}

function validBounds(bounds: ModelBounds | null | undefined): bounds is ModelBounds {
  return Boolean(bounds?.verified && finiteVector(bounds.min) && finiteVector(bounds.max) &&
    finiteVector(bounds.size) && bounds.vertexCount > 0 && bounds.vertexCount <= MAX_VERTICES &&
    bounds.min.every((value, index) => value <= bounds.max[index]) &&
    bounds.size.every((value, index) => Math.abs(value - (bounds.max[index] - bounds.min[index])) < 1e-5))
}

/** Validate one template-resolved point. Invalid metadata must be discarded. */
export function validatePlacementPoint(point: unknown): string[] {
  const failures: string[] = []
  if (!point || typeof point !== 'object' || Array.isArray(point)) return ['point must be an object']
  const value = point as Record<string, unknown>
  if (typeof value.id !== 'string' || !ID.test(value.id)) failures.push('id must be a stable identifier')
  if (value.meaning !== undefined && (typeof value.meaning !== 'string' || value.meaning.trim().length === 0 || value.meaning.length > 120)) failures.push('meaning must be a bounded non-empty string')
  if (!finiteVector(value.position)) failures.push('position must contain three finite numbers')
  if (typeof value.rotation !== 'number' || !Number.isFinite(value.rotation)) failures.push('rotation must be finite degrees')
  if (!finiteVector(value.space) || value.space.some((item) => item <= EPSILON)) failures.push('space must contain three positive dimensions')
  if (typeof value.occupiedBy === 'string' && !ID.test(value.occupiedBy)) failures.push('occupiedBy must be a stable identifier or null')
  else if (value.occupiedBy !== null && typeof value.occupiedBy !== 'string') failures.push('occupiedBy must be a string or null')
  if (typeof value.revision !== 'string' || value.revision.length === 0 || value.revision.length > 160) failures.push('revision must be a bounded non-empty string')
  return failures
}

/** Validate a complete point set, including duplicate stable ids. */
export function validatePlacementPoints(points: unknown): string[] {
  if (!Array.isArray(points)) return ['points must be an array']
  const failures: string[] = []
  const ids = new Set<string>()
  points.forEach((point, index) => {
    for (const failure of validatePlacementPoint(point)) failures.push(`points[${index}].${failure}`)
    const id = (point as Record<string, unknown> | null)?.id
    if (typeof id === 'string') {
      if (ids.has(id)) failures.push(`points contains duplicate id "${id}"`)
      ids.add(id)
    }
  })
  return failures
}

function normalizedQuat(q: Quat): Quat {
  const length = Math.hypot(...q)
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length]
}

function yawQuat(degrees: number): Quat {
  const radians = degrees * Math.PI / 180
  return [0, Math.sin(radians / 2), 0, Math.cos(radians / 2)]
}

function rotate(q: Quat, point: Vec3): Vec3 {
  const [x, y, z, w] = normalizedQuat(q)
  const uv: Vec3 = [y * point[2] - z * point[1], z * point[0] - x * point[2], x * point[1] - y * point[0]]
  const uuv: Vec3 = [y * uv[2] - z * uv[1], z * uv[0] - x * uv[2], x * uv[1] - y * uv[0]]
  return [point[0] + 2 * (w * uv[0] + uuv[0]), point[1] + 2 * (w * uv[1] + uuv[1]), point[2] + 2 * (w * uv[2] + uuv[2])]
}

function corners(bounds: ModelBounds, rotation: Quat, scale: number): Vec3[] {
  const output: Vec3[] = []
  for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
    const rotated = rotate(rotation, [x * scale, y * scale, z * scale])
    output.push(rotated)
  }
  return output
}

function enclosing(points: Vec3[]): { min: Vec3; max: Vec3; size: Vec3 } {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const point of points) for (let axis = 0; axis < 3; axis += 1) {
    min[axis] = Math.min(min[axis], point[axis])
    max[axis] = Math.max(max[axis], point[axis])
  }
  return { min: min as unknown as Vec3, max: max as unknown as Vec3, size: dimensions(min as unknown as Vec3, max as unknown as Vec3) }
}

function fitPoint(point: PlacementPoint, bounds: ModelBounds, request: PlacementRequest): PlacementResult {
  if (validatePlacementPoint(point).length > 0) return { ok: false, code: 'invalid_point', message: `point "${point.id}" is invalid` }
  if (point.occupiedBy !== null) return { ok: false, code: 'occupied', message: `point "${point.id}" is occupied` }
  if (!validBounds(bounds)) return { ok: false, code: 'unverified_bounds', message: 'model bounds were not verified' }
  const base = dimensions(bounds.min, bounds.max)
  if (base.some((value) => value <= EPSILON)) return { ok: false, code: 'invalid_bounds', message: 'model bounds have an empty axis' }
  let scale = request.explicitScale ?? 1
  if (!Number.isFinite(scale) || scale <= EPSILON) return { ok: false, code: 'invalid_bounds', message: 'model scale must be positive' }
  if (request.explicitSize !== undefined) {
    if (!finiteVector(request.explicitSize) || request.explicitSize.some((value) => value <= EPSILON)) return { ok: false, code: 'explicit_size_not_uniform', message: 'explicit size must be three positive numbers' }
    const ratios = request.explicitSize.map((value, index) => value / base[index])
    if (Math.max(...ratios) - Math.min(...ratios) > 1e-5 * Math.max(1, ...ratios)) return { ok: false, code: 'explicit_size_not_uniform', message: 'model placement cannot deform a non-uniform requested size' }
    scale *= ratios[0]
  }
  const rotation = yawQuat(point.rotation)
  const orientedUnit = enclosing(corners(bounds, rotation, 1)).size
  const available = point.space
  const fitScale = Math.min(...available.map((value, index) => value / orientedUnit[index]))
  if (request.explicitSize !== undefined && scale > fitScale + 1e-7) return { ok: false, code: 'explicit_size_too_large', message: 'explicit model size does not fit this point' }
  if (request.explicitScale !== undefined && scale > fitScale + 1e-7) return { ok: false, code: 'explicit_scale_too_large', message: 'explicit model scale does not fit this point' }
  scale = Math.min(scale, fitScale)
  if (scale <= EPSILON) return { ok: false, code: 'no_fit', message: 'model has no positive fit in this point' }
  const local = enclosing(corners(bounds, rotation, scale))
  const position: Vec3 = [point.position[0] - (local.min[0] + local.max[0]) / 2, point.position[1] - local.min[1], point.position[2] - (local.min[2] + local.max[2]) / 2]
  const worldBounds = { min: [position[0] + local.min[0], position[1] + local.min[1], position[2] + local.min[2]] as Vec3, max: [position[0] + local.max[0], position[1] + local.max[1], position[2] + local.max[2]] as Vec3, size: local.size }
  return { ok: true, point, fit: { pointId: point.id, position, rotation: point.rotation, scale, worldBounds } } }

/** Fit a verified static model at one already selected point. */
export function fitPlacement(point: PlacementPoint, bounds: ModelBounds, request: PlacementRequest = {}): PlacementResult {
  return fitPoint(point, bounds, request)
}

/** Short adapter-facing name for fitting a static model at one point. */
export function fitModelToPoint(bounds: ModelBounds, point: PlacementPoint, requestedSize?: Vec3): PlacementResult {
  return fitPoint(point, bounds, requestedSize === undefined ? {} : { explicitSize: requestedSize })
}

/** Compatibility alias for consumers that call the validator by its capability name. */
export const validateSpatialPoints = validatePlacementPoints

/** Deterministically select the first available, unoccupied point that fits. */
export function choosePlacementPoint(points: readonly PlacementPoint[], bounds: ModelBounds, request: PlacementRequest = {}): PlacementResult {
  const pointFailures = validatePlacementPoints(points)
  if (pointFailures.length > 0) return { ok: false, code: 'invalid_point', message: 'placement point metadata is invalid' }
  if (request.pointId !== undefined && !points.some((point) => point.id === request.pointId)) return { ok: false, code: 'unknown_point', message: `point "${request.pointId}" does not exist` }
  if (request.pointId !== undefined && request.meaning !== undefined) {
    const point = points.find((candidate) => candidate.id === request.pointId)
    if (point && point.meaning !== request.meaning) return { ok: false, code: 'meaning_mismatch', message: `point "${request.pointId}" does not have meaning "${request.meaning}"` }
  }
  const candidates = points.filter((point) => (request.pointId === undefined || point.id === request.pointId) && (request.meaning === undefined || point.meaning === request.meaning))
  if (candidates.length === 0) return { ok: false, code: request.pointId === undefined ? 'unknown_point' : 'meaning_mismatch', message: request.pointId === undefined ? 'no point matches the requested meaning' : `point "${request.pointId}" does not have the requested meaning` }
  let last: PlacementFailure = { ok: false, code: 'no_fit', message: 'no compatible point is available' }
  for (const point of candidates) {
    if (validatePlacementPoint(point).length > 0) { last = { ok: false, code: 'invalid_point', message: `point "${point.id}" is invalid` }; continue }
    if (point.occupiedBy !== null) { last = { ok: false, code: 'occupied', message: `point "${point.id}" is occupied` }; continue }
    const result = fitPoint(point, bounds, request)
    if (result.ok) return result
    last = result
  }
  return last
}

interface GlbJson { scene?: number; scenes?: { nodes?: number[] }[]; animations?: unknown[]; extensionsUsed?: string[]; nodes?: { mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; skin?: number; extensions?: Record<string, unknown> }[]; meshes?: { primitives?: { attributes?: { POSITION?: number }; targets?: unknown[]; extensions?: Record<string, unknown> }[]; extensions?: Record<string, unknown> }[]; accessors?: { bufferView?: number; byteOffset?: number; componentType?: number; count?: number; type?: string; min?: number[]; max?: number[]; sparse?: unknown }[]; bufferViews?: { buffer?: number; byteOffset?: number; byteLength?: number; byteStride?: number }[]; buffers?: { byteLength?: number; uri?: string }[]; }

const UNSUPPORTED_GEOMETRY_EXTENSIONS = new Set(['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'EXT_mesh_gpu_instancing'])

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = Array(16).fill(0) as number[]
  for (let column = 0; column < 4; column += 1) for (let row = 0; row < 4; row += 1) for (let k = 0; k < 4; k += 1) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k]
  return out as unknown as Mat4
}
function identity(): Mat4 { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }
function nodeMatrix(node: NonNullable<GlbJson['nodes']>[number]): Mat4 {
  if (node.matrix !== undefined) {
    if (!Array.isArray(node.matrix) || node.matrix.length !== 16 || !node.matrix.every((value) => Number.isFinite(value))) throw new Error('unverified_bounds: invalid node matrix')
    const matrix = node.matrix as unknown as Mat4
    if (!affine(matrix)) throw new Error('unverified_bounds: node matrix is not affine')
    return matrix
  }
  if (node.translation !== undefined && !finiteVector(node.translation)) throw new Error('unverified_bounds: invalid node translation')
  if (node.scale !== undefined && !finiteVector(node.scale)) throw new Error('unverified_bounds: invalid node scale')
  if (node.rotation !== undefined && !finiteQuat(node.rotation)) throw new Error('unverified_bounds: invalid node rotation')
  const t = finiteVector(node.translation) ? node.translation : [0, 0, 0]
  const s = finiteVector(node.scale) ? node.scale : [1, 1, 1]
  const q = finiteQuat(node.rotation) ? normalizedQuat(node.rotation) : [0, 0, 0, 1]
  const [x, y, z, w] = q
  return [
    (1 - 2 * y * y - 2 * z * z) * s[0], (2 * x * y - 2 * z * w) * s[0], (2 * x * z + 2 * y * w) * s[0], 0,
    (2 * x * y + 2 * z * w) * s[1], (1 - 2 * x * x - 2 * z * z) * s[1], (2 * y * z - 2 * x * w) * s[1], 0,
    (2 * x * z - 2 * y * w) * s[2], (2 * y * z + 2 * x * w) * s[2], (1 - 2 * x * x - 2 * y * y) * s[2], 0,
    t[0], t[1], t[2], 1,
  ]
}
function transform(matrix: Mat4, point: Vec3): Vec3 { return [matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12], matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13], matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14]] }
function affine(matrix: Mat4): boolean { return Math.abs(matrix[3]) < EPSILON && Math.abs(matrix[7]) < EPSILON && Math.abs(matrix[11]) < EPSILON && Math.abs(matrix[15] - 1) < EPSILON }

export interface ModelCorrection {
  position?: Vec3
  /** Euler degrees, in XYZ order, matching PlayCanvas model corrections. */
  rotation?: Vec3
  scale?: number | Vec3
}

export interface GlbBoundsOptions { correction?: Mat4 | ModelCorrection; scene?: number }

/**
 * Decode static POSITION vertices from a binary GLB and include every node's
 * transform. Sparse accessors, compressed/quantized attributes, morph targets,
 * and skinned nodes are rejected: guessing their bounds would be unsafe.
 */
export function measureGlbBounds(input: ArrayBuffer | Uint8Array, options: GlbBoundsOptions | Mat4 | ModelCorrection = {}): ModelBounds {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  if (bytes.byteLength < 20 || new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true) !== 0x46546c67) throw new Error('unverified_bounds: invalid GLB header')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const declared = view.getUint32(8, true)
  if (view.getUint32(4, true) !== 2 || declared !== bytes.byteLength) throw new Error('unverified_bounds: unsupported GLB version or length')
  let offset = 12; let json: GlbJson | undefined; let bin: Uint8Array | undefined
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset, true); const type = view.getUint32(offset + 4, true); offset += 8
    if (length > bytes.byteLength - offset) throw new Error('unverified_bounds: truncated GLB chunk')
    const chunk = bytes.subarray(offset, offset + length); offset += length
    if (type === 0x4e4f534a) {
      try { json = JSON.parse(new TextDecoder().decode(chunk).replace(/\0+$/u, '').trim()) as GlbJson } catch { throw new Error('unverified_bounds: invalid GLB JSON') }
    }
    if (type === 0x004e4942) bin = chunk
  }
  if (!json || !bin || !Array.isArray(json.nodes) || !Array.isArray(json.meshes) || !Array.isArray(json.accessors) || !Array.isArray(json.bufferViews) || !Array.isArray(json.buffers)) throw new Error('unverified_bounds: incomplete GLB')
  if (json.nodes.some((node) => !node || typeof node !== 'object') || json.meshes.some((mesh) => !mesh || typeof mesh !== 'object') || json.accessors.some((accessor) => !accessor || typeof accessor !== 'object') || json.bufferViews.some((bufferView) => !bufferView || typeof bufferView !== 'object') || json.buffers.some((buffer) => !buffer || typeof buffer !== 'object')) throw new Error('unverified_bounds: malformed GLB metadata')
  if (json.animations?.length) throw new Error('unverified_bounds: animated models are not static decorations')
  if (json.extensionsUsed?.some((extension) => UNSUPPORTED_GEOMETRY_EXTENSIONS.has(extension))) throw new Error('unverified_bounds: compressed or instanced geometry is unsupported')
  if (json.buffers.length !== 1 || json.buffers[0]?.uri !== undefined || !Number.isInteger(json.buffers[0]?.byteLength) || json.buffers[0]!.byteLength! <= 0 || json.buffers[0]!.byteLength! > bin.byteLength) throw new Error('unverified_bounds: GLB buffer metadata is invalid')
  for (const bufferView of json.bufferViews) {
    if (bufferView.buffer !== 0 || !Number.isInteger(bufferView.byteOffset ?? 0) || (bufferView.byteOffset ?? 0) < 0 || !Number.isInteger(bufferView.byteLength) || bufferView.byteLength! <= 0 || (bufferView.byteOffset ?? 0) + bufferView.byteLength! > bin.byteLength) throw new Error('unverified_bounds: buffer view metadata is invalid')
  }
  if (json.accessors.some((accessor) => accessor.sparse !== undefined)) throw new Error('unverified_bounds: sparse POSITION accessors are unsupported')
  const readPosition = (index: number): Vec3[] => {
    const accessor = json.accessors![index]; const bufferView = accessor && json.bufferViews![accessor.bufferView ?? -1]
    if (!accessor || !bufferView || bufferView.buffer !== 0 || accessor.componentType !== 5126 || accessor.type !== 'VEC3' || !Number.isInteger(accessor.count) || accessor.count! <= 0 || accessor.count! > MAX_VERTICES) throw new Error('unverified_bounds: POSITION accessor is not plain float VEC3')
    if (accessor.byteOffset !== undefined && (!Number.isInteger(accessor.byteOffset) || accessor.byteOffset < 0)) throw new Error('unverified_bounds: invalid accessor offset')
    const stride = bufferView.byteStride ?? 12; if (!Number.isInteger(stride) || stride < 12 || stride % 4 !== 0) throw new Error('unverified_bounds: invalid POSITION stride')
    const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0); const end = start + (accessor.count! - 1) * stride + 12
    if (!Number.isInteger(start) || start < 0 || end > (bufferView.byteOffset ?? 0) + (bufferView.byteLength ?? 0)) throw new Error('unverified_bounds: POSITION exceeds its buffer view')
    const data = new DataView(bin!.buffer, bin!.byteOffset, bin!.byteLength); const result: Vec3[] = []
    for (let vertex = 0; vertex < accessor.count!; vertex += 1) { const at = start + vertex * stride; if (at < 0 || at + 12 > bin!.byteLength) throw new Error('unverified_bounds: POSITION is outside BIN'); const value: Vec3 = [data.getFloat32(at, true), data.getFloat32(at + 4, true), data.getFloat32(at + 8, true)]; if (!value.every(Number.isFinite)) throw new Error('unverified_bounds: non-finite POSITION'); result.push(value) }
    return result
  }
  const config = (Array.isArray(options)
    ? { correction: options as Mat4 }
    : ('correction' in options || 'scene' in options ? options : { correction: options })) as GlbBoundsOptions
  const nodes = json.nodes
  const sceneIndex = config.scene ?? json.scene ?? 0
  if (!Number.isInteger(sceneIndex) || sceneIndex < 0 || (json.scenes !== undefined && !json.scenes[sceneIndex])) throw new Error('unverified_bounds: invalid scene index')
  const roots = json.scenes?.[sceneIndex]?.nodes
  const rootNodes = json.scenes ? (roots ?? []) : nodes.map((_, index) => index).filter((index) => !nodes.some((node) => node.children?.includes(index)))
  const parents = new Map<number, number>()
  for (const [index, node] of nodes.entries()) {
    if (node.children !== undefined && (!Array.isArray(node.children) || node.children.some((child) => !Number.isInteger(child) || child < 0 || child >= nodes.length))) throw new Error('unverified_bounds: invalid node children')
    if (node.mesh !== undefined && (!Number.isInteger(node.mesh) || node.mesh < 0 || node.mesh >= json.meshes.length)) throw new Error('unverified_bounds: invalid node mesh')
    for (const child of node.children ?? []) {
      if (parents.has(child)) throw new Error('unverified_bounds: node has multiple parents')
      parents.set(child, index)
    }
  }
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity]; let vertexCount = 0
  const visiting = new Set<number>()
  const walk = (index: number, parent: Mat4) => {
    if (!nodes[index] || visiting.has(index)) throw new Error('unverified_bounds: cyclic or invalid node graph')
    visiting.add(index); const node = nodes[index]; const matrix = multiply(parent, nodeMatrix(node))
    if (node.skin !== undefined) throw new Error('unverified_bounds: skinned models are not static decorations')
    if (node.mesh !== undefined) for (const primitive of json.meshes![node.mesh].primitives ?? []) {
      if (primitive.targets?.length || primitive.extensions && Object.keys(primitive.extensions).some((extension) => UNSUPPORTED_GEOMETRY_EXTENSIONS.has(extension)) || primitive.attributes?.POSITION === undefined) throw new Error('unverified_bounds: mesh has no plain POSITION or has unsupported geometry')
      for (const point of readPosition(primitive.attributes.POSITION)) {
        const transformed = transform(matrix, point); vertexCount += 1
        for (let axis = 0; axis < 3; axis += 1) { min[axis] = Math.min(min[axis], transformed[axis]); max[axis] = Math.max(max[axis], transformed[axis]) }
      }
    }
    for (const child of node.children ?? []) walk(child, matrix)
    visiting.delete(index)
  }
  if (!rootNodes || rootNodes.some((root) => !Number.isInteger(root) || root < 0 || root >= nodes.length)) throw new Error('unverified_bounds: invalid scene roots')
  for (const root of rootNodes) {
    const correction = config.correction
    const matrix = correction ? (Array.isArray(correction) ? correction as Mat4 : modelCorrectionMatrix(correction as ModelCorrection)) : identity()
    if (!affine(matrix) || matrix.some((value) => !Number.isFinite(value))) throw new Error('unverified_bounds: invalid correction matrix')
    walk(root, matrix)
  }
  if (vertexCount === 0) throw new Error('unverified_bounds: GLB has no static POSITION vertices')
  const measured = { min: min as unknown as Vec3, max: max as unknown as Vec3, size: dimensions(min as unknown as Vec3, max as unknown as Vec3) }
  if (measured.size.some((value) => value <= EPSILON)) throw new Error('invalid_bounds: GLB bounds have an empty axis')
  return { ...measured, verified: true, vertexCount }
}

/** Build a correction matrix from the same transform shape used by adapters. */
export function correctionMatrix(transformValue: Partial<{ position: Vec3; rotation: Quat; scale: Vec3 }> = {}): Mat4 {
  return nodeMatrix({ translation: transformValue.position as number[] | undefined, rotation: transformValue.rotation as number[] | undefined, scale: transformValue.scale as number[] | undefined })
}

/** Convert the adapter's Euler-degree correction metadata into a GLB matrix. */
export function modelCorrectionMatrix(correction: ModelCorrection = {}): Mat4 {
  if (correction.rotation !== undefined && !finiteVector(correction.rotation)) throw new Error('unverified_bounds: invalid model correction')
  if (correction.position !== undefined && !finiteVector(correction.position)) throw new Error('unverified_bounds: invalid model correction')
  if (correction.scale !== undefined && (typeof correction.scale !== 'number' && !finiteVector(correction.scale))) throw new Error('unverified_bounds: invalid model correction')
  const radians = (correction.rotation ?? [0, 0, 0]).map((value) => value * Math.PI / 180) as unknown as Vec3
  const [sx, sy, sz] = typeof correction.scale === 'number' ? [correction.scale, correction.scale, correction.scale] : (correction.scale ?? [1, 1, 1])
  if (![...radians, sx, sy, sz, ...(correction.position ?? [0, 0, 0])].every(Number.isFinite) || [sx, sy, sz].some((value) => Math.abs(value) <= EPSILON)) throw new Error('unverified_bounds: invalid model correction')
  const [x, y, z] = radians
  const cx = Math.cos(x); const sxr = Math.sin(x); const cy = Math.cos(y); const syr = Math.sin(y); const cz = Math.cos(z); const szr = Math.sin(z)
  const rotation: Mat4 = [cy * cz, cy * szr, -syr, 0, sxr * syr * cz - cx * szr, sxr * syr * szr + cx * cz, sxr * cy, 0, cx * syr * cz + sxr * szr, cx * syr * szr - sxr * cz, cx * cy, 0, 0, 0, 0, 1]
  const scaled: Mat4 = [rotation[0] * sx, rotation[1] * sx, rotation[2] * sx, 0, rotation[4] * sy, rotation[5] * sy, rotation[6] * sy, 0, rotation[8] * sz, rotation[9] * sz, rotation[10] * sz, 0, ...(correction.position ?? [0, 0, 0]), 1] as unknown as Mat4
  return scaled
}
