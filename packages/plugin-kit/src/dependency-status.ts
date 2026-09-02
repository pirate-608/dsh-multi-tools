/** Bounded dependency-probe execution and status derivation. */

import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, extname, join } from 'node:path'
import type {
  DependencyProbe,
  DependencyStatus,
  IntegrationStatus,
  MultiToolsStatusSnapshot,
  ProbeMode,
} from './types.js'

const MAX_CAPTURE_CHARS = 64_000
const SECRET_PATTERN = /(?:sk|key|token|secret|password)[-_A-Za-z0-9]{8,}/giu

/** Execute probes with a fixed concurrency cap while preserving declaration order. */
export async function runDependencyProbes(
  probes: readonly DependencyProbe[],
  mode: ProbeMode,
  options: { concurrency?: number, installedTimeoutMs?: number, liveTimeoutMs?: number, signal?: AbortSignal } = {},
): Promise<DependencyStatus[]> {
  const concurrency = options.concurrency ?? 2
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new TypeError('probe concurrency must be a positive integer')
  const selected = probes.filter(probe => probe.mode === mode)
  const output = new Array<DependencyStatus>(selected.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, selected.length) }, async () => {
    while (cursor < selected.length) {
      const index = cursor++
      const probe = selected[index] as DependencyProbe
      output[index] = await runProbe(probe, mode, options)
    }
  })
  await Promise.all(workers)
  return output
}

async function runProbe(
  probe: DependencyProbe,
  mode: ProbeMode,
  options: { installedTimeoutMs?: number, liveTimeoutMs?: number, signal?: AbortSignal },
): Promise<DependencyStatus> {
  const timeoutMs = probe.timeoutMs ?? (mode === 'live' ? options.liveTimeoutMs ?? 15_000 : options.installedTimeoutMs ?? 5_000)
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new TypeError(`probe ${probe.id} timeout must be a positive integer`)
  const timeout = AbortSignal.timeout(timeoutMs)
  const signal = options.signal === undefined ? timeout : AbortSignal.any([options.signal, timeout])
  try {
    const value = await probe.run(signal)
    return sanitizeStatus({
      id: probe.id,
      label: probe.label,
      kind: probe.kind,
      required: probe.required,
      ...probe.requiredVersion === undefined ? {} : { requiredVersion: probe.requiredVersion },
      ...probe.remediation === undefined ? {} : { remediation: probe.remediation },
      ...value,
    })
  } catch (error) {
    const timedOut = timeout.aborted && options.signal?.aborted !== true
    return sanitizeStatus({
      id: probe.id,
      label: probe.label,
      kind: probe.kind,
      required: probe.required,
      state: 'error',
      summary: timedOut ? `Probe timed out after ${timeoutMs} ms` : errorMessage(error),
      ...probe.requiredVersion === undefined ? {} : { requiredVersion: probe.requiredVersion },
      ...probe.remediation === undefined ? {} : { remediation: probe.remediation },
    })
  }
}

/** Run one executable without a shell and return bounded, redacted output. */
export function commandProbe(
  command: string,
  args: readonly string[] = ['--version'],
  options: { cwd?: string, env?: Readonly<Record<string, string>>, successSummary?: string } = {},
): (signal: AbortSignal) => Promise<Pick<DependencyStatus, 'state' | 'summary' | 'detectedVersion'>> {
  return signal => new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      ...options.cwd === undefined ? {} : { cwd: options.cwd },
      env: options.env === undefined ? process.env : { ...process.env, ...options.env },
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', abort)
      if (error !== undefined) reject(error)
      else {
        const captured = redact(`${stdout}\n${stderr}`.trim()).slice(0, MAX_CAPTURE_CHARS)
        resolve({
          state: 'ready',
          summary: options.successSummary ?? (captured === '' ? `${command} is available` : captured.split(/\r?\n/u)[0] as string),
          ...(captured === '' ? {} : { detectedVersion: captured.split(/\r?\n/u)[0] as string }),
        })
      }
    }
    const abort = (): void => {
      child.kill()
      finish(new Error('Probe cancelled'))
    }
    signal.addEventListener('abort', abort, { once: true })
    child.stdout?.setEncoding('utf8').on('data', chunk => { if (stdout.length < MAX_CAPTURE_CHARS) stdout += String(chunk) })
    child.stderr?.setEncoding('utf8').on('data', chunk => { if (stderr.length < MAX_CAPTURE_CHARS) stderr += String(chunk) })
    child.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        settled = true
        signal.removeEventListener('abort', abort)
        resolve({ state: 'missing', summary: `${command} was not found` })
      } else finish(error)
    })
    child.on('close', code => finish(code === 0 ? undefined : new Error(redact(stderr || `${command} exited with code ${code ?? 'unknown'}`))))
  })
}

