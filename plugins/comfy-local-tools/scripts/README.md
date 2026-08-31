# Scripts

- `start-comfy-mcp.ps1` — plugin MCP entrypoint. Resolves the uv-tool Python and comfy executable, sets `COMFY_BIN`, and starts the stdio server without writing protocol noise to stdout.
- `install-comfy-tools.ps1` — explicit runtime installer for missing first-party `comfy-cli` and `comfy-mcp` uv tools.
- `diagnose-comfy-local.ps1` — produces a JSON health report for comfy-cli, the selected workspace, the running local server, and Comfy Desktop details.
- `invoke-comfy-local.ps1` — calls the installed comfy CLI with `--where local`, independent of the caller's PATH.
- `probe-comfy-mcp.ps1` / `probe-comfy-mcp.py` — performs an MCP initialize/list-tools handshake and optionally calls the read-only `mcp__comfy_local__server_info` tool.

Examples:

```powershell
powershell -NoProfile -File .\scripts\diagnose-comfy-local.ps1
powershell -NoProfile -File .\scripts\probe-comfy-mcp.ps1
powershell -NoProfile -File .\scripts\invoke-comfy-local.ps1 --json which
```
