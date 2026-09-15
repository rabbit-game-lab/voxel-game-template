import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

export const PROFILE_VERSION = 1
export const WORLD_VERSION = 6
// Bindings are still bootstrap metadata, but a useful Racing manifest needs
// room for several registry/usage paths. Keep it bounded and small enough to
// fit in the bootstrap response rather than retaining the old 4 KiB ceiling.
export const MAX_MANIFEST_BYTES = 16 * 1024
export const SURFACE_IDS = Object.freeze([
  'player',
  'movement',
  'world',
  'rules',
  'camera',
  'assets',
  'presentation',
])

/** Snapshot of every style in Forge topology/world.json v6. */
export const STYLE_STACKS = Object.freeze({
  'scaffold-2d': 'phaser-2d',
  'scaffold-3d': 'playcanvas-3d',
  'platformer-2d': 'phaser-2d',
  'endless-runner-2d': 'phaser-2d',
  'endless-runner-3d': 'playcanvas-3d',
  'platformer-3d': 'playcanvas-3d',
  'racing-3d': 'playcanvas-3d',
  'rpg-3d': 'playcanvas-3d',
  'endless-runner': 'playcanvas-3d',
  foosball: 'phaser-2d',
  'voxel-sandbox': 'playcanvas-3d',
  'flight-arcade': 'playcanvas-3d',
  platformer: 'phaser-2d',
  'racing-arcade': 'playcanvas-3d',
  'city-builder': 'playcanvas-3d',
  'fps-arena': 'playcanvas-3d',
  'tower-defense': 'phaser-2d',
  'car-soccer': 'playcanvas-3d',
})

const PROFILE_KEYS = ['profileVersion', 'worldVersion', 'style', 'surfaces']
const PROFILE_OPTIONAL_KEYS = ['assetBindings']
const TARGET_KEYS = ['path', 'symbols']
const TYPESCRIPT_PATH = /\.(?:ts|tsx|mts)$/
const IDENTIFIER = /^[$A-Z_a-z][$\w]*$/
const BINDING_ID = /^[A-Za-z_$][A-Za-z0-9_$-]{0,63}$/
const PROPERTY_SEGMENT = /^[A-Za-z_$][A-Za-z0-9_$-]{0,63}$/
const SAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const BINDING_SOURCE_PATH = /^src\/(?!rabbit\/)(?!.*(?:^|\/)(?:generated|dist|build)\/)(?!.*(?:^|\/)\.\.?(?:\/|$))[A-Za-z0-9_@+.-]+(?:\/[A-Za-z0-9_@+.-]+)*\.(?:ts|tsx|mts)$/

function plainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactKeys(value, expected, label, failures) {
  if (!plainObject(value)) {
    failures.push(`${label} must be an object`)
    return false
  }
  const actual = Object.keys(value)
  for (const key of expected) {
    if (!actual.includes(key)) failures.push(`${label} is missing "${key}"`)
  }
  for (const key of actual) {
    if (!expected.includes(key)) failures.push(`${label} has unknown property "${key}"`)
  }
  return true
}

function exactKeysWithOptional(value, expected, optional, label, failures) {
  if (!plainObject(value)) {
    failures.push(`${label} must be an object`)
    return false
  }
  const actual = Object.keys(value)
  for (const key of expected) {
    if (!actual.includes(key)) failures.push(`${label} is missing "${key}"`)
  }
  for (const key of actual) {
    if (!expected.includes(key) && !optional.includes(key)) failures.push(`${label} has unknown property "${key}"`)
  }
  return true
}

function isInside(root, candidate) {
  const rel = relative(root, candidate)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function isCanonicalModelAsset(root, candidate) {
  const rel = relative(root, candidate).replaceAll('\\', '/')
  return rel.startsWith('assets/models/') || rel.startsWith('public/assets/models/')
}

/** Remove comments and literal contents while preserving code identifiers. */
function codeOnly(source) {
  let out = ''
  let state = 'code'
  let quote = ''
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    const next = source[i + 1]
    if (state === 'line') {
      if (char === '\n') {
        state = 'code'
        out += '\n'
      } else out += ' '
    } else if (state === 'block') {
      if (char === '*' && next === '/') {
        out += '  '
        i += 1
        state = 'code'
      } else out += char === '\n' ? '\n' : ' '
    } else if (state === 'literal') {
      if (char === '\\') {
        out += '  '
        i += 1
      } else if (char === quote) {
        out += ' '
        state = 'code'
      } else out += char === '\n' ? '\n' : ' '
    } else if (char === '/' && next === '/') {
      out += '  '
      i += 1
      state = 'line'
    } else if (char === '/' && next === '*') {
      out += '  '
      i += 1
      state = 'block'
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char
      out += ' '
      state = 'literal'
    } else out += char
  }
  return out
}

