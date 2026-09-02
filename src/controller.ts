/** Aggregate status, configuration, and managed-preset orchestration. */

import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import {
  applyPresetSelection,
  executableProbe,
  integrationOverall,
  presetStatus,
  resolvePresetContext,
  runDependencyProbes,
  statusRevision,
  statusSnapshot,
} from '../packages/plugin-kit/src/index.js'
import type {
  DependencyProbe,
  DependencyStatus,
  IntegrationId,
  IntegrationStatus,
  IntegrationTargetId,
  MultiToolsStatusSnapshot,
  PresetContext,
  PresetSelectionItem,
  ProbeMode,
} from '../packages/plugin-kit/src/types.js'
import type { Config } from './config.js'
import { INTEGRATION_IDS } from './config.js'
import { INTEGRATIONS, integrationRoot, selectionItems } from './integrations.js'

interface CachedSnapshot {
  expiresAt: number
  snapshot: MultiToolsStatusSnapshot
}

/** Host-side source of truth consumed by the CLI and Remote service. */
export class MultiToolsController {
  private config: Config
  private cache: CachedSnapshot | undefined
  private lastEffectiveSelection = ''
  private selectionTail: Promise<void> = Promise.resolve()
  private configurationBlocked: string | undefined
  private suppressSettingsWatcher = false

  constructor(
    private readonly packageRoot: string,
    private readonly settings: SettingsScope<Config>,
    private readonly credentialConfigured?: (reference: string) => Promise<boolean>,
  ) {
    this.config = settings.get()
    this.lastEffectiveSelection = selectionKey(this.config.enabledIntegrations)
    settings.watch(async (next) => {
      this.config = next
      this.cache = undefined
      if (this.suppressSettingsWatcher) return
      if (selectionKey(next.enabledIntegrations) === this.lastEffectiveSelection) return
      await this.enqueueSelection(async () => {
        try {
          await this.reconcile(next.enabledIntegrations, async () => undefined)
          this.lastEffectiveSelection = selectionKey(next.enabledIntegrations)
          this.configurationBlocked = undefined
        } catch (error) {
          this.configurationBlocked = errorMessage(error)
        }
      })
    })
  }

  /** Reconcile settings already present when the Host plugin starts. */
  async initialize(): Promise<void> {
    try {
      await this.reconcile(this.config.enabledIntegrations, async () => undefined)
      this.lastEffectiveSelection = selectionKey(this.config.enabledIntegrations)
    } catch (error) {
      this.configurationBlocked = errorMessage(error)
    }
  }

  /** Read one installed or explicitly live status snapshot. */
  async status(request: { mode?: ProbeMode, integrations?: readonly IntegrationTargetId[] } = {}): Promise<MultiToolsStatusSnapshot> {
    const mode = request.mode ?? 'installed'
    const filter = normalizeTargets(request.integrations)
    if (mode === 'installed' && filter === undefined && this.cache !== undefined && this.cache.expiresAt > Date.now()) {
      return structuredClone(this.cache.snapshot)
    }
    const snapshot = await this.buildSnapshot(mode)
    if (mode === 'installed' && filter === undefined) {
      this.cache = { expiresAt: Date.now() + this.config.installedCacheTtlMs, snapshot }
    }
    if (filter === undefined) return structuredClone(snapshot)
    return { ...structuredClone(snapshot), integrations: snapshot.integrations.filter(item => filter.has(item.id)) }
  }