/** Check PATH without launching the target executable. */
export function executableProbe(command: string): () => Promise<Pick<DependencyStatus, 'state' | 'summary'>> {
  return async () => {
    const configured = process.env.PATH ?? ''
    const extensions = process.platform === 'win32'
      ? executableExtensions(command, process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD')
      : ['']
    for (const directory of configured.split(delimiter).filter(Boolean)) {
      for (const extension of extensions) {
        if (existsSync(join(directory, `${command}${extension}`))) {
          return { state: 'ready', summary: `${command} is available on PATH` }
        }
      }
    }
    return { state: 'missing', summary: `${command} was not found on PATH` }
  }
}

/** Run a safe version command and enforce an exact or minimum semver. */
export function versionedCommandProbe(
  command: string,
  args: readonly string[],
  requiredVersion: string,
  options: { cwd?: string, env?: Readonly<Record<string, string>> } = {},
): (signal: AbortSignal) => Promise<Pick<DependencyStatus, 'state' | 'summary' | 'detectedVersion'>> {
  const base = commandProbe(command, args, options)
  return async signal => {
    const result = await base(signal)
    if (result.state !== 'ready' || result.detectedVersion === undefined) return result
    const detected = semverOf(result.detectedVersion)
    const minimum = requiredVersion.startsWith('>=')
    const required = semverOf(minimum ? requiredVersion.slice(2) : requiredVersion)
    if (detected === undefined || required === undefined) {
      return { ...result, state: 'error', summary: `Could not compare ${command} version with ${requiredVersion}` }
    }
    const compatible = minimum ? compareSemver(detected, required) >= 0 : compareSemver(detected, required) === 0
    return compatible
      ? { ...result, summary: `${command} ${detected.join('.')} satisfies ${requiredVersion}` }
      : { ...result, state: 'version-mismatch', summary: `${command} ${detected.join('.')} does not satisfy ${requiredVersion}` }
  }
}

/** Derive a stable integration roll-up without hiding individual evidence. */
export function integrationOverall(status: Pick<IntegrationStatus, 'availability' | 'configuredEnabled' | 'runtime' | 'live'>): IntegrationStatus['overall'] {
  if (status.availability === 'unsupported-platform') return 'blocked'
  const required = [...status.runtime, ...status.live].filter(item => item.required)
  if (required.some(item => ['error', 'unsupported'].includes(item.state))) return 'blocked'
  if (!status.configuredEnabled) return 'not-checked'
  if (required.some(item => ['missing', 'unconfigured', 'stopped', 'unreachable', 'version-mismatch'].includes(item.state))) return 'needs-setup'
  if (required.some(item => item.state === 'not-checked')) return 'not-checked'
  return 'ready'
}

/** Compute the opaque revision carried through status/apply Remote calls. */
export function statusRevision(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

/** Construct one detached format-v1 status snapshot. */
export function statusSnapshot(mode: ProbeMode, revision: string, integrations: readonly IntegrationStatus[]): MultiToolsStatusSnapshot {
  return {
    formatVersion: 1,
    revision,
    mode,
    checkedAt: new Date().toISOString(),
    integrations: integrations.map(item => structuredClone(item)),
  }
}

function sanitizeStatus(status: DependencyStatus): DependencyStatus {
  return {
    ...status,
    summary: redact(status.summary).slice(0, MAX_CAPTURE_CHARS),
    ...status.detectedVersion === undefined ? {} : { detectedVersion: redact(status.detectedVersion).slice(0, 512) },
    ...status.remediation === undefined ? {} : {
      remediation: { ...status.remediation, text: redact(status.remediation.text).slice(0, 2_000) },
    },
  }
}

function redact(value: string): string {
  return value.replace(SECRET_PATTERN, '[redacted]')
}

function executableExtensions(command: string, pathExt: string): string[] {
  if (extname(command) !== '') return ['']
  return pathExt.split(';').filter(Boolean).map(value => value.toLowerCase())
}

function semverOf(value: string): [number, number, number] | undefined {
  const match = /(?:^|\D)(\d+)\.(\d+)\.(\d+)(?:\D|$)/u.exec(value)
  if (match === null) return undefined
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function compareSemver(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < 3; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0)
    if (delta !== 0) return delta
  }
  return 0
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
