/** Root bundle configuration and persisted integration selection. */

import z from '@deepseek-ai/schemastery'
import type { Config as ModLensConfig } from '../plugins/modlens/src/types.js'
import type { IntegrationId } from '../packages/plugin-kit/src/types.js'

export const INTEGRATION_IDS = [
  'after-effects',
  'photoshop',
  'premiere',
  'autocad',
  'comfy-local',
  'renpy',
  'solidworks',
  'unity',
] as const satisfies readonly IntegrationId[]

/** DSH settings section owned by the aggregate bundle. */
export interface Config {
  enabledIntegrations: IntegrationId[]
  profile: string
  statusConcurrency: number
  installedProbeTimeoutMs: number
  liveProbeTimeoutMs: number
  installedCacheTtlMs: number
  modlens: ModLensConfig
}

/** Load-time validation and defaults shared with the settings namespace. */
export const Config: z<Config> = z.object({
  enabledIntegrations: z.array(z.union([...INTEGRATION_IDS])).default([]),
  profile: z.string().default('web'),
  statusConcurrency: z.number().step(1).min(1).max(4).default(2),
  installedProbeTimeoutMs: z.number().step(1).min(1).default(5_000),
  liveProbeTimeoutMs: z.number().step(1).min(1).default(15_000),
  installedCacheTtlMs: z.number().step(1).min(0).default(30_000),
  modlens: z.any().default({}),
}) as z<Config>

/** Reject duplicate or unknown integration ids after schema admission. */
export function validateConfig(config: Config): void {
  if (new Set(config.enabledIntegrations).size !== config.enabledIntegrations.length) {
    throw new TypeError('enabledIntegrations must not contain duplicates')
  }
  if (typeof config.modlens !== 'object' || config.modlens === null || Array.isArray(config.modlens)) {
    throw new TypeError('modlens must be an object')
  }
  const routes = config.modlens.routes
  if (routes?.codex !== undefined) {
    if (routes.codex.type !== 'codex-cli' || typeof routes.codex.consent !== 'boolean') {
      throw new TypeError('modlens.routes.codex requires type: codex-cli and boolean consent')
    }
  }
  if (routes?.openai !== undefined) {
    if (routes.openai.type !== 'openai-compatible' || routes.openai.model.trim() === '') {
      throw new TypeError('modlens.routes.openai requires type: openai-compatible and a model')
    }
    const url = new URL(routes.openai.baseUrl)
    if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('modlens OpenAI baseUrl must use http(s)')
    if (routes.openai.credentialRef !== undefined && !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(routes.openai.credentialRef)) {
      throw new TypeError('modlens OpenAI credentialRef must be an environment-style identifier')
    }
  }
  if (routes?.ollama !== undefined) {
    if (routes.ollama.type !== 'ollama' || routes.ollama.model.trim() === '') {
      throw new TypeError('modlens.routes.ollama requires type: ollama and a model')
    }
    const url = new URL(routes.ollama.baseUrl ?? 'http://127.0.0.1:11434')
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname)) {
      throw new TypeError('modlens Ollama baseUrl must be loopback HTTP')
    }
  }
  if (config.modlens.failover !== undefined) {
    const values = config.modlens.failover
    if (values.length === 0 || new Set(values).size !== values.length
      || values.some(value => !['codex', 'openai', 'ollama'].includes(value))) {
      throw new TypeError('modlens.failover must contain unique codex/openai/ollama ids')
    }
  }
}
