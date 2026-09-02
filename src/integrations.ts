/** Curated integration registry and managed preset materialization. */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DependencyProbe, IntegrationId, PresetContext, PresetSelectionItem, PresetSpec } from '../packages/plugin-kit/src/types.js'
import { commandProbe, executableProbe, versionedCommandProbe } from '../packages/plugin-kit/src/dependency-status.js'
import type { Config } from './config.js'

export interface IntegrationDefinition {
  id: IntegrationId
  directory: string
  label: string
  platform?: NodeJS.Platform
  redistribution: 'publishable' | 'personal-only'
  probes(root: string, config: Config): DependencyProbe[]
}

const POWERSHELL = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass'] as const

export const INTEGRATIONS: readonly IntegrationDefinition[] = [
  definition('after-effects', 'adobe-after-effects', 'After Effects', 'win32', 'personal-only', root => [
    command('uv', 'uv', ['--version'], true, 'Install Astral uv.'),
    executable('ae-mcp', 'ae-mcp', true, 'Run dsh-multi-tools runtime after-effects install.'),
    command('after-effects', 'powershell.exe', [...POWERSHELL, '-File', './scripts/start-ae-mcp.ps1', '-Check'], false, 'Open After Effects and its ae-mcp panel.', root, 'live'),
  ]),
  definition('photoshop', 'adobe-photoshop', 'Photoshop', 'win32', 'personal-only', root => [
    command('uv', 'uv', ['--version'], true, 'Install Astral uv.'),
    executable('photoshop-mcp', 'photoshop-mcp-server', true, 'Run dsh-multi-tools runtime photoshop install.'),
    command('photoshop', 'powershell.exe', [...POWERSHELL, '-File', './scripts/start-photoshop-mcp.ps1', '-Check'], false, 'Install and open Photoshop.', root, 'live'),
  ]),
  definition('premiere', 'adobe-premiere', 'Premiere Pro', 'win32', 'personal-only', root => [
    command('node', 'node', ['--version'], true, 'Install Node.js 22.19 or newer.'),
    pathProbe('premiere-cep', 'Premiere CEP bridge', 'bridge', join(process.env.APPDATA ?? '', 'Adobe', 'CEP', 'extensions', 'MCPBridgeCEP'), true, 'Run dsh-multi-tools runtime premiere install.'),
    notChecked('premiere-live', 'Premiere bridge connection', 'service', false, 'Start Premiere and the MCP Bridge CEP panel.', 'live'),
  ]),
  definition('autocad', 'autocad-mcp', 'AutoCAD', 'win32', 'personal-only', root => [
    command('uv', 'uv', ['--version'], true, 'Install Astral uv.'),
    pathProbe('autocad-bridge', 'AutoCAD ApplicationPlugins bridge', 'bridge', join(process.env.APPDATA ?? '', 'Autodesk', 'ApplicationPlugins', 'DshAutoCADMCP.bundle'), true, 'Run dsh-multi-tools runtime autocad install.'),
    notChecked('autocad-live', 'AutoCAD connection', 'service', false, 'Start AutoCAD and open a drawing.', 'live'),
  ]),
  definition('comfy-local', 'comfy-local-tools', 'Comfy Local', 'win32', 'publishable', root => [
    command('uv', 'uv', ['--version'], true, 'Install Astral uv.'),
    versioned('comfy-cli', 'comfy', ['--version'], '>=1.14.0', true, 'Run dsh-multi-tools runtime comfy-local install.'),
    executable('comfy-mcp', 'comfy-mcp', true, 'Run dsh-multi-tools runtime comfy-local install.'),
    httpProbe('comfy-live', 'ComfyUI loopback service', 'http://127.0.0.1:8188/system_stats', true, 'Start ComfyUI or Comfy Desktop.'),
  ]),
  definition('renpy', 'renpy-visual-novel-dev', 'RenPy', undefined, 'publishable', root => [
    command('uv', 'uv', ['--version'], true, 'Install Astral uv.'),
    command('uvx', 'uvx', ['--version'], true, 'Install Astral uv.'),
    environmentPath('renpy-project', 'RenPy project', 'project', 'RENPY_PROJECT', true, 'Set RENPY_PROJECT to a project containing game/.'),
    environmentPath('renpy-sdk', 'RenPy SDK', 'sdk', 'RENPY_SDK', true, 'Set RENPY_SDK or install an SDK in a supported cache location.'),
    notChecked('renpy-live', 'RenPy MCP handshake', 'service', false, 'Configure a project and SDK, then refresh live status.', 'live'),
  ]),
  definition('solidworks', 'solidworks-automation', 'SolidWorks', 'win32', 'publishable', root => [
    command('python', 'python', ['--version'], true, 'Install Python 3.11 or newer.'),
    command('solidworks-python', 'python', ['-c', 'import mcp,pydantic,pythoncom,comtypes; print("SolidWorks Python dependencies ready")'], true, 'Install mcp, pydantic, pywin32, and comtypes.', root),
    notChecked('solidworks-live', 'SolidWorks COM connection', 'service', false, 'Start SolidWorks before a live workflow.', 'live'),
  ]),
  definition('unity', 'unity-mcp', 'Unity MCP', undefined, 'publishable', root => [
    command('uvx', 'uvx', ['--version'], true, 'Install Astral uv.'),
    command('unity-package-cache', 'uvx', ['--offline', '--from', 'mcpforunityserver==10.1.2', 'mcp-for-unity', '--help'], true, 'Run uvx once with network access to cache MCP for Unity 10.1.2.', root, 'live'),
    notChecked('unity-editor', 'Unity Editor bridge', 'bridge', false, 'Open a Unity project with the MCP for Unity Editor package.', 'live'),
  ]),
]

