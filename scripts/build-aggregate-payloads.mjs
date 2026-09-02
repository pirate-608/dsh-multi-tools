/** Build deterministic, self-contained integration payloads for the root bundle. */

import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const root = new URL('../', import.meta.url)
const output = new URL('../dist/integrations/', import.meta.url)
const integrations = {
  'after-effects': 'adobe-after-effects',
  photoshop: 'adobe-photoshop',
  premiere: 'adobe-premiere',
  autocad: 'autocad-mcp',
  'comfy-local': 'comfy-local-tools',
  modlens: 'modlens',
  renpy: 'renpy-visual-novel-dev',
  solidworks: 'solidworks-automation',
  unity: 'unity-mcp',
}
const directoryAllowlist = ['skills', 'scripts', 'vendor', 'mcp-server', 'autocad-plugin', 'assets']
const fileAllowlist = [
  'preset.json', 'LICENSE', 'NOTICE.md', 'UPSTREAM.json', 'README.md', 'README.zh-CN.md',
  'THIRD_PARTY_NOTICES.md',
]

await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
const manifest = { formatVersion: 1, integrations: {} }
for (const [id, directory] of Object.entries(integrations)) {
  const source = new URL(`../plugins/${directory}/`, import.meta.url)
  const target = new URL(`./${id}/`, output)
  await mkdir(target, { recursive: true })
  for (const name of directoryAllowlist) {
    const from = new URL(`./${name}/`, source)
    try {
      if ((await stat(from)).isDirectory()) {
        await cp(from, new URL(`./${name}/`, target), { recursive: true, filter: allowedPayloadPath })
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  for (const name of fileAllowlist) {
    const from = new URL(`./${name}`, source)
    try { if ((await stat(from)).isFile()) await cp(from, new URL(`./${name}`, target)) } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  const files = await hashTree(target)
  manifest.integrations[id] = { sourceDirectory: `plugins/${directory}`, files }
}
await writeFile(new URL('./manifest.json', output), `${JSON.stringify(manifest, undefined, 2)}\n`)

function allowedPayloadPath(path) {
  const normalized = path.replaceAll('\\', '/')
  return !forbiddenPayloadPath(normalized)
}

function forbiddenPayloadPath(normalized) {
  return /(?:^|\/)(?:\.venv|__pycache__|node_modules|tests?|evals|agents|\.codex-plugin)(?:\/|$)/u.test(normalized)
    || /(?:^|\/)(?:test_[^/]+|[^/]+_test|smoke_test)\.py$/u.test(normalized)
}

async function hashTree(directory) {
  const rootPath = decodeURIComponent(directory.pathname).replace(/^\/(?:[A-Za-z]:)/, value => value.slice(1))
  const outputFiles = {}
  await walk(rootPath)
  return Object.fromEntries(Object.entries(outputFiles).sort(([left], [right]) => left.localeCompare(right)))
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const target = join(path, entry.name)
      if (entry.isDirectory()) await walk(target)
      else if (entry.isFile()) {
        const key = relative(rootPath, target).replaceAll('\\', '/')
        if (forbiddenPayloadPath(key)) {
          throw new Error(`Forbidden aggregate payload path: ${key}`)
        }
        outputFiles[key] = createHash('sha256').update(await readFile(target)).digest('hex')
      }
    }
  }
}
