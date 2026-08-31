import { readFile, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const PLUGINS = join(ROOT, 'plugins')
const MIGRATED = [
  'adobe-after-effects', 'adobe-photoshop', 'adobe-premiere', 'autocad-mcp',
  'comfy-local-tools', 'renpy-visual-novel-dev', 'solidworks-automation',
]
const COMFY_TOOLS = [
  'server_info', 'system_stats', 'nodes', 'discover', 'search_models', 'search_templates',
  'get_template', 'fetch_template', 'validate_workflow', 'job', 'get_logs', 'which',
  'workflow_deps', 'node_dependencies', 'list_workflow_slots', 'generate_image',
  'run_template', 'run_workflow', 'vary_workflow', 'fetch_outputs', 'upload_file',
  'set_workflow_slot', 'launch_comfyui', 'restart_comfyui', 'stop_comfyui', 'free_memory',
  'install_node', 'download_model', 'update_comfyui', 'switch_comfyui_version', 'partner_generate',
]

describe('migrated package contracts', () => {
  it('ships every independent package with an inert bundle and managed preset', async () => {
    for (const directory of MIGRATED) {
      const root = join(PLUGINS, directory)
      const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
        name: string
        scripts: Record<string, string>
        dsh: { bundle: { patch: string } }
        dependencies: Record<string, string>
      }
      const presets = JSON.parse(await readFile(join(root, 'preset.json'), 'utf8')) as unknown
      expect(manifest.name).toMatch(/^@pirate-608\/dsh-/u)
      expect(manifest.scripts.postinstall).toBeUndefined()
      expect(manifest.dependencies['@pirate-608/dsh-plugin-kit']).toBe('workspace:^')
      expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
      expect(await readFile(join(root, 'cordis.patch.yml'), 'utf8')).toBe('[]\n')
      expect(Array.isArray(presets) ? presets.length : 1).toBeGreaterThan(0)
    }
  })

  it('contains no Codex manifests, agent metadata, virtualenvs, or inline MCP config', async () => {
    const forbidden: string[] = []
    await walk(PLUGINS, path => {
      const normalized = path.replaceAll('\\', '/')
      if (normalized.includes('/unity-mcp/')) return
      if (normalized.endsWith('/agents/openai.yaml') || normalized.includes('/.venv/')
        || normalized.includes('/.codex-plugin/') || normalized.endsWith('/.mcp.json')) forbidden.push(normalized)
    })
    expect(forbidden).toEqual([])
  })

  it('qualifies MCP tool names and removes Codex-only execution assumptions from skills', async () => {
    const problems: string[] = []
    const rawPatterns = [
      /(?<!mcp__after_effects__)\bae_[A-Za-z0-9_]+\b/u,
      /(?<!mcp__photoshop__)\bphotoshop_[A-Za-z0-9_]+\b/u,
      /(?<!mcp__solidworks__)\bsolidworks_[A-Za-z0-9_]+\b/u,
    ]
    for (const directory of MIGRATED) {
      const skills = join(PLUGINS, directory, 'skills')
      await walk(skills, async path => {
        if (!path.endsWith('.md')) return
        const text = await readFile(path, 'utf8')
        if (path.endsWith('SKILL.md') && !text.includes('<!-- dsh-visual-fallback -->')) problems.push(path)
        if (/\$CODEX_HOME|CODEX_|computer-use|agents\/openai\.yaml|premiere:\/\//u.test(text)
          || rawPatterns.some(pattern => pattern.test(text))) problems.push(path)
        if (directory === 'comfy-local-tools' && COMFY_TOOLS.some(tool => text.includes(`\`${tool}\``))) {
          problems.push(path)
        }
      })
    }
    expect(problems).toEqual([])
  })

  it('keeps every MCP policy namespaced and fail-closed', async () => {
    for (const directory of MIGRATED) {
      const raw = JSON.parse(await readFile(join(PLUGINS, directory, 'preset.json'), 'utf8')) as Record<string, unknown> | Array<Record<string, unknown>>
      for (const preset of Array.isArray(raw) ? raw : [raw]) {
        const servers = (preset.mcpServers ?? []) as Array<{ serverName: string }>
        const policy = preset.policy as { serverNames: string[], readOnly: string[], ask: string[], deny: string[] } | undefined
        if (servers.length === 0) { expect(policy).toBeUndefined(); continue }
        expect(policy).toBeDefined()
        expect(policy?.serverNames.sort()).toEqual(servers.map(server => server.serverName).sort())
        for (const name of [...(policy?.readOnly ?? []), ...(policy?.ask ?? []), ...(policy?.deny ?? [])]) {
          expect(policy?.serverNames.some(server => name.startsWith(`mcp__${server}__`))).toBe(true)
        }
      }
    }
  })

  it('enforces the AutoCAD, Comfy, and RenPy special constraints', async () => {
    const autocad = await preset('autocad-mcp')
    expect(autocad.mcpServers[0].env.AUTOCAD_MCP_ONLY_TEXT).toBe('true')
    const comfy = await preset('comfy-local-tools')
    expect(comfy.mcpServers[0].serverName).toBe('comfy_local')
    expect(comfy.mcpServers[0].toolCallTimeoutMs).toBe(900000)
    expect(comfy.policy.ask).toEqual(expect.arrayContaining([
      'mcp__comfy_local__partner_generate',
      'mcp__comfy_local__install_node',
      'mcp__comfy_local__download_model',
    ]))
    expect(JSON.stringify(comfy)).not.toContain('COMFY_API_KEY')
    const renpyStart = await readFile(join(PLUGINS, 'renpy-visual-novel-dev', 'scripts', 'start_renpy_mcp.py'), 'utf8')
    expect(renpyStart).not.toContain('CODEX_')
    expect(renpyStart).toContain('RENPY_PROJECT')
  })

  it('blocks publication where first-party licensing is unresolved', async () => {
    for (const directory of ['adobe-after-effects', 'adobe-photoshop', 'adobe-premiere', 'autocad-mcp']) {
      const manifest = JSON.parse(await readFile(join(PLUGINS, directory, 'package.json'), 'utf8')) as { private?: boolean, license?: string }
      expect(manifest).toMatchObject({ private: true, license: 'UNLICENSED' })
    }
  })

  it('records source and third-party notices for every migrated package', async () => {
    for (const directory of MIGRATED) {
      const entries = await readdir(join(PLUGINS, directory))
      expect(entries).toContain('UPSTREAM.json')
      expect(entries).toContain('NOTICE.md')
      const manifest = JSON.parse(await readFile(join(PLUGINS, directory, 'package.json'), 'utf8')) as { private?: boolean }
      if (manifest.private !== true) expect(entries).toContain('LICENSE')
    }
  })
})

async function preset(directory: string): Promise<any> {
  return JSON.parse(await readFile(join(PLUGINS, directory, 'preset.json'), 'utf8'))
}

async function walk(root: string, visit: (path: string) => void | Promise<void>): Promise<void> {
  let entries
  try { entries = await readdir(root, { withFileTypes: true }) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  for (const entry of entries) {
    const path = join(root, entry.name)
    await visit(path)
    if (entry.isDirectory()) await walk(path, visit)
  }
}
