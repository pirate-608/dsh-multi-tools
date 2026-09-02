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
  if (!isRecord(config.modlens) || Array.isArray(config.modlens)) {
    throw new TypeError('modlens must be an object')
  }
  const routesValue = config.modlens.routes
  if (routesValue !== undefined) {
    if (!isRecord(routesValue) || Array.isArray(routesValue)) throw new TypeError('modlens.routes must be an object')
    const codex = route(routesValue, 'codex')
    if (codex !== undefined) {
      if (codex.type !== 'codex-cli' || typeof codex.consent !== 'boolean') {
        throw new TypeError('modlens.routes.codex requires type: codex-cli and boolean consent')
      }
      optionalNonEmptyString(codex, 'command', 'modlens.routes.codex.command')
      optionalNonEmptyString(codex, 'model', 'modlens.routes.codex.model')
    }
    const openai = route(routesValue, 'openai')
    if (openai !== undefined) {
      if (openai.type !== 'openai-compatible') {
        throw new TypeError('modlens.routes.openai.type must be openai-compatible')
      }
      requireNonEmptyString(openai, 'model', 'modlens.routes.openai.model')
      const url = httpUrl(openai, 'baseUrl', 'modlens.routes.openai.baseUrl')
      if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('modlens OpenAI baseUrl must use http(s)')
      const credentialRef = openai.credentialRef
      if (credentialRef !== undefined) {
        if (typeof credentialRef !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(credentialRef)) {
          throw new TypeError('modlens OpenAI credentialRef must be an environment-style identifier')
        }
      }
      if (openai.structuredOutput !== undefined && typeof openai.structuredOutput !== 'boolean') {
        throw new TypeError('modlens.routes.openai.structuredOutput must be boolean')
      }
    }
    const ollama = route(routesValue, 'ollama')
    if (ollama !== undefined) {
      if (ollama.type !== 'ollama') throw new TypeError('modlens.routes.ollama.type must be ollama')
      requireNonEmptyString(ollama, 'model', 'modlens.routes.ollama.model')
      const url = ollama.baseUrl === undefined
        ? new URL('http://127.0.0.1:11434')
        : httpUrl(ollama, 'baseUrl', 'modlens.routes.ollama.baseUrl')
      if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname)) {
        throw new TypeError('modlens Ollama baseUrl must be loopback HTTP')
      }
    }
  }
  const failover = config.modlens.failover
  if (failover !== undefined) {
    if (!Array.isArray(failover) || failover.length === 0 || new Set(failover).size !== failover.length
      || failover.some(value => !['codex', 'openai', 'ollama'].includes(value))) {
      throw new TypeError('modlens.failover must contain unique codex/openai/ollama ids')
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function route(routes: Record<string, unknown>, id: string): Record<string, unknown> | undefined {
  const value = routes[id]
  if (value === undefined) return undefined
  if (!isRecord(value) || Array.isArray(value)) throw new TypeError(`modlens.routes.${id} must be an object`)
  return value
}

function requireNonEmptyString(value: Record<string, unknown>, key: string, subject: string): string {
  const candidate = value[key]
  if (typeof candidate !== 'string' || candidate.trim() === '') throw new TypeError(`${subject} must be a non-empty string`)
  return candidate
}

function optionalNonEmptyString(value: Record<string, unknown>, key: string, subject: string): void {
  if (value[key] !== undefined) requireNonEmptyString(value, key, subject)
}

function httpUrl(value: Record<string, unknown>, key: string, subject: string): URL {
  const candidate = requireNonEmptyString(value, key, subject)
  try {
    return new URL(candidate)
  } catch {
    throw new TypeError(`${subject} must be a valid URL`)
  }
}
