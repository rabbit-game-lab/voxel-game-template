#!/usr/bin/env node
/**
 * rabbit-check — vendored from rabbit-game-kit (sync with `rabbit-kit sync-check`).
 * ⛔ AGENTS MUST NOT EDIT THIS FILE.
 * The same validation runs locally, in CI and in the import Contract Gate:
 *   1. Contract layout (required files + valid rabbit.json, stack-aware).
 *   2. package.json: scripts, engines.node >= 24, no install hooks.
 *   3. vite.config: cors: true in server and preview (opaque-origin iframe).
 *   4. tsc --noEmit.
 *   5. Forbidden API lint in src/ (except src/rabbit/).
 *   6. File size limit (≤400 lines in src/).
 *   7. Asset weight under public/ — warns, never fails.
 *   8. No tracked build artifacts (dist/).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { profileFailures } from './profile.mjs'
import { integrityFailures } from './integrity.mjs'

const root = process.cwd()
const failures = []
/** Advisory only: printed, never fatal. Import size is a budget, not a rule. */
const warnings = []

// --- 1. Layout ---
let manifest = null
let stack = null
let manifestSource = null
try {
  manifestSource = readFileSync(join(root, 'rabbit.json'), 'utf8')
  manifest = JSON.parse(manifestSource)
  stack = manifest.stack ?? null
} catch {
  // rabbit.json problems are reported below.
}

const STACK_FILES = {
  'phaser-2d': ['src/scenes/index.ts'],
  'playcanvas-3d': ['src/systems/loop.ts'],
}
const SUPPORTED_STACKS = new Set(Object.keys(STACK_FILES))
const EMBED_CAPABILITIES = ['audio', 'pointerLock', 'storage']

const requiredFiles = [
  'rabbit.json',
  '.rabbit-kit.json',
  'AGENTS.md',
  'index.html',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'src/main.ts',
  'src/game.config.ts',
  'src/rabbit/sdk.ts',
  ...(STACK_FILES[stack] ?? []),
]
for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`layout: missing ${file}`)
}

try {
  manifest ??= JSON.parse(readFileSync(join(root, 'rabbit.json'), 'utf8'))
  if (manifest.contract !== 1) failures.push('rabbit.json: "contract" must be 1')
  if (!SUPPORTED_STACKS.has(manifest.stack)) {
    failures.push(`rabbit.json: "stack" must be one of ${[...SUPPORTED_STACKS].join(', ')}`)
  }
  if (typeof manifest.embed !== 'object' || manifest.embed === null) {
    failures.push('rabbit.json: missing "embed"')
  } else {
    for (const capability of EMBED_CAPABILITIES) {
      if (typeof manifest.embed[capability] !== 'boolean') {
        failures.push(`rabbit.json: "embed.${capability}" must be boolean`)
      }
    }
  }
  failures.push(...profileFailures({
    root,
    manifest,
    manifestBytes: Buffer.byteLength(manifestSource ?? '', 'utf8'),
  }).map((failure) => `rabbit.json: ${failure}`))
} catch (error) {
  failures.push(`rabbit.json: invalid (${error.message})`)
}

failures.push(...integrityFailures(root, stack).map(failure => 'kit: ' + failure))

// --- 2. package.json: scripts, node engine, no install hooks ---
const INSTALL_HOOKS = ['preinstall', 'install', 'postinstall', 'prepare']

try {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const scripts = pkg.scripts ?? {}

  for (const script of ['dev', 'check', 'build']) {
    if (typeof scripts[script] !== 'string') failures.push(`package.json: missing "${script}" script`)
  }
  if (typeof scripts.dev === 'string' && !scripts.dev.includes('--host')) {
    failures.push('package.json: "dev" must run vite with --host (the Studio iframe is remote)')
  }
  for (const hook of INSTALL_HOOKS) {
    if (scripts[hook] !== undefined) failures.push(`package.json: install hook "${hook}" is forbidden`)
  }

  const nodeEngine = pkg.engines?.node
  const major = typeof nodeEngine === 'string' ? Number(nodeEngine.match(/\d+/)?.[0]) : NaN
  if (!Number.isFinite(major) || major < 24) {
    failures.push(`package.json: engines.node must allow >=24 (found ${nodeEngine ?? 'nothing'})`)
  }
} catch (error) {
  failures.push(`package.json: invalid (${error.message})`)
}

// --- 3. vite.config: cors in server and preview ---
// The game runs in an iframe sandboxed WITHOUT allow-same-origin, so its origin
// is opaque ("null") and module scripts are CORS-blocked unless the Vite server
// answers Access-Control-Allow-Origin. Missing this = white iframe in Studio.
const viteConfig = ['vite.config.ts', 'vite.config.mts', 'vite.config.js', 'vite.config.mjs']
  .map((name) => join(root, name))
  .find((path) => existsSync(path))