  /** Apply a revision-fenced selection through one serialized transaction. */
  async applySelection(request: { enabled: readonly IntegrationId[], expectedRevision: string }): Promise<MultiToolsStatusSnapshot> {
    const enabled = normalizeSelection(request.enabled)
    const before = await this.buildSnapshot('installed')
    if (before.revision !== request.expectedRevision) throw new Error('Multi Tools status changed; refresh before saving')
    for (const id of enabled) {
      const definition = INTEGRATIONS.find(item => item.id === id) as (typeof INTEGRATIONS)[number]
      if (definition.platform !== undefined && definition.platform !== process.platform) {
        throw new Error(`${id} requires ${definition.platform}`)
      }
    }
    await this.enqueueSelection(async () => {
      await this.reconcile(enabled, async () => {
        this.suppressSettingsWatcher = true
        try {
          await this.settings.update({ enabledIntegrations: [...enabled] })
        } finally {
          this.suppressSettingsWatcher = false
        }
        this.config = { ...this.config, enabledIntegrations: [...enabled] }
      })
      this.lastEffectiveSelection = selectionKey(enabled)
      this.configurationBlocked = undefined
      this.cache = undefined
    })
    return await this.buildSnapshot('installed')
  }

  /** Current resolved root configuration, detached for status providers. */
  currentConfig(): Config {
    return structuredClone(this.config)
  }

  private async reconcile(enabled: readonly IntegrationId[], persist: () => Promise<void>): Promise<void> {
    const items = await this.items()
    await applyPresetSelection(items, enabled.map(id => presetId(id)), persist)
  }

  private async items(): Promise<PresetSelectionItem[]> {
    const contexts = new Map<string, PresetContext>()
    for (const definition of INTEGRATIONS) {
      const root = integrationRoot(this.packageRoot, definition)
      contexts.set(root, await resolvePresetContext(this.config.profile, root))
    }
    return selectionItems(this.packageRoot, root => contexts.get(root) as PresetContext)
  }

  private async buildSnapshot(mode: ProbeMode): Promise<MultiToolsStatusSnapshot> {
    const items = await this.items()
    const itemByIntegration = new Map(INTEGRATIONS.map((definition, index) => [definition.id, items[index] as PresetSelectionItem]))
    const presetStates = await Promise.all(INTEGRATIONS.map(async definition => {
      const item = itemByIntegration.get(definition.id) as PresetSelectionItem
      return await presetStatus(item.spec, item.context)
    }))

    const runtimeGroups = INTEGRATIONS.map(definition => definition.platform !== undefined && definition.platform !== process.platform
      ? []
      : definition.probes(integrationRoot(this.packageRoot, definition), this.config).filter(probe => probe.mode === 'installed'))
    const liveGroups = INTEGRATIONS.map(definition => definition.platform !== undefined && definition.platform !== process.platform
      ? []
      : definition.probes(integrationRoot(this.packageRoot, definition), this.config).filter(probe => probe.mode === 'live'))
    const runtime = await runDependencyProbes(runtimeGroups.flat(), 'installed', this.probeOptions())
    const live = mode === 'live'
      ? await runDependencyProbes(liveGroups.flat(), 'live', this.probeOptions())
      : liveGroups.flat().map(notCheckedStatus)

    let runtimeCursor = 0
    let liveCursor = 0
    const integrations: IntegrationStatus[] = [await this.modlensStatus(mode)]
    for (let index = 0; index < INTEGRATIONS.length; index += 1) {
      const definition = INTEGRATIONS[index] as (typeof INTEGRATIONS)[number]
      const unsupported = definition.platform !== undefined && definition.platform !== process.platform
      const runtimeStatuses = runtime.slice(runtimeCursor, runtimeCursor + (runtimeGroups[index]?.length ?? 0))
      const liveStatuses = live.slice(liveCursor, liveCursor + (liveGroups[index]?.length ?? 0))
      runtimeCursor += runtimeGroups[index]?.length ?? 0
      liveCursor += liveGroups[index]?.length ?? 0
      const preset = presetStates[index] as Awaited<ReturnType<typeof presetStatus>>
      const configuredEnabled = this.config.enabledIntegrations.includes(definition.id)
      const status: IntegrationStatus = {
        id: definition.id,
        configuredEnabled,
        effectiveEnabled: preset.kind !== 'absent',
        availability: unsupported ? 'unsupported-platform' : 'available',
        preset: preset.kind,
        runtime: runtimeStatuses,
        live: liveStatuses,
        overall: 'not-checked',
        redistribution: definition.redistribution,
      }
      if (this.configurationBlocked !== undefined && configuredEnabled !== (preset.kind !== 'absent')) {
        status.runtime.push({
          id: 'configuration-blocked', label: 'Preset selection', kind: 'package', required: true,
          state: 'error', summary: this.configurationBlocked,
        })
      }
      status.overall = integrationOverall(status)
      integrations.push(status)
    }
    const revision = statusRevision({
      enabled: this.config.enabledIntegrations,
      presets: integrations.map(item => [item.id, item.preset, item.effectiveEnabled]),
      modlens: this.config.modlens,
      platform: process.platform,
    })
    return statusSnapshot(mode, revision, integrations)
  }

