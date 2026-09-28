/** Dependency-free GLB inventory. Vendored by sync-check; never a second registry.
 * Re-read current bytes on every invocation: replaced models cannot leave stale
 * clip metadata. Only local files are inspected; external URLs are runtime-owned.
 */
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function inspectGlb(bytes) {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) {
    throw new Error('expected a GLB 2.0 header')
  }
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error('GLB length does not match file size')
  let json, binary
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) throw new Error('truncated GLB chunk header')
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4)
    if (length % 4 || offset + 8 + length > bytes.length) throw new Error('invalid GLB chunk length')
    if (offset === 12 && type !== 0x4e4f534a) throw new Error('GLB JSON must be the first chunk')
    const chunk = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === 0x4e4f534a) {
      if (json !== undefined) throw new Error('duplicate GLB JSON chunk')
      json = JSON.parse(chunk.toString('utf8'))
    } else if (type === 0x004e4942) {
      if (binary) throw new Error('duplicate GLB binary chunk')
      binary = chunk
    }
    offset += 8 + length
  }
  if (json?.asset?.version !== '2.0') throw new Error('missing glTF 2.0 asset metadata')
  if (json.animations !== undefined && !Array.isArray(json.animations)) throw new Error('invalid animations array')
  const clips = (json.animations ?? []).map((animation, index) => {
    if (!Array.isArray(animation?.samplers) || !animation.samplers.length ||
        !Array.isArray(animation.channels) || !animation.channels.length) throw new Error(`invalid animation ${index}`)
    const ranges = animation.samplers.map(sampler => timeRange(json, binary, sampler.input))
    const known = ranges.every(range => range !== null)
    const start = known ? Math.min(...ranges.map(range => range[0])) : null
    const end = known ? Math.max(...ranges.map(range => range[1])) : null
    return {
      index, name: animation.name ?? null,
      duration: known ? end - start : null,
      start, end,
      channelCount: animation.channels.length,
      targets: [...new Set(animation.channels.map(channel => channel.target?.path ?? 'extension'))].sort(),
    }
  })
  return { sha256: createHash('sha256').update(bytes).digest('hex'),
    animationCount: clips.length, skinCount: json.skins?.length ?? 0, clips }
}

function timeRange(json, binary, index) {
  const accessor = json.accessors?.[index]
  if (!accessor || accessor.type !== 'SCALAR' || accessor.componentType !== 5126 ||
      !Number.isSafeInteger(accessor.count) || accessor.count < 1) return null
  const min = accessor.min?.[0], max = accessor.max?.[0]
  if (Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max >= min) return [min, max]
  // Read embedded float timestamps if the exporter omitted accessor bounds.
  // External/compressed/sparse data without bounds stays unknown, never zero.
  const view = json.bufferViews?.[accessor.bufferView]
  if (!binary || accessor.sparse || !view || view.buffer !== 0 || json.buffers?.[0]?.uri || view.extensions) return null
  const stride = view.byteStride ?? 4, offset = accessor.byteOffset ?? 0, base = view.byteOffset ?? 0
  if (![stride, offset, base, view.byteLength].every(Number.isSafeInteger) || stride < 4 ||
      stride % 4 || offset < 0 || base < 0 || offset + (accessor.count - 1) * stride + 4 > view.byteLength ||
      base + view.byteLength > binary.length) return null
  let first = Infinity, last = -Infinity
  for (let i = 0; i < accessor.count; i++) {
    const time = binary.readFloatLE(base + offset + i * stride)
    if (!Number.isFinite(time) || time < 0) return null
    first = Math.min(first, time); last = Math.max(last, time)
  }
  return [first, last]
}

/** File or recursive directory; symlinks are not followed. Errors retain paths. */
export function inspectModels(target, root = process.cwd()) {
  const result = { schemaVersion: 1, models: [], errors: [] }
  function visit(path) {
    const display = relative(root, path).replaceAll('\\', '/') || '.'
    try {
      const stat = lstatSync(path)
      if (stat.isSymbolicLink()) return
      if (stat.isDirectory()) {
        for (const entry of readdirSync(path).sort()) visit(join(path, entry))
      } else if (/\.glb$/i.test(path)) {
        result.models.push({ path: display, ...inspectGlb(readFileSync(path)) })
      }
    } catch (error) { result.errors.push({ path: display, error: error.message }) }
  }
  visit(resolve(target))
  return result
}

export function formatModels(result) {
  return result.models.map(model => {
    const clips = model.clips.map(clip => `#${clip.index} ${JSON.stringify(clip.name ?? '(unnamed)')} (${clip.duration === null ? 'duration unknown' : `${Number(clip.duration.toFixed(3))}s`})`)
    return `GLB ${model.path}: ${model.animationCount} clips, ${model.skinCount} skins${clips.length ? '\n  ' + clips.join('; ') : ''}`
  }).concat(result.errors.map(item => `GLB ${item.path}: inspection failed — ${item.error}`)).join('\n')
}

/** Also available in a synced template: node scripts/models.mjs [path] --json. */
export function runInspection(args = process.argv.slice(2)) {
  const positional = args.filter(arg => arg !== '--json')
  if (positional.length > 1 || positional.some(arg => arg.startsWith('--'))) throw new Error('usage: inspect-model [file.glb|directory] [--json]')
  const target = positional[0] ?? 'public'
  if (!existsSync(target)) throw new Error('model path does not exist: ' + target)
  if (lstatSync(target).isFile() && !/\.glb$/i.test(target)) throw new Error('expected a .glb file or directory')
  const result = inspectModels(target)
  console.log(args.includes('--json') ? JSON.stringify(result, null, 2) : formatModels(result) || 'No GLB files found.')
  if (result.errors.length) process.exitCode = 1
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runInspection() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
