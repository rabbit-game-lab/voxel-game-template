import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const digest = content => createHash('sha256').update(content.replaceAll('\r\n', '\n')).digest('hex')
/** Checks a recorded snapshot; authenticity comes from the reviewed kit commit. */
export function integrityFailures(root, stack) {
  const failures = []
  let receipt
  try { receipt = JSON.parse(readFileSync(join(root, '.rabbit-kit.json'), 'utf8')) }
  catch { return ['missing or invalid .rabbit-kit.json; run rabbit-kit sync-sdk and sync-check'] }
  if (receipt.schemaVersion !== 1 || receipt.stack !== stack) return ['incompatible kit provenance schema or stack']
  for (const group of ['sdk', 'check']) {
    const entry = receipt[group]
    if (!entry || !entry.source || !/^[a-f0-9]{40}$/.test(entry.source.commit ?? '') || !Object.keys(entry.files ?? {}).length) {
      failures.push(`missing ${group} provenance; sync from a Git kit checkout`)
      continue
    }
    const prefix = group === 'sdk' ? /^src\/rabbit\/[\w.-]+\.ts$/ : /^scripts\/(check|profile|integrity)\.mjs$/
    for (const [path, hash] of Object.entries(entry.files)) {
      if (!prefix.test(path) || !/^[a-f0-9]{64}$/.test(hash)) { failures.push(`invalid ${group} provenance entry`); continue }
      if (!existsSync(join(root, path)) || digest(readFileSync(join(root, path), 'utf8')) !== hash) failures.push(`${path}: differs from recorded kit`)
    }
  }
  const sdkDir = join(root, 'src/rabbit')
  if (existsSync(sdkDir)) for (const name of readdirSync(sdkDir)) {
    if (!Object.hasOwn(receipt.sdk?.files ?? {}, `src/rabbit/${name}`)) failures.push(`src/rabbit/${name}: not part of recorded kit`)
  }
  if (receipt.sdk && receipt.check && JSON.stringify(receipt.sdk.source) !== JSON.stringify(receipt.check.source)) failures.push('SDK and checker come from different kit snapshots')
  return failures
}
