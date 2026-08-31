<!-- dsh-package-header -->
# @pirate-608/dsh-comfy-local-tools

Local-first ComfyUI generation and workflow automation through first-party MCP and CLI tools.

Install into a DSH profile, then create the dedicated preset:

```sh
dsh plugin --profile web add @pirate-608/dsh-comfy-local-tools
dsh plugin --profile web exec dsh-comfy-local-tools preset install
dsh plugin --profile web exec dsh-comfy-local-tools doctor
```

Managed preset id: `comfy-local`. The standard preset does not receive this package's tools or skills. MCP writes and unknown tools require one-shot approval.
<!-- /dsh-package-header -->

# Comfy Local Tools

Local-first DSH workflows for ComfyUI and Comfy Desktop using Comfy's first-party `comfy-mcp` server and `comfy-cli`.

## Capabilities

- Inspect the running local ComfyUI instance, nodes, models, templates, logs, and system information.
- Validate and execute workflow JSON or compatible templates.
- Monitor jobs and copy generated outputs into an explicit destination.
- Diagnose the local MCP/CLI installation without treating a stdio server as a normal terminal command.

The plugin asks before installing nodes or models, updating or restarting ComfyUI, switching versions, or using hosted partner operations that may transmit data or spend credits.

## Requirements

- Windows DSH.
- ComfyUI or Comfy Desktop.
- [`uv`](https://docs.astral.sh/uv/) with the first-party tools installed:

```powershell
dsh plugin --profile web exec dsh-comfy-local-tools runtime install
```

The runtime command installs only missing `comfy-cli` and `comfy-mcp` uv tools. It does not install ComfyUI, download models, start a service, update existing tools, or configure credentials.

The launch script resolves `%USERPROFILE%\.local\bin\comfy.exe` and the uv tool environment first, then falls back to `PATH`. Set `COMFY_BIN` or `COMFY_MCP_BIN` only when intentionally using another installation.

## Diagnostics

```powershell
powershell -NoProfile -File .\scripts\diagnose-comfy-local.ps1
powershell -NoProfile -File .\scripts\probe-comfy-mcp.ps1
```

Start Comfy Desktop or a local ComfyUI server before executing workflows. The running server at `127.0.0.1:8188` is authoritative; the plugin does not silently change the persisted comfy-cli workspace.

## Privacy

Normal discovery and generation stay on the configured local ComfyUI instance. Partner API nodes and `partner_generate` can send inputs to hosted services or consume credits, so the Skill requires explicit consent before using them. The plugin does not bundle or store `COMFY_API_KEY`.

## Upstream

- [Local Comfy MCP documentation](https://docs.comfy.org/agent-tools/mcp)
- [Comfy MCP repository](https://github.com/Comfy-Org/comfy-mcp)
- [Comfy CLI documentation](https://docs.comfy.org/agent-tools/cli)

No upstream binaries, models, or source trees are vendored. The plugin's wrapper scripts and Skill are licensed under MIT.