function sourceHasSymbol(source, symbol) {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^$\\w])${escaped}(?=[^$\\w]|$)`, 'm').test(codeOnly(source))
}

function sourceHasSpatialAdapter(source, symbol) {
  const code = codeOnly(source)
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const declaration = new RegExp(`\\bexport\\s+(?:const|let|var)\\s+${escaped}\\s*=\\s*\\{`, 'm')
  const match = declaration.exec(code)
  if (!match) return false
  let depth = 0
  let end = match.index
  for (; end < code.length; end += 1) {
    if (code[end] === '{') depth += 1
    else if (code[end] === '}') {
      depth -= 1
      if (depth === 0) break
    }
  }
  if (depth !== 0) return false
  const body = code.slice(match.index, end + 1)
  const propertyValue = (name) => {
    const property = new RegExp(`(?:^|[,{])\\s*${name}\\s*:\\s*([^,}]+)`, 'm').exec(body)
    if (property) return property[1].trim()
    const method = new RegExp(`(?:^|[,{])\\s*(?:async\\s+)?${name}\\s*\\([^)]*\\)\\s*\\{`, 'm').exec(body)
    return method ? `${name}() {` : null
  }
  const callable = (name) => {
    const value = propertyValue(name)
    if (!value) return false
    if (/^(?:async\s+)?function\b/u.test(value) || /^(?:async\s*)?(?:\([^)]*\)|[$A-Z_a-z][$\w]*)\s*=>/u.test(value)) return true
    if (new RegExp(`^${name}\\s*\\([^)]*\\)\\s*\\{`, 'u').test(value)) return true
    if (!IDENTIFIER.test(value)) return false
    return new RegExp(`(?:function\\s+${value}\\s*\\(|(?:const|let|var)\\s+${value}\\s*=\\s*(?:async\\s*)?(?:function\\b|(?:\\([^)]*\\)|[$A-Z_a-z][$\\w]*)\\s*=>))`, 'u').test(code)
  }
  return /\bversion\s*:/u.test(body) && callable('resolve') && callable('encode')
}

function validateTarget(root, surface, target, index, failures) {
  const label = `topology.surfaces.${surface}[${index}]`
  if (!exactKeys(target, TARGET_KEYS, label, failures)) return

  const path = target.path
  if (typeof path !== 'string' || path.length === 0) {
    failures.push(`${label}.path must be a non-empty string`)
  } else if (
    isAbsolute(path) ||
    path.includes('\\') ||
    path.startsWith('./') ||
    path.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    failures.push(`${label}.path must be a normalized repository-relative path`)
  } else if (!TYPESCRIPT_PATH.test(path)) {
    failures.push(`${label}.path must name a TypeScript source file`)
  } else {
    const rootPath = realpathSync(root)
    const candidate = resolve(rootPath, path)
    if (!isInside(rootPath, candidate) || !existsSync(candidate) || !statSync(candidate).isFile()) {
      failures.push(`${label}.path does not exist: ${path}`)
    } else {
      const realCandidate = realpathSync(candidate)
      if (!isInside(rootPath, realCandidate)) {
        failures.push(`${label}.path resolves outside the template: ${path}`)
      } else if (Array.isArray(target.symbols)) {
        const source = readFileSync(realCandidate, 'utf8')
        for (const symbol of target.symbols) {
          if (typeof symbol === 'string' && IDENTIFIER.test(symbol) && !sourceHasSymbol(source, symbol)) {
            failures.push(`${label}: symbol "${symbol}" does not exist in ${path}`)
          }
        }
      }
    }
  }

  if (!Array.isArray(target.symbols) || target.symbols.length === 0) {
    failures.push(`${label}.symbols must be a non-empty array`)
  } else {
    const seen = new Set()
    for (const symbol of target.symbols) {
      if (typeof symbol !== 'string' || !IDENTIFIER.test(symbol)) {
        failures.push(`${label}.symbols must contain TypeScript identifiers`)
      } else if (seen.has(symbol)) {
        failures.push(`${label}.symbols contains duplicate "${symbol}"`)
      }
      seen.add(symbol)
    }
  }
}

function sourceHasPropertyPath(source, symbol, propertyPath) {
  const code = codeOnly(source)
  let offset = code.search(new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'm'))
  if (offset < 0) return false
  for (const segment of propertyPath) {
    const escaped = segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const next = code.slice(offset).search(new RegExp(`(?:\\.\\s*${escaped}\\b|\\b${escaped}\\b\\s*:)`, 'm'))
    if (next < 0) return false
    offset += next
  }
  return true
}

function staticAssetPaths(source) {
  const paths = []
  const literal = /(?:new\s+URL\s*\(\s*|(?:from|import)\s*)["']([^"']+)["']/g
  for (const match of source.matchAll(literal)) paths.push(match[1])
  return paths
}

function validScalar(value) {
  return value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= 120)
}

function validateDefaults(value, label, failures) {
  if (!plainObject(value) || Object.keys(value).length > 12) {
    failures.push(`${label} must be a bounded object of safe keys`)
    return
  }
  for (const [key, entry] of Object.entries(value)) {
    if (!BINDING_ID.test(key) || SAFE_KEYS.has(key)) failures.push(`${label} contains an unsafe key "${key}"`)
    if (Array.isArray(entry)) {
      if (entry.length > 4 || entry.some((item) => !validScalar(item))) failures.push(`${label}.${key} must contain at most four scalar values`)
    } else if (!validScalar(entry)) failures.push(`${label}.${key} must be a scalar or scalar array`)
  }
}

function validateAssetBinding(root, binding, index, failures) {
  const label = `topology.assetBindings[${index}]`
  if (!plainObject(binding)) {
    failures.push(`${label} must be an object`)
    return
  }
  const actual = Object.keys(binding)
  const required = ['bindingId', 'assetKind', 'registry', 'consumer']
  for (const key of required) if (!actual.includes(key)) failures.push(`${label} is missing "${key}"`)
  for (const key of actual) if (!required.includes(key)) failures.push(`${label} has unknown property "${key}"`)

  if (typeof binding.bindingId !== 'string' || !BINDING_ID.test(binding.bindingId)) {
    failures.push(`${label}.bindingId must be an identifier-like string`)
  }
  if (binding.assetKind !== 'model') failures.push(`${label}.assetKind must be "model"`)

  const registry = binding.registry
  if (!plainObject(registry)) {
    failures.push(`${label}.registry must be an object`)
  } else {
    const keys = Object.keys(registry)
    for (const key of ['path', 'symbol', 'urlProperty']) if (!keys.includes(key)) failures.push(`${label}.registry is missing "${key}"`)
    for (const key of keys) if (!['path', 'symbol', 'urlProperty', 'defaults'].includes(key)) failures.push(`${label}.registry has unknown property "${key}"`)
    if (typeof registry.urlProperty !== 'string' || !BINDING_ID.test(registry.urlProperty) || SAFE_KEYS.has(registry.urlProperty)) failures.push(`${label}.registry.urlProperty must be a safe key`)
    if (registry.defaults !== undefined) validateDefaults(registry.defaults, `${label}.registry.defaults`, failures)
    if (typeof registry.path !== 'string' || !BINDING_SOURCE_PATH.test(registry.path)) failures.push(`${label}.registry.path must be an authorized TypeScript source path`)
    else {
      const path = resolve(realpathSync(root), registry.path)
      if (!existsSync(path) || !statSync(path).isFile() || !isInside(realpathSync(root), path)) failures.push(`${label}.registry.path does not exist: ${registry.path}`)
      else {
        const source = readFileSync(realpathSync(path), 'utf8')
        if (typeof registry.symbol === 'string' && IDENTIFIER.test(registry.symbol) && !sourceHasSymbol(source, registry.symbol)) failures.push(`${label}.registry: symbol "${registry.symbol}" does not exist in ${registry.path}`)
        const expected = ['.glb']
        const staticPaths = staticAssetPaths(source)
        const staticMatches = staticPaths.filter((asset) => expected.some((ext) => asset.toLowerCase().endsWith(ext)))
        if (staticMatches.length === 0) failures.push(`${label}.registry: ${registry.urlProperty} must use a static Vite reference for ${binding.assetKind} assets`)
        for (const asset of staticMatches) {
          const rootPath = realpathSync(root)
          const candidate = asset.startsWith('/')
            ? resolve(rootPath, 'public', asset.slice(1))
            : resolve(rootPath, dirname(registry.path), asset)
          if (asset.includes('://') || !isInside(rootPath, candidate) || !existsSync(candidate) || !statSync(candidate).isFile()) {
            failures.push(`${label}.registry: static asset does not exist inside the template: ${asset}`)
          } else {
            const realCandidate = realpathSync(candidate)
            if (!isInside(rootPath, realCandidate) || !isCanonicalModelAsset(rootPath, realCandidate)) failures.push(`${label}.registry: static asset must be under assets/models or public/assets/models: ${asset}`)
          }
        }
      }
    }
  }

  const usage = binding.consumer
  const usageLabel = `${label}.consumer`
  if (!plainObject(usage)) { failures.push(`${usageLabel} must be an object`); return }
  const requiredUsage = ['kind', 'path', 'symbol', 'propertyPath']
  for (const key of requiredUsage) if (!Object.keys(usage).includes(key)) failures.push(`${usageLabel} is missing "${key}"`)
  for (const key of Object.keys(usage)) if (![...requiredUsage, 'keyProperty', 'defaults', 'positionProperties', 'spatial'].includes(key)) failures.push(`${usageLabel} has unknown property "${key}"`)
  if (usage.kind !== 'selector' && usage.kind !== 'placement') failures.push(`${usageLabel}.kind must be "selector" or "placement"`)
  if (usage.kind === 'placement' && (typeof usage.keyProperty !== 'string' || !BINDING_ID.test(usage.keyProperty) || SAFE_KEYS.has(usage.keyProperty))) failures.push(`${usageLabel}.keyProperty must be a safe key for placement`)
  if (usage.kind === 'selector' && (usage.keyProperty !== undefined || usage.defaults !== undefined || usage.positionProperties !== undefined)) failures.push(`${usageLabel} selector cannot declare placement-only properties`)
  if (usage.kind === 'placement') {
    if (!Array.isArray(usage.positionProperties) || usage.positionProperties.length === 0 || usage.positionProperties.length > 3 || usage.positionProperties.some((part) => typeof part !== 'string' || !BINDING_ID.test(part) || SAFE_KEYS.has(part))) failures.push(`${usageLabel}.positionProperties must contain one to three safe keys`)
  }
  if (usage.spatial !== undefined) {
    const spatialLabel = `${usageLabel}.spatial`
    if (usage.kind !== 'placement') failures.push(`${spatialLabel} is only valid for placement consumers`)
    const spatialShapeValid = exactKeys(usage.spatial, ['version', 'adapter'], spatialLabel, failures)
    if (spatialShapeValid) {
      if (usage.spatial.version !== 1) failures.push(`${spatialLabel}.version must be 1`)
      const adapter = usage.spatial.adapter
      const adapterLabel = `${spatialLabel}.adapter`
      const adapterShapeValid = exactKeys(adapter, ['path', 'symbol'], adapterLabel, failures)
      if (adapterShapeValid) {
        if (typeof adapter.path !== 'string' || !BINDING_SOURCE_PATH.test(adapter.path)) failures.push(`${adapterLabel}.path must be an authorized TypeScript source path`)
        else {
          const path = resolve(realpathSync(root), adapter.path)
          if (!existsSync(path) || !statSync(path).isFile() || !isInside(realpathSync(root), path)) failures.push(`${adapterLabel}.path does not exist: ${adapter.path}`)
          else {
            const source = readFileSync(realpathSync(path), 'utf8')
            if (typeof adapter.symbol !== 'string' || !IDENTIFIER.test(adapter.symbol)) failures.push(`${adapterLabel}.symbol must be a TypeScript identifier`)
            else if (!sourceHasSpatialAdapter(source, adapter.symbol)) failures.push(`${adapterLabel}: symbol "${adapter.symbol}" must export a spatial adapter with version, resolve, and encode`)
          }
        }
      }
    }
  }
  if (usage.defaults !== undefined) validateDefaults(usage.defaults, `${usageLabel}.defaults`, failures)
  if (!Array.isArray(usage.propertyPath) || usage.propertyPath.length === 0) failures.push(`${usageLabel}.propertyPath must be a non-empty array`)
  else if (usage.propertyPath.some((part) => typeof part !== 'string' || !PROPERTY_SEGMENT.test(part))) failures.push(`${usageLabel}.propertyPath must contain property path segments`)
  if (typeof usage.path !== 'string' || !BINDING_SOURCE_PATH.test(usage.path)) failures.push(`${usageLabel}.path must be an authorized TypeScript source path`)
    else {
      const path = resolve(realpathSync(root), usage.path)
      if (!existsSync(path) || !statSync(path).isFile() || !isInside(realpathSync(root), path)) failures.push(`${usageLabel}.path does not exist: ${usage.path}`)
      else {
        const source = readFileSync(realpathSync(path), 'utf8')
        if (typeof usage.symbol === 'string' && IDENTIFIER.test(usage.symbol) && !sourceHasSymbol(source, usage.symbol)) failures.push(`${usageLabel}: symbol "${usage.symbol}" does not exist in ${usage.path}`)
        if (Array.isArray(usage.propertyPath) && typeof usage.symbol === 'string' && IDENTIFIER.test(usage.symbol) && !sourceHasPropertyPath(source, usage.symbol, usage.propertyPath)) failures.push(`${usageLabel}: property path "${usage.propertyPath.join('.')}" does not exist in ${usage.path}`)
      }
    }
}

/** Return diagnostics for the optional Profile v1 extension. */
export function profileFailures({ root, manifest, manifestBytes }) {
  if (manifest?.topology === undefined) return []
  const failures = []
  const topology = manifest.topology

  if (Number.isFinite(manifestBytes) && manifestBytes >= MAX_MANIFEST_BYTES) {
    failures.push(`rabbit.json must be smaller than 16 KiB when topology is declared (found ${manifestBytes} bytes)`)
  }
  if (!exactKeysWithOptional(topology, PROFILE_KEYS, PROFILE_OPTIONAL_KEYS, 'topology', failures)) return failures
  if (topology.profileVersion !== PROFILE_VERSION) failures.push(`topology.profileVersion must be ${PROFILE_VERSION}`)
  if (topology.worldVersion !== WORLD_VERSION) failures.push(`topology.worldVersion must be ${WORLD_VERSION}`)
  if (typeof topology.style !== 'string' || !(topology.style in STYLE_STACKS)) {
    failures.push(`topology.style must exist in world topology v${WORLD_VERSION}`)
  } else if (STYLE_STACKS[topology.style] !== manifest.stack) {
    failures.push(`topology.style "${topology.style}" requires stack "${STYLE_STACKS[topology.style]}"`)
  }

  if (!exactKeys(topology.surfaces, SURFACE_IDS, 'topology.surfaces', failures)) return failures
  for (const surface of SURFACE_IDS) {
    const targets = topology.surfaces[surface]
    if (!Array.isArray(targets)) {
      failures.push(`topology.surfaces.${surface} must be an array`)
      continue
    }
    targets.forEach((target, index) => validateTarget(root, surface, target, index, failures))
  }
  if (topology.assetBindings !== undefined) {
    if (!Array.isArray(topology.assetBindings)) failures.push('topology.assetBindings must be an array')
    else {
      const seen = new Set()
      topology.assetBindings.forEach((binding, index) => {
        validateAssetBinding(root, binding, index, failures)
        if (typeof binding?.bindingId === 'string') {
          if (seen.has(binding.bindingId)) failures.push(`topology.assetBindings contains duplicate "${binding.bindingId}"`)
          seen.add(binding.bindingId)
        }
      })
    }
  }
  return failures
}

/** Resolve one closed surface without adding source or editing instructions. */
export function resolveSurface(manifest, surface) {
  if (!SURFACE_IDS.includes(surface)) throw new Error(`unknown surface "${surface}"`)
  if (!plainObject(manifest?.topology)) throw new Error('rabbit.json has no topology profile')
  if (manifest.topology.profileVersion !== PROFILE_VERSION) {
    throw new Error(`unsupported topology profile version "${manifest.topology.profileVersion}"`)
  }
  const targets = manifest.topology.surfaces?.[surface]
  if (!Array.isArray(targets)) throw new Error(`topology surface "${surface}" is invalid`)
  return targets.map(({ path, symbols }) => ({ path, symbols: [...symbols] }))
}

/** Resolve declarative asset wiring for Root without source discovery. */
export function resolveAssetBindings(manifest) {
  if (!plainObject(manifest?.topology)) throw new Error('rabbit.json has no topology profile')
  if (manifest.topology.profileVersion !== PROFILE_VERSION) throw new Error(`unsupported topology profile version "${manifest.topology.profileVersion}"`)
  return (manifest.topology.assetBindings ?? []).map((binding) => structuredClone(binding))
}