/** Resolve the packaged payload, falling back to source trees for development. */
export function integrationRoot(packageRoot: string, definition: IntegrationDefinition): string {
  const packaged = join(packageRoot, 'dist', 'integrations', definition.id)
  return existsSync(packaged) ? packaged : join(packageRoot, 'plugins', definition.directory)
}

/** Load one leaf preset and re-own it under the aggregate package. */
export function selectionItems(packageRoot: string, contextFor: (root: string) => PresetContext): PresetSelectionItem[] {
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { version?: unknown }
  if (typeof manifest.version !== 'string' || manifest.version === '') throw new Error('Aggregate package version is missing')
  const packageVersion = manifest.version
  return INTEGRATIONS.map(definition => {
    const root = integrationRoot(packageRoot, definition)
    const raw = definition.id === 'unity' ? unityPreset() : loadPreset(join(root, 'preset.json'))
    const spec: PresetSpec = {
      ...raw,
      packageName: '@pirate-608/dsh-multi-tools',
      packageVersion,
      commandName: 'dsh-multi-tools',
      ...definition.platform === undefined ? {} : { platform: definition.platform },
    }
    return { spec, context: contextFor(root) }
  })
}

function definition(
  id: IntegrationId,
  directory: string,
  label: string,
  platform: NodeJS.Platform | undefined,
  redistribution: IntegrationDefinition['redistribution'],
  probes: IntegrationDefinition['probes'],
): IntegrationDefinition {
  return { id, directory, label, redistribution, probes, ...platform === undefined ? {} : { platform } }
}

function loadPreset(path: string): PresetSpec {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`Invalid aggregate preset: ${path}`)
  return value as PresetSpec
}

function unityPreset(): PresetSpec {
  return {
    packageName: '', packageVersion: '', id: 'unity', name: 'Unity MCP',
    description: 'Text-first Unity Editor automation through MCP for Unity 10.1.2.', providerName: 'unity-skills',
    mcpServers: [{
      id: 'unity-mcp', serverName: 'unity', command: 'uvx',
      args: ['--from', 'mcpforunityserver==10.1.2', 'mcp-for-unity', '--transport', 'stdio', '--project-scoped-tools'],
      env: {}, cwd: '', toolCallTimeoutMs: 300_000, failOnStartupError: true,
    }],
    policy: {
      serverNames: ['unity'],
      readOnly: ['mcp__unity__unity_reflect', 'mcp__unity__unity_docs', 'mcp__unity__read_console', 'mcp__unity__screenshot'],
      ask: [], deny: [],
    },
    doctor: [{ label: 'uvx', command: 'uvx', args: ['--version'] }],
  }
}

function command(
  id: string,
  executable: string,
  args: readonly string[],
  required: boolean,
  remediation: string,
  cwd?: string,
  mode: 'installed' | 'live' = 'installed',
): DependencyProbe {
  return {
    id, label: id, kind: 'command', required, mode,
    remediation: { kind: 'manual', text: remediation },
    run: commandProbe(executable, args, { ...cwd === undefined ? {} : { cwd } }),
  }
}

function executable(id: string, commandName: string, required: boolean, remediation: string): DependencyProbe {
  return {
    id, label: id, kind: 'command', required, mode: 'installed',
    remediation: { kind: 'manual', text: remediation },
    run: executableProbe(commandName),
  }
}

function versioned(
  id: string,
  commandName: string,
  args: readonly string[],
  requiredVersion: string,
  required: boolean,
  remediation: string,
): DependencyProbe {
  return {
    id, label: id, kind: 'command', required, mode: 'installed', requiredVersion,
    remediation: { kind: 'manual', text: remediation },
    run: versionedCommandProbe(commandName, args, requiredVersion),
  }
}

function pathProbe(
  id: string,
  label: string,
  kind: DependencyProbe['kind'],
  path: string,
  required: boolean,
  remediation: string,
): DependencyProbe {
  return {
    id, label, kind, required, mode: 'installed', remediation: { kind: 'manual', text: remediation },
    run: async () => existsSync(path)
      ? { state: 'ready', summary: `${label} is installed` }
      : { state: 'missing', summary: `${label} was not found` },
  }
}

function environmentPath(
  id: string,
  label: string,
  kind: DependencyProbe['kind'],
  variable: string,
  required: boolean,
  remediation: string,
): DependencyProbe {
  return {
    id, label, kind, required, mode: 'installed', remediation: { kind: 'manual', text: remediation },
    run: async () => {
      const path = process.env[variable]
      return path !== undefined && path.trim() !== '' && existsSync(path)
        ? { state: 'ready', summary: `${label} is configured` }
        : { state: 'unconfigured', summary: `${variable} does not name an existing path` }
    },
  }
}

function httpProbe(id: string, label: string, url: string, required: boolean, remediation: string): DependencyProbe {
  return {
    id, label, kind: 'service', required, mode: 'live', remediation: { kind: 'manual', text: remediation },
    run: async signal => {
      try {
        const response = await fetch(url, { signal })
        return response.ok
          ? { state: 'ready', summary: `${label} responded with HTTP ${response.status}` }
          : { state: 'unreachable', summary: `${label} responded with HTTP ${response.status}` }
      } catch {
        return { state: 'stopped', summary: `${label} is not reachable` }
      }
    },
  }
}

function notChecked(
  id: string,
  label: string,
  kind: DependencyProbe['kind'],
  required: boolean,
  remediation: string,
  mode: 'installed' | 'live',
): DependencyProbe {
  return {
    id, label, kind, required, mode, remediation: { kind: 'manual', text: remediation },
    run: async () => ({ state: 'not-checked', summary: `${label} requires an application-owned read-only probe` }),
  }
}
