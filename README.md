# DSH Multi Tools

English | [简体中文](README.zh-CN.md)

A private, install-once multimodal integration suite for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 0.1.2-alpha.3 or newer. One bundle adds the ModLens vision core, a Multi Tools settings page, dependency status, and independently managed Agent Presets for creative applications, game engines, and CAD tools.

## Install

Remove `@liustack/modlens` or `@pirate-608/dsh-modlens` from the target profile before installing this aggregate. Each standalone package registers `modlens_read_image`, so the aggregate refuses to start beside either one.

```powershell
dsh plugin --profile web add github:pirate-608/dsh-multi-tools
```

Git dependencies build their Host and browser bundles during pnpm installation. The first `add` can stop with `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`; this is pnpm asking for permission to execute the repository's `prepare` script outside the agent sandbox. Copy the exact package key from that error into `C:\Users\<user>\.dsh\profiles\web\pnpm-workspace.yaml`, quote the key, and repeat the same command:

```yaml
allowBuilds:
  '<exact package key printed by pnpm>': true
```

Authorize only a reviewed commit. For a review build, install a pinned ref such as `github:pirate-608/dsh-multi-tools#<full-commit-sha>` and allow the archive key printed for that exact commit. The package has no `postinstall` hook and does not install MCP runtimes, download models, or start desktop applications.

Restart the Web profile, then open **Settings → Plugins → Multi Tools**. ModLens is always present but has no route by default. Every optional integration starts disabled; enabling one creates its dedicated managed Preset for new sessions.

## Multimodal workflow

- `modlens` turns image files into logged structured evidence for text-only models through local Codex, an OpenAI-compatible endpoint, or local Ollama.
- `comfy-local` inspects and runs local ComfyUI workflows through Comfy's first-party MCP and CLI tools.
- Unity, Adobe, CAD, and Ren'Py integrations produce structured state plus file-based screenshots, previews, renders, or exports. They can pass those files to ModLens when visual interpretation is needed.
- Native multimodal adapters remain in control of their own image input. The fallback never guesses capability from a model name.

The status page performs a passive installed check when opened. A live check runs only after the user requests it and contacts loopback services or short-lived local MCP probes without installing, downloading, launching applications, or exercising cloud vision routes.

## CLI

```text
dsh-multi-tools status [--live] [--json] [--integration <id>]
dsh-multi-tools doctor
dsh-multi-tools integrations set [<id>...] [--json]
dsh-multi-tools runtime <id> install|remove
```

Runtime actions remain explicit CLI operations. Unsupported removals fail clearly instead of guessing which user files are safe to delete.

ModLens routes live in the `dsh-multi-tools` section of the DSH settings document. No route is implied by installation:

```yaml
dsh-multi-tools:
  modlens:
    routes:
      ollama:
        type: ollama
        baseUrl: http://127.0.0.1:11434
        model: qwen3-vl
    failover: [ollama]
```

Codex reuse additionally requires `consent: true`; OpenAI-compatible secrets remain DSH credential references rather than literal settings values.

## Included integrations

| Package | Purpose |
| --- | --- |
| `modlens` | Always-on text-first visual evidence through an explicitly configured Codex, OpenAI-compatible, or Ollama route |
| `comfy-local` | Local ComfyUI discovery, workflow validation, generation, job monitoring, and output collection |
| `unity` | Unity Editor automation through MCP for Unity 10.1.2 with file-based visual evidence |
| `after-effects` | After Effects automation through ae-mcp |
| `photoshop` | Photoshop automation through Windows COM |
| `premiere` | Premiere Pro automation through a CEP bridge |
| `autocad` | AutoCAD and headless DXF automation |
| `solidworks` | SolidWorks COM and MCP workflows |
| `renpy` | Ren'Py development, preview, and validation |

The aggregate build copies an explicit allowlist of integration payloads and records a SHA-256 manifest. It excludes virtual environments, caches, tests, Codex manifests, and workspace dependencies. After Effects, Photoshop, Premiere, and AutoCAD remain personal-build integrations because their first-party redistribution status has not been resolved; this root package is private and must not be published to npm.

## Development

Requires Node.js 22.19+ or 24+ and pnpm 10.

```sh
pnpm install
pnpm run check
```

Build and test commands do not publish the package, install external runtimes, download models, or connect to local creative applications.
