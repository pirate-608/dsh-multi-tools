# pirate-608 DSH Multi Tools

English | [简体中文](README.zh-CN.md)

A curated multimodal tool suite for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It combines visual understanding, local image generation, game-engine workflows, creative applications, and CAD automation while keeping every domain in an isolated Agent Preset.

## Multimodal workflow

- `dsh-modlens` turns image files into logged structured evidence for text-only models through local Codex, an OpenAI-compatible endpoint, or local Ollama.
- `dsh-comfy-local-tools` inspects and runs local ComfyUI workflows through Comfy's first-party MCP and CLI tools.
- Unity, Adobe, CAD, and Ren'Py integrations produce structured state plus file-based screenshots, previews, renders, or exports. They can pass those files to ModLens when visual interpretation is needed.
- Native multimodal adapters remain in control of their own image input. The fallback never guesses capability from a model name.

There is deliberately no install-all package. Install only the domain packages needed by a DSH profile; each package derives a managed Preset from the active DSH `standard` preset, and standard sessions receive none of these tools.

## Packages

| Package | Purpose |
| --- | --- |
| `@pirate-608/dsh-plugin-kit` | Shared managed-Preset lifecycle and fail-closed MCP approval policy |
| `@pirate-608/dsh-modlens` | Text-first visual evidence through local Codex, OpenAI-compatible endpoints, and local Ollama |
| `@pirate-608/dsh-comfy-local-tools` | Local ComfyUI discovery, workflow validation, generation, job monitoring, and output collection |
| `@pirate-608/dsh-unity-mcp` | Unity Editor automation through MCP for Unity 10.1.2 with file-based visual evidence |
| `@pirate-608/dsh-after-effects` | After Effects automation through ae-mcp |
| `@pirate-608/dsh-photoshop` | Photoshop automation through Windows COM |
| `@pirate-608/dsh-premiere` | Premiere Pro automation through a CEP bridge |
| `@pirate-608/dsh-autocad-mcp` | AutoCAD and headless DXF automation |
| `@pirate-608/dsh-solidworks-automation` | SolidWorks COM and MCP workflows |
| `@pirate-608/dsh-renpy-visual-novel-dev` | Ren'Py development, preview, and validation |

The shared `@pirate-608/dsh-plugin-kit` keeps lifecycle behavior and unknown-tool approval consistent. Packages with unresolved first-party licensing remain private and cannot be published. Runtime installation is always an explicit command; npm installation has no software-installing `postinstall` hook.

## Development

Requires Node.js 22.19+ or 24+ and pnpm 10.

```sh
pnpm install
pnpm run check
```

No package is published, installed into DSH, or connected to a local creative application by the test or build commands.
