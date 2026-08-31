# Setup and diagnostics

## Expected personal installation

- Standalone uv executables: `%USERPROFILE%\.local\bin\uv.exe`, `uvx.exe`, `uvw.exe`
- comfy-cli installed as a uv tool: `%USERPROFILE%\.local\bin\comfy.exe`
- comfy-mcp installed as a uv tool: `%USERPROFILE%\.local\bin\comfy-mcp.exe`
- uv tool environments: `%APPDATA%\uv\tools\comfy-cli` and `%APPDATA%\uv\tools\comfy-mcp`

The plugin startup script resolves these locations first, then falls back to `Get-Command`. Override with `COMFY_BIN` or `COMFY_MCP_BIN` only when intentionally using another installation.

## Diagnostic order

1. Run `scripts/diagnose-comfy-local.ps1`.
2. Confirm both executable paths and comfy-cli version >= 1.14.0.
3. Inspect `environment.data.server.running` and URL.
4. If the running environment is Comfy Desktop, inspect `system_stats.data.system.argv`, input/output directories, and deployment environment.
5. Run `scripts/probe-comfy-mcp.ps1` to verify MCP initialize, tool discovery, and `mcp__comfy_local__server_info`.
6. Only after the protocol probe succeeds should client/plugin loading be blamed.

## Common failure modes

- `comfy` not found: set `COMFY_BIN` to the absolute uv-tool trampoline path.
- MCP appears to hang in a terminal: expected for a stdio server; use the probe script.
- MCP tools appear twice: two client entries point to the same `comfy-mcp` command. Keep one server key.
- `mcp__comfy_local__server_info` reports no running server: start Comfy Desktop or use `mcp__comfy_local__launch_comfyui`; the MCP server does not launch ComfyUI implicitly.
- `comfy which` differs from the running Desktop instance: do not rewrite defaults automatically. The live server and its process arguments are authoritative.
- User-level trampoline fails only in DSH sandbox: run the diagnostic in the user's execution context; the uv tool itself may be healthy.

## Updating

Update tools deliberately and verify afterward:

```powershell
uv self update
uv tool upgrade comfy-cli
uv tool upgrade comfy-mcp
powershell -NoProfile -File .\scripts\probe-comfy-mcp.ps1
```

Comfy MCP is beta. Re-check the official MCP page and repository changelog after upgrades.