if (!viteConfig) {
  failures.push('layout: missing vite.config.ts')
} else {
  const source = readFileSync(viteConfig, 'utf8')
  for (const section of ['server', 'preview']) {
    // Take the section's own braces so a `cors` in another block can't satisfy it.
    const start = source.search(new RegExp(`\\b${section}\\s*:\\s*\\{`))
    let body = null
    if (start !== -1) {
      let depth = 0
      for (let i = source.indexOf('{', start); i < source.length; i += 1) {
        if (source[i] === '{') depth += 1
        else if (source[i] === '}' && (depth -= 1) === 0) {
          body = source.slice(start, i)
          break
        }
      }
    }
    if (body === null || !/\bcors\s*:\s*true\b/.test(body)) {
      failures.push(`vite.config: ${section} needs "cors: true" (sandboxed iframe has an opaque origin)`)
    }
  }
}

// --- 4. tsc --noEmit ---
// The local tsc, run with this same node: no npx (it would silently fetch
// TypeScript from the network) and no shell (`npx.cmd` cannot be spawned
// without one on Windows, and a shell means unescaped args — DEP0190).
const tscBin = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
if (!existsSync(tscBin)) {
  failures.push('deps not installed — run `npm ci` before check (typescript missing)')
} else {
  const tsc = spawnSync(process.execPath, [tscBin, '--noEmit'], { stdio: 'inherit', cwd: root })
  if (tsc.status !== 0) failures.push('tsc --noEmit failed (see errors above)')
}

// --- 5 & 6. Forbidden API lint + file size limit ---
const FORBIDDEN = [
  { pattern: /window\.top\b/, reason: 'window.top is forbidden inside the iframe' },
  { pattern: /\blocalStorage\b/, reason: 'use sdk.storage instead of localStorage' },
  { pattern: /\bsessionStorage\b/, reason: 'use sdk.storage instead of sessionStorage' },
  { pattern: /requestFullscreen/, reason: 'fullscreen is not declared in rabbit.json.embed' },
  ...(manifest?.embed?.pointerLock === true
    ? []
    : [{ pattern: /requestPointerLock/, reason: 'pointerLock is not declared in rabbit.json.embed' }]),
  { pattern: /\bcreateScript\s*\(/, reason: 'Editor v1 style is forbidden: use ESM classes (extends Script)' },
]
const MAX_LINES = 400

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, files)
    else if (/\.(ts|tsx|mts|js|jsx|mjs)$/.test(entry)) files.push(full)
  }
  return files
}

const srcDir = join(root, 'src')
if (existsSync(srcDir)) {
  for (const file of walk(srcDir)) {
    const rel = relative(root, file).replaceAll('\\', '/')
    const content = readFileSync(file, 'utf8')
    const lineCount = content.split('\n').length

    if (lineCount > MAX_LINES) {
      failures.push(`size: ${rel} has ${lineCount} lines (max ${MAX_LINES}) — split it`)
    }
    if (rel.startsWith('src/rabbit/')) continue // the SDK implements the wrappers
    for (const { pattern, reason } of FORBIDDEN) {
      if (pattern.test(content)) failures.push(`forbidden api in ${rel}: ${reason}`)
    }
  }
}

// --- 7. Asset weight (advisory) ---
// Every byte under public/ ends up in the immutable snapshot of each imported
// version, and in the browser of a kid on a phone. Big files are sometimes the
// right call, so this warns and never blocks.
const MAX_ASSET_BYTES = 5 * 1024 * 1024
const MAX_TOTAL_BYTES = 25 * 1024 * 1024

function walkAll(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walkAll(full, files)
    else files.push(full)
  }
  return files
}

const publicDir = join(root, 'public')
if (existsSync(publicDir)) {
  let total = 0
  for (const file of walkAll(publicDir)) {
    const { size } = statSync(file)
    total += size
    if (size > MAX_ASSET_BYTES) {
      const rel = relative(root, file).replaceAll('\\', '/')
      warnings.push(`asset: ${rel} is ${(size / 1024 / 1024).toFixed(1)} MB (soft limit 5 MB) — compress it if you can`)
    }
  }
  if (total > MAX_TOTAL_BYTES) {
    warnings.push(`assets: public/ totals ${(total / 1024 / 1024).toFixed(1)} MB (soft limit 25 MB)`)
  }
}

// --- 8. No dist/ ---
if (existsSync(join(root, 'dist'))) {
  const gitignore = existsSync(join(root, '.gitignore'))
    ? readFileSync(join(root, '.gitignore'), 'utf8')
    : ''
  if (!/^dist\/?$/m.test(gitignore)) failures.push('dist/ exists and is not in .gitignore')
}

// --- Report ---
for (const warning of warnings) console.warn(`  ⚠ ${warning}`)

if (failures.length > 0) {
  console.error('\n✖ rabbit-check failed:\n')
  for (const failure of failures) console.error(`  ✖ ${failure}`)
  console.error('')
  process.exit(1)
}
console.log('✔ rabbit-check OK (layout, package.json, vite cors, tsc, APIs, sizes)')
