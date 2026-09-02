import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import { afterEach, describe, expect, it } from 'vitest'
import { Config, type Config as MultiToolsConfig } from '../src/config.js'
import { MultiToolsController } from '../src/controller.js'
import { findPackageRoot } from '../src/package-root.js'

const roots: string[] = []
const previousHome = process.env.DSH_HOME

afterEach(async () => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('multi-tools controller', () => {
  it('returns a versioned snapshot and applies a revision-fenced selection', async () => {
    const home = await fakeDshHome()
    process.env.DSH_HOME = home
    const settings = new MemorySettings()
    const controller = new MultiToolsController(findPackageRoot(import.meta.url), settings)
    const before = await controller.status({ mode: 'installed' })
    expect(before).toMatchObject({ formatVersion: 1, mode: 'installed' })
    expect(before.integrations[0]).toMatchObject({ id: 'modlens', configuredEnabled: true, effectiveEnabled: true })
    expect(before.integrations.find(item => item.id === 'renpy')).toMatchObject({ preset: 'absent', configuredEnabled: false })

    const after = await controller.applySelection({ enabled: ['renpy'], expectedRevision: before.revision })
    expect(after.integrations.find(item => item.id === 'renpy')).toMatchObject({ preset: 'clean', configuredEnabled: true, effectiveEnabled: true })
    expect(settings.get().enabledIntegrations).toEqual(['renpy'])
    const composition = await readFile(join(home, '.agent-presets', 'renpy', 'agent.cordis.yml'), 'utf8')
    expect(composition).toContain('serverName: "renpy"')
    await expect(controller.applySelection({ enabled: [], expectedRevision: before.revision })).rejects.toThrow(/refresh/)
  })
})

class MemorySettings implements SettingsScope<MultiToolsConfig> {
  private value = Config({ installedProbeTimeoutMs: 100, liveProbeTimeoutMs: 100, installedCacheTtlMs: 0 } as never)
  private readonly watchers = new Set<(next: MultiToolsConfig, prev: MultiToolsConfig) => void | Promise<void>>()

  get(): MultiToolsConfig { return structuredClone(this.value) }
  watch(callback: (next: MultiToolsConfig, prev: MultiToolsConfig) => void | Promise<void>): () => void {
    this.watchers.add(callback)
    return () => { this.watchers.delete(callback) }
  }
  async update(patch: object): Promise<void> {
    const previous = this.value
    this.value = Config({ ...previous, ...patch } as never)
    for (const watcher of this.watchers) await watcher(this.value, previous)
  }
  async replace(section: object): Promise<void> {
    const previous = this.value
    this.value = Config(section as never)
    for (const watcher of this.watchers) await watcher(this.value, previous)
  }
}

async function fakeDshHome(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), 'dsh-multi-tools-controller-'))
  roots.push(home)
  const profile = join(home, 'profiles', 'web')
  const modules = join(profile, 'node_modules', '@deepseek-ai')
  const dsh = join(modules, 'dsh')
  await mkdir(join(dsh, 'config', 'agent-presets', 'standard'), { recursive: true })
  await writeFile(join(profile, 'package.json'), JSON.stringify({ name: 'dsh-profile-web', dsh: { profile: { bundles: [] } } }))
  await writeFile(join(dsh, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh', version: '0.1.2-alpha.3', type: 'module' }))
  await writeFile(join(dsh, 'config', 'agent-presets', 'standard', 'agent.cordis.yml'), '- id: base\n  name: noop\n')
  for (const name of ['dsh-mcp-client', 'dsh-skill-filesystem']) {
    const directory = join(modules, name)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'package.json'), JSON.stringify({ name: `@deepseek-ai/${name}`, main: 'index.js' }))
    await writeFile(join(directory, 'index.js'), 'export default () => undefined\n')
  }
  return home
}