  private async modlensStatus(mode: ProbeMode): Promise<IntegrationStatus> {
    const routes = this.config.modlens.routes ?? {}
    const configured = Object.keys(routes)
    let runtime: DependencyStatus[]
    if (configured.length === 0) {
      runtime = [{
          id: 'vision-route', label: 'Vision route', kind: 'service', required: true,
          state: 'unconfigured', summary: 'Configure a Codex, OpenAI-compatible, or Ollama route.',
          remediation: { kind: 'manual', text: 'Edit the dsh-multi-tools ModLens route configuration.' },
        }]
    } else {
      const probes: DependencyProbe[] = []
      if (routes.codex !== undefined) {
        probes.push({
          id: 'route-codex', label: 'Codex vision route', kind: 'command', required: true, mode: 'installed',
          remediation: { kind: 'manual', text: 'Install/login to Codex CLI and set consent: true only after reviewing image-upload implications.' },
          run: routes.codex.consent === true
            ? executableProbe(routes.codex.command ?? 'codex')
            : async () => ({ state: 'unconfigured', summary: 'Codex image reuse requires consent: true.' }),
        })
      }
      const openai = routes.openai
      if (openai !== undefined) {
        probes.push({
          id: 'route-openai', label: 'OpenAI-compatible vision route', kind: 'credential', required: true, mode: 'installed',
          remediation: { kind: 'manual', text: 'Configure baseUrl, model, and a DSH credential reference when the endpoint requires one.' },
          run: async () => {
            if (openai.baseUrl.trim() === '' || openai.model.trim() === '') {
              return { state: 'unconfigured', summary: 'OpenAI-compatible baseUrl and model are required.' }
            }
            if (openai.credentialRef === undefined) {
              return { state: 'ready', summary: 'Endpoint and model are configured without a credential reference.' }
            }
            if (this.credentialConfigured === undefined) {
              return { state: 'not-checked', summary: 'Credential reference presence is available only inside a running DSH Host.' }
            }
            return await this.credentialConfigured(openai.credentialRef)
              ? { state: 'ready', summary: 'Endpoint, model, and credential reference are configured.' }
              : { state: 'unconfigured', summary: `Credential reference ${openai.credentialRef} is not configured.` }
          },
        })
      }
      const ollama = routes.ollama
      if (ollama !== undefined) {
        probes.push({
          id: 'route-ollama', label: 'Ollama vision route', kind: 'model', required: true, mode: 'installed',
          remediation: { kind: 'manual', text: 'Install a local Ollama vision model; status never pulls one.' },
          run: async () => ollama.model.trim() !== ''
            ? { state: 'ready', summary: `Ollama model ${ollama.model} is configured.` }
            : { state: 'unconfigured', summary: 'An Ollama vision model id is required.' },
        })
      }
      runtime = await runDependencyProbes(probes, 'installed', this.probeOptions())
    }
    const live: DependencyStatus[] = []
    for (const id of configured) {
      if (mode === 'live' && id === 'ollama' && routes.ollama !== undefined) {
        live.push(await probeOllama(routes.ollama.baseUrl ?? 'http://127.0.0.1:11434', this.config.liveProbeTimeoutMs))
      } else if (mode === 'live') {
        live.push({
          id: `route-${id}-live`, label: `${id} live route`, kind: 'service', required: false,
          state: 'not-checked', summary: 'Cloud and inference routes are never exercised by dependency status.',
        })
      }
    }
    const status: IntegrationStatus = {
      id: 'modlens', configuredEnabled: true, effectiveEnabled: true, availability: 'available',
      preset: 'not-applicable', runtime, live, overall: 'not-checked', redistribution: 'publishable',
    }
    status.overall = integrationOverall(status)
    return status
  }

