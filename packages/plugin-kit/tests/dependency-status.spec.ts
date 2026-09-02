import { describe, expect, it } from 'vitest'
import { integrationOverall, runDependencyProbes, statusRevision, statusSnapshot, versionedCommandProbe } from '../src/dependency-status.js'
import type { DependencyProbe, IntegrationStatus } from '../src/types.js'

describe('dependency status model', () => {
  it('bounds global concurrency and preserves declaration order', async () => {
    let running = 0
    let peak = 0
    const probes = Array.from({ length: 6 }, (_, index): DependencyProbe => ({
      id: `p${index}`, label: `Probe ${index}`, kind: 'command', required: true, mode: 'installed',
      run: async () => {
        running += 1
        peak = Math.max(peak, running)
        await new Promise(resolve => setTimeout(resolve, 10))
        running -= 1
        return { state: 'ready', summary: `ready ${index}` }
      },
    }))
    const result = await runDependencyProbes(probes, 'installed', { concurrency: 2 })
    expect(peak).toBe(2)
    expect(result.map(item => item.id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5'])
  })

  it('normalizes timeouts and redacts probe failures', async () => {
    const timeout: DependencyProbe = {
      id: 'timeout', label: 'Timeout', kind: 'service', required: true, mode: 'live', timeoutMs: 10,
      run: signal => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('token-supersecret12345')), { once: true })),
    }
    const [result] = await runDependencyProbes([timeout], 'live')
    expect(result).toMatchObject({ state: 'error' })
    expect(result?.summary).not.toContain('supersecret')
  })

  it('derives rollups and stable detached snapshots', () => {
    const base: IntegrationStatus = {
      id: 'comfy-local', configuredEnabled: true, effectiveEnabled: true, availability: 'available', preset: 'clean',
      runtime: [{ id: 'uv', label: 'uv', kind: 'command', required: true, state: 'ready', summary: 'ready' }],
      live: [{ id: 'server', label: 'server', kind: 'service', required: true, state: 'not-checked', summary: 'pending' }],
      overall: 'not-checked', redistribution: 'publishable',
    }
    expect(integrationOverall(base)).toBe('not-checked')
    base.live[0] = { ...base.live[0]!, state: 'stopped' }
    expect(integrationOverall(base)).toBe('needs-setup')
    const revision = statusRevision({ enabled: ['comfy-local'] })
    expect(revision).toHaveLength(64)
    const snapshot = statusSnapshot('live', revision, [base])
    base.live[0] = { ...base.live[0]!, state: 'ready' }
    expect(snapshot.integrations[0]?.live[0]?.state).toBe('stopped')
  })

  it('reports minimum-version mismatches without guessing', async () => {
    const probes: DependencyProbe[] = [
      { id: 'ok', label: 'Node', kind: 'command', required: true, mode: 'installed', run: versionedCommandProbe(process.execPath, ['--version'], '>=1.0.0') },
      { id: 'old', label: 'Node', kind: 'command', required: true, mode: 'installed', run: versionedCommandProbe(process.execPath, ['--version'], '>=999.0.0') },
    ]
    const result = await runDependencyProbes(probes, 'installed')
    expect(result.map(item => item.state)).toEqual(['ready', 'version-mismatch'])
  })
})
