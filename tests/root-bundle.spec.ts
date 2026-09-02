import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { Config, INTEGRATION_IDS, validateConfig } from '../src/config.js'
import { INTEGRATIONS } from '../src/integrations.js'

describe('aggregate bundle contracts', () => {
  it('is one private alpha.3+ Host/client bundle with no postinstall', async () => {
    const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
      name: string, private: boolean, scripts: Record<string, string>, peerDependencies: Record<string, string>,
      dsh: { bundle: { patch: string }, client: { platform: string, immediately: boolean } },
    }
    expect(manifest).toMatchObject({
      name: '@pirate-608/dsh-multi-tools', private: true,
      dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web', immediately: true } },
    })
    expect(manifest.scripts.postinstall).toBeUndefined()
    expect(manifest.peerDependencies['@deepseek-ai/dsh']).toBe('>=0.1.2-alpha.3 <0.2.0')
  })

  it('defaults to ModLens-only operation and validates duplicate selections', () => {
    const config = Config({} as never)
    expect(config.enabledIntegrations).toEqual([])
    expect(config.modlens).toEqual({})
    expect(config.statusConcurrency).toBe(2)
    expect(() => validateConfig({ ...config, enabledIntegrations: ['unity', 'unity'] })).toThrow(/duplicates/)
    expect(() => validateConfig({ ...config, modlens: { routes: { ollama: { type: 'ollama', baseUrl: 'https://remote.example', model: 'vision' } } } })).toThrow(/loopback/)
  })

  it('declares all eight optional integrations and personal redistribution boundaries', () => {
    expect(INTEGRATIONS.map(item => item.id)).toEqual(INTEGRATION_IDS)
    expect(INTEGRATIONS.filter(item => item.redistribution === 'personal-only').map(item => item.id))
      .toEqual(['after-effects', 'photoshop', 'premiere', 'autocad'])
    for (const integration of INTEGRATIONS) {
      expect(integration.probes('.', Config({} as never)).length).toBeGreaterThan(0)
    }
  })

  it('ships a client tab with manual live refresh and no installer controls or polling', async () => {
    const client = await readFile(new URL('../src/client.js', import.meta.url), 'utf8')
    expect(client).toContain("id: 'multi-tools'")
    expect(client).toContain("load('live')")
    expect(client).toContain('installModLensPasteBridge(ctx)')
    expect(client).toContain('/modlens/paste?model=')
    expect(client).not.toContain('setInterval(')
    expect(client).not.toContain('installPlugin')
    expect(client).not.toContain('download_model')
  })

  it('registers a materializable lazy-CJS client module', async () => {
    const source = await readFile(new URL('../src/client.js', import.meta.url), 'utf8')
    let definition: { id: string, factory(require: (name: string) => unknown): { apply?: unknown, inject?: unknown } } | undefined
    runInNewContext(source, { window: { __ModuleLoader__: { load: (value: typeof definition) => { definition = value } } } })
    expect(definition?.id).toBe('@pirate-608/dsh-multi-tools')
    const React = { createElement: () => undefined, useEffect: () => undefined, useMemo: (value: () => unknown) => value(), useState: (value: unknown) => [value, () => undefined] }
    const plugin = definition?.factory(name => name === 'react' ? React : undefined)
    expect(plugin?.inject).toEqual(['slots', 'locale', 'remote'])
    expect(typeof plugin?.apply).toBe('function')
  })
})
