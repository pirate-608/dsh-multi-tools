import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { applyPresetSelection, installPreset, presetStatus, removePreset, updatePreset } from '../src/preset.js'
import type { PresetContext, PresetSpec } from '../src/types.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(id = 'example'): Promise<{ spec: PresetSpec, context: PresetContext }> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-plugin-kit-'))
  roots.push(root)
  const standardPresetDir = join(root, 'dsh', 'standard')
  const packageRoot = join(root, 'package')
  await mkdir(join(packageRoot, 'skills'), { recursive: true })
  await mkdir(standardPresetDir, { recursive: true })
  await writeFile(join(standardPresetDir, 'agent.cordis.yml'), '- id: base\n  name: noop\n')
  const spec: PresetSpec = {
    packageName: '@pirate-608/example',
    packageVersion: '1.0.0',
    id,
    name: 'Example',
    description: 'Example preset.',
    providerName: `${id}-skills`,
    mcpServers: [{ id: 'example-mcp', serverName: 'example', command: 'node', args: ['server.js'] }],
    policy: {
      serverNames: ['example'],
      readOnly: ['mcp__example__read'],
      ask: ['mcp__example__write'],
      deny: ['mcp__example__erase'],
    },
  }
  const context: PresetContext = {
    dshHome: join(root, 'home'),
    profileName: 'web',
    profileDir: join(root, 'home', 'profiles', 'web'),
    standardPresetDir,
    packageRoot,
    mcpClientPlugin: join(root, 'plugins', 'mcp.js'),
    skillFilesystemPlugin: join(root, 'plugins', 'skills.js'),
    policyPlugin: join(root, 'plugins', 'policy.js'),
    dshVersion: '0.1.0-rc.8',
  }
  return { spec, context }
}

describe('managed preset kit', () => {
  it('installs a scoped composition and detects drift', async () => {
    const { spec, context } = await fixture()
    const installed = await installPreset(spec, context)
    const composition = await readFile(join(installed.presetDir, 'agent.cordis.yml'), 'utf8')
    expect(composition).toContain('providerName: "example-skills"')
    expect(composition).toContain('serverName: "example"')
    expect(composition).toContain('mcp__example__read')
    await expect(presetStatus(spec, context)).resolves.toMatchObject({ kind: 'clean' })
    await expect(presetStatus({ ...spec, packageVersion: '2.0.0' }, context)).resolves.toMatchObject({ kind: 'outdated' })
  })

  it('protects local changes during update and removal', async () => {
    const { spec, context } = await fixture()
    const installed = await installPreset(spec, context)
    await writeFile(join(installed.presetDir, 'mine.txt'), 'mine')
    await expect(updatePreset(spec, context)).rejects.toThrow(/--force/)
    const updated = await updatePreset(spec, context, true)
    expect(updated.backupDir).toBeDefined()
    await writeFile(join(updated.presetDir, 'mine-again.txt'), 'mine')
    await expect(removePreset(spec, context)).rejects.toThrow(/--force/)
    const removed = await removePreset(spec, context, true)
    expect(removed.backupDir).toBeDefined()
  })

  it('applies a multi-preset selection only after preflight and persistence', async () => {
    const first = await fixture('first')
    const second = await fixture('second')
    let persisted = false
    const installed = await applyPresetSelection([first, second], ['first', 'second'], async () => { persisted = true })
    expect(installed).toMatchObject({ enabled: ['first', 'second'], installed: ['first', 'second'], removed: [] })
    expect(persisted).toBe(true)
    const narrowed = await applyPresetSelection([first, second], ['second'], async () => undefined)
    expect(narrowed).toMatchObject({ enabled: ['second'], installed: [], removed: ['first'] })
    await expect(presetStatus(first.spec, first.context)).resolves.toMatchObject({ kind: 'absent' })
    await expect(presetStatus(second.spec, second.context)).resolves.toMatchObject({ kind: 'clean' })
  })

  it('rolls back filesystem changes when persistence fails', async () => {
    const first = await fixture('first')
    const second = await fixture('second')
    await installPreset(first.spec, first.context)
    await expect(applyPresetSelection([first, second], ['second'], async () => { throw new Error('persist failed') }))
      .rejects.toThrow('persist failed')
    await expect(presetStatus(first.spec, first.context)).resolves.toMatchObject({ kind: 'clean' })
    await expect(presetStatus(second.spec, second.context)).resolves.toMatchObject({ kind: 'absent' })
  })

  it('refuses an entire selection before touching a modified removal', async () => {
    const first = await fixture('first')
    const second = await fixture('second')
    const installed = await installPreset(first.spec, first.context)
    await writeFile(join(installed.presetDir, 'mine.txt'), 'mine')
    await expect(applyPresetSelection([first, second], ['second'], async () => undefined)).rejects.toThrow(/blocked/)
    await expect(presetStatus(first.spec, first.context)).resolves.toMatchObject({ kind: 'modified' })
    await expect(presetStatus(second.spec, second.context)).resolves.toMatchObject({ kind: 'absent' })
  })

  it('can inspect unsupported presets but refuses to enable them', async () => {
    const item = await fixture('foreign')
    item.spec.platform = process.platform === 'win32' ? 'linux' : 'win32'
    await expect(presetStatus(item.spec, item.context)).resolves.toMatchObject({ kind: 'absent' })
    await expect(applyPresetSelection([item], ['foreign'], async () => undefined)).rejects.toThrow(/requires/)
  })
})
