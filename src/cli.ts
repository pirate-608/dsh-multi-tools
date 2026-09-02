#!/usr/bin/env node
/** Aggregate status, selection, and explicit runtime CLI. */

import { spawnSync } from 'node:child_process'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { load, dump } from 'js-yaml'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type { IntegrationId, IntegrationTargetId, MultiToolsStatusSnapshot, ProbeMode } from '../packages/plugin-kit/src/types.js'
import { Config, INTEGRATION_IDS, validateConfig, type Config as MultiToolsConfig } from './config.js'
import { MultiToolsController } from './controller.js'
import { INTEGRATIONS, integrationRoot } from './integrations.js'
import { findPackageRoot } from './package-root.js'

const packageRoot = findPackageRoot(import.meta.url)

main(process.argv.slice(2)).then(
  code => { process.exitCode = code },
  error => { process.stderr.write(`dsh-multi-tools: ${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1 },
)

async function main(argv: readonly string[]): Promise<number> {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(help())
    return 0
  }
  const file = new FileSettingsScope(join(resolveDshHome(), 'settings.yaml'))
  const controller = new MultiToolsController(packageRoot, file)
  if (argv[0] === 'doctor') {
    const snapshot = await controller.status({ mode: 'installed' })
    printHuman(snapshot)
    return snapshot.integrations.some(item => item.configuredEnabled && ['blocked', 'needs-setup'].includes(item.overall)) ? 1 : 0
  }
  if (argv[0] === 'status') {
    const parsed = parseStatus(argv.slice(1))
    const snapshot = await controller.status({ mode: parsed.mode, ...parsed.integration === undefined ? {} : { integrations: [parsed.integration] } })
    if (parsed.json) process.stdout.write(`${JSON.stringify(snapshot, undefined, 2)}\n`)
    else printHuman(snapshot)
    return snapshot.integrations.some(item => item.configuredEnabled && ['blocked', 'needs-setup'].includes(item.overall)) ? 1 : 0
  }
  if (argv[0] === 'integrations' && argv[1] === 'set') {
    const { ids, json } = parseSelection(argv.slice(2))
    const before = await controller.status({ mode: 'installed' })
    const after = await controller.applySelection({ enabled: ids, expectedRevision: before.revision })
    if (json) process.stdout.write(`${JSON.stringify(after, undefined, 2)}\n`)
    else printHuman(after)
    return 0
  }
  if (argv[0] === 'runtime' && (argv[2] === 'install' || argv[2] === 'remove')) {
    return runRuntime(argv[1], argv[2])
  }
  throw new Error('Expected status, doctor, integrations set, or runtime <id> install|remove')
}

function parseStatus(argv: readonly string[]): { mode: ProbeMode, json: boolean, integration?: IntegrationTargetId } {
  let mode: ProbeMode = 'installed'
  let json = false
  let integration: IntegrationTargetId | undefined
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--live') mode = 'live'
    else if (arg === '--json') json = true
    else if (arg === '--integration') integration = required(argv, ++index, arg) as IntegrationTargetId
    else throw new Error(`Unknown status option: ${arg}`)
  }
  return { mode, json, ...integration === undefined ? {} : { integration } }
}

function parseSelection(argv: readonly string[]): { ids: IntegrationId[], json: boolean } {
  const ids: IntegrationId[] = []
  let json = false
  for (const arg of argv) {
    if (arg === '--json') json = true
    else if ((INTEGRATION_IDS as readonly string[]).includes(arg)) ids.push(arg as IntegrationId)
    else throw new Error(`Unknown integration: ${arg}`)
  }
  return { ids, json }
}

function runRuntime(id: string | undefined, action: 'install' | 'remove'): number {
  const definition = INTEGRATIONS.find(item => item.id === id)
  if (definition === undefined) throw new Error(`Unknown integration: ${id ?? ''}`)
  const root = integrationRoot(packageRoot, definition)
  const presetPath = join(root, 'preset.json')
  if (definition.id === 'unity') throw new Error(`runtime ${action} is unsupported for unity`)
  const preset = JSON.parse(requireText(presetPath)) as { runtime?: Record<string, { command: string, args?: string[], cwd?: string }> }
  const command = preset.runtime?.[action]
  if (command === undefined) throw new Error(`runtime ${action} is unsupported for ${definition.id}`)
  const result = spawnSync(command.command, command.args ?? [], {
    cwd: resolve(root, command.cwd ?? ''), stdio: 'inherit', shell: false, windowsHide: true,
  })
  if (result.error !== undefined) throw result.error
  return result.status ?? 1
}

function printHuman(snapshot: MultiToolsStatusSnapshot): void {
  process.stdout.write(`DSH Multi Tools (${snapshot.mode})\n`)
  for (const item of snapshot.integrations) {
    const enabled = item.id === 'modlens' ? 'core' : item.effectiveEnabled ? 'enabled' : 'disabled'
    process.stdout.write(`${item.id}: ${enabled}, ${item.overall}, preset=${item.preset}\n`)
    for (const dependency of [...item.runtime, ...item.live]) {
      process.stdout.write(`  ${dependency.state.padEnd(16)} ${dependency.label}: ${dependency.summary}\n`)
    }
  }
}

function required(argv: readonly string[], index: number, option: string): string {
  const value = argv[index]
  if (value === undefined || value.startsWith('-')) throw new Error(`${option} requires a value`)
  return value
}

function requireText(path: string): string {
  const fs = process.getBuiltinModule('fs') as typeof import('node:fs')
  return fs.readFileSync(path, 'utf8')
}

function help(): string {
  return `Usage:\n  dsh-multi-tools status [--live] [--json] [--integration <id>]\n  dsh-multi-tools doctor\n  dsh-multi-tools integrations set [<id>...] [--json]\n  dsh-multi-tools runtime <id> <install|remove>\n`
}

class FileSettingsScope implements SettingsScope<MultiToolsConfig> {
  private value: MultiToolsConfig = Config({} as never)
  private readonly watchers = new Set<(next: MultiToolsConfig, prev: MultiToolsConfig) => void | Promise<void>>()

  constructor(private readonly path: string) {
    const fs = process.getBuiltinModule('fs') as typeof import('node:fs')
    if (fs.existsSync(path)) {
      const document = load(fs.readFileSync(path, 'utf8')) as Record<string, unknown> | undefined
      this.value = Config((document?.['dsh-multi-tools'] ?? {}) as never)
      validateConfig(this.value)
    }
  }

  get(): MultiToolsConfig { return structuredClone(this.value) }

  watch(callback: (next: MultiToolsConfig, prev: MultiToolsConfig) => void | Promise<void>): () => void {
    this.watchers.add(callback)
    return () => { this.watchers.delete(callback) }
  }

  async update(patch: object): Promise<void> {
    const previous = this.value
    const next = Config({ ...previous, ...patch } as never)
    validateConfig(next)
    const document = await this.readDocument()
    document['dsh-multi-tools'] = { ...(document['dsh-multi-tools'] as object | undefined), ...patch }
    await this.writeDocument(document)
    this.value = next
    for (const watcher of this.watchers) await watcher(next, previous)
  }

  async replace(section: object): Promise<void> {
    const previous = this.value
    const next = Config(section as never)
    validateConfig(next)
    const document = await this.readDocument()
    document['dsh-multi-tools'] = section
    await this.writeDocument(document)
    this.value = next
    for (const watcher of this.watchers) await watcher(next, previous)
  }

  private async readDocument(): Promise<Record<string, unknown>> {
    try {
      const value = load(await readFile(this.path, 'utf8'))
      return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
      throw error
    }
  }

  private async writeDocument(document: Record<string, unknown>): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true })
    const temp = `${this.path}.tmp-${process.pid}`
    await writeFile(temp, dump(document, { noRefs: true, lineWidth: 120 }), { encoding: 'utf8', mode: 0o600 })
    await rename(temp, this.path)
  }
}
