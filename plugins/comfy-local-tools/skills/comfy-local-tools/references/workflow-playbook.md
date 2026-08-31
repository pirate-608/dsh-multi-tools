# Workflow playbook

## Health and inventory

1. `mcp__comfy_local__server_info`
2. `mcp__comfy_local__system_stats` when hardware/runtime detail is needed
3. `mcp__comfy_local__discover`, `mcp__comfy_local__nodes`, `mcp__comfy_local__search_models`, or `mcp__comfy_local__search_templates` for the requested inventory

Do not infer available models or custom nodes from generic ComfyUI knowledge; query the live installation.

## Run an existing workflow

1. Resolve the workflow to an absolute JSON path.
2. `mcp__comfy_local__validate_workflow`
3. If inputs are external files, use `mcp__comfy_local__upload_file` or the appropriate staging path.
4. `mcp__comfy_local__run_workflow`; prefer waiting only for short jobs.
5. For async jobs, use `mcp__comfy_local__job` until success/failure.
6. `mcp__comfy_local__fetch_outputs` into an explicit output directory.

## Start from a template

1. `mcp__comfy_local__search_templates`
2. `mcp__comfy_local__get_template` to inspect compatibility and parameters
3. `mcp__comfy_local__fetch_template` when a local runnable JSON is useful
4. `mcp__comfy_local__list_workflow_slots`, then `mcp__comfy_local__set_workflow_slot`/`mcp__comfy_local__vary_workflow` for controlled changes
5. `mcp__comfy_local__validate_workflow`
6. `mcp__comfy_local__run_template` or `mcp__comfy_local__run_workflow`
7. `mcp__comfy_local__fetch_outputs`

Prefer templates over inventing a graph when a close match exists.

## Prompt-to-image shortcut

Use `mcp__comfy_local__generate_image` only after `mcp__comfy_local__server_info` confirms the local server and the request can be satisfied by the configured local text-to-image path. If it selects hosted partner execution or requires credits, stop and obtain explicit consent.

## Nodes and models

- Use `mcp__comfy_local__nodes` for live node definitions and custom-node awareness.
- Use `mcp__comfy_local__node_dependencies` or `mcp__comfy_local__workflow_deps` before proposing installation.
- Use `mcp__comfy_local__search_models` for local files.
- `mcp__comfy_local__install_node`, `mcp__comfy_local__download_model`, `download`, and `mcp__comfy_local__update_comfyui` are mutations: preview and require an explicit request.

## Lifecycle and recovery

- `mcp__comfy_local__launch_comfyui`: use only when no local server is running and execution was requested.
- `mcp__comfy_local__get_logs`: preferred first diagnostic for failed startup or workflow execution.
- `mcp__comfy_local__free_memory`: safe only when no job is running; explain that models/cache will be unloaded.
- `mcp__comfy_local__stop_comfyui`, `mcp__comfy_local__restart_comfyui`, version switching, and updates require explicit authorization.

## Hosted boundaries

`mcp__comfy_local__partner_generate` and locally executed workflows containing partner-API nodes can send data off-machine and spend credits. Disclose the provider/boundary and ask before the call. Local MCP is not the same as Comfy Cloud MCP.
