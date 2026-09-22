// Node's native TypeScript runner needs extensions that Vite resolves at build time.
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[mc]?[jt]s$/.test(specifier) && context.parentURL?.includes('/src/')) {
    const local = new URL(specifier + '.ts', context.parentURL)
    if (existsSync(fileURLToPath(local))) return next(local.href, context)
  }
  return next(specifier, context)
} })