  private probeOptions(): { concurrency: number, installedTimeoutMs: number, liveTimeoutMs: number } {
    return {
      concurrency: this.config.statusConcurrency,
      installedTimeoutMs: this.config.installedProbeTimeoutMs,
      liveTimeoutMs: this.config.liveProbeTimeoutMs,
    }
  }

  private async enqueueSelection(operation: () => Promise<void>): Promise<void> {
    const run = this.selectionTail.catch(() => undefined).then(operation)
    this.selectionTail = run
    await run
  }
}

function normalizeSelection(input: readonly IntegrationId[]): IntegrationId[] {
  const known = new Set<IntegrationId>(INTEGRATION_IDS)
  const seen = new Set<IntegrationId>()
  for (const id of input) {
    if (!known.has(id)) throw new Error(`Unknown integration "${id}"`)
    if (seen.has(id)) throw new Error(`Duplicate integration "${id}"`)
    seen.add(id)
  }
  return [...seen].sort()
}

function normalizeTargets(input: readonly IntegrationTargetId[] | undefined): Set<IntegrationTargetId> | undefined {
  if (input === undefined) return undefined
  const known = new Set<IntegrationTargetId>(['modlens', ...INTEGRATION_IDS])
  const result = new Set<IntegrationTargetId>()
  for (const id of input) {
    if (!known.has(id)) throw new Error(`Unknown status target "${id}"`)
    if (result.has(id)) throw new Error(`Duplicate status target "${id}"`)
    result.add(id)
  }
  return result
}

function presetId(id: IntegrationId): string {
  return id === 'after-effects' ? 'after-effects'
    : id === 'photoshop' ? 'photoshop'
      : id === 'premiere' ? 'premiere'
        : id === 'autocad' ? 'autocad'
          : id === 'comfy-local' ? 'comfy-local'
            : id === 'renpy' ? 'renpy'
              : id === 'solidworks' ? 'solidworks'
                : 'unity'
}

function selectionKey(ids: readonly IntegrationId[]): string {
  return [...ids].sort().join('\n')
}

function notCheckedStatus(probe: DependencyProbe): DependencyStatus {
  return {
    id: probe.id, label: probe.label, kind: probe.kind, required: probe.required,
    state: 'not-checked', summary: 'Run an explicit live refresh to check this dependency.',
    ...probe.requiredVersion === undefined ? {} : { requiredVersion: probe.requiredVersion },
    ...probe.remediation === undefined ? {} : { remediation: probe.remediation },
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function probeOllama(baseUrl: string, timeoutMs: number): Promise<DependencyStatus> {
  let url: URL
  try {
    url = new URL(baseUrl)
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname)) {
      throw new Error('Ollama status permits loopback HTTP only')
    }
    const response = await fetch(new URL('/api/tags', url), { signal: AbortSignal.timeout(timeoutMs) })
    return {
      id: 'route-ollama-live', label: 'Ollama loopback service', kind: 'service', required: false,
      state: response.ok ? 'ready' : 'unreachable', summary: `Ollama responded with HTTP ${response.status}.`,
    }
  } catch (error) {
    return {
      id: 'route-ollama-live', label: 'Ollama loopback service', kind: 'service', required: false,
      state: 'stopped', summary: errorMessage(error),
    }
  }
}
