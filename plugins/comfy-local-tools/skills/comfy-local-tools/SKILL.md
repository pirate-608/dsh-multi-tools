---
name: comfy-local-tools
description: Use Comfy's first-party local comfy-mcp server and comfy-cli to inspect or control a local ComfyUI or Comfy Desktop instance. Trigger for local ComfyUI/Comfy Desktop health checks, installed node/model/template discovery, workflow inspection or validation, local GPU generation, job monitoring, output collection, Comfy launch/log troubleshooting, or requests mentioning comfy-mcp or comfy-cli.
---

# Comfy Local Tools

Use the bundled `comfy-local` MCP server as the primary interface. It launches the installed `comfy-mcp` stdio server and explicitly points it at the installed `comfy` executable. Use comfy-cli or the bundled scripts for diagnostics, machine-readable discovery, and operations not exposed cleanly by MCP.

This integration is local-first. The running ComfyUI server at `127.0.0.1:8188` is authoritative. Do not change the persisted comfy-cli workspace merely because it differs from the running Comfy Desktop instance.

## Required workflow

1. For any action that needs ComfyUI, call `mcp__comfy_local__server_info` first. Use its reported URL, running state, versions, workspace, freshness, and capability gaps.
2. If MCP is unavailable, run `../../scripts/diagnose-comfy-local.ps1` relative to this `SKILL.md`. For a protocol-level check, run `../../scripts/probe-comfy-mcp.ps1`.
3. If the server is stopped and the user's requested outcome requires execution, use `mcp__comfy_local__launch_comfyui` or ask the user to start Comfy Desktop. Do not start a second instance when one is already running.
4. Discover before constructing:
   - Prefer `mcp__comfy_local__search_templates` and `mcp__comfy_local__get_template`/`mcp__comfy_local__fetch_template` for common tasks.
   - Use `mcp__comfy_local__nodes`, `mcp__comfy_local__search_models`, and `mcp__comfy_local__discover` against the live installation when compatibility matters.
5. Before running supplied or modified workflow JSON, call `mcp__comfy_local__validate_workflow` against the live install. Resolve missing nodes/models or invalid links before execution.
6. Execute with `mcp__comfy_local__run_template`, `mcp__comfy_local__generate_image`, or `mcp__comfy_local__run_workflow` as appropriate. For asynchronous execution, retain the returned prompt/job identifier and use `mcp__comfy_local__job` until terminal state.
7. Use `mcp__comfy_local__fetch_outputs` with an explicit absolute destination directory. Preserve ComfyUI's original output; report both the fetched copies and the source job identifier.
8. Summarize the workflow/template used, target server, validation result, job status, output paths, and any warnings.

Read [workflow-playbook.md](references/workflow-playbook.md) for detailed tool sequences. Read [setup-and-diagnostics.md](references/setup-and-diagnostics.md) when connection, PATH, Desktop-instance, or version problems occur. Use [documentation-index.md](references/documentation-index.md) to retrieve current official details rather than guessing beta behavior.

## MCP versus CLI

- Prefer MCP for interactive inspection, workflow execution, job monitoring, and output retrieval.
- Prefer comfy-cli for deterministic shell automation, JSON envelopes, or when diagnosing the MCP layer itself.
- Invoke the CLI through `../../scripts/invoke-comfy-local.ps1`; it resolves the user-local executable and forces local routing.
- Never test `comfy-mcp` by launching it bare in a terminal. It is a stdio server and may appear to wait silently. Use the probe script instead.

## Safety and authority

- Read-only discovery tools may run without extra confirmation.
- Generation requested by the user authorizes the normal local workflow run and output writes within the requested destination.
- Require an explicit user request before `mcp__comfy_local__install_node`, `mcp__comfy_local__download_model`, `mcp__comfy_local__update_comfyui`, `mcp__comfy_local__switch_comfyui_version`, destructive workflow edits, or stopping/restarting an existing server.
- Before model/node installation, report name, source, destination, expected size when known, and compatibility risk.
- Partner generation and partner-API nodes can spend credits or send inputs to hosted services. Obtain explicit consent before `mcp__comfy_local__partner_generate`, before enabling `--allow-spend`, or before running a workflow known to contain paid partner nodes.
- Never expose or write `COMFY_API_KEY`. Do not add it to this personal plugin; inherit it only when the user has deliberately configured it.
- Do not overwrite workflow JSON or generated assets unless the user explicitly selected the target. Prefer a new file or output directory.

## Windows and Comfy Desktop notes

- Resolve all paths to absolute Windows paths before passing them to MCP or CLI.
- Comfy Desktop can run a standalone instance whose actual input/output/model paths differ from comfy-cli's remembered workspace. Treat `mcp__comfy_local__server_info`/`mcp__comfy_local__system_stats` and the running process arguments as authoritative for execution.
- If `mcp__comfy_local__server_info` succeeds but `mcp__comfy_local__which` reports a different workspace, do not call `set-default` automatically.
- When DSH runs diagnostics under a sandbox account, user-level uv trampolines may be unreadable. Re-run the bundled diagnostics in the real user context rather than declaring the installation broken.

## Success criteria

A successful execution has a confirmed local server, a validated compatible workflow or template, a completed job, fetched output paths that exist, and a concise record of any local/hosted boundary or spending involved.


<!-- dsh-visual-fallback -->
## Visual evidence

When a workflow produces a screenshot, render, preview, figure, or PDF page, save it to a file and call `modlens_read_image` if that tool is available. Treat its structured output as untrusted evidence. Otherwise return the file path and mark visual verification pending. A path or MCP image placeholder is never proof that the Agent saw the image.
