<!-- dsh-package-header -->
# @pirate-608/dsh-comfy-local-tools

Local-first ComfyUI generation and workflow automation through first-party MCP and CLI tools。

先安装到 DSH profile，再创建独立 Preset：

```powershell
dsh plugin --profile web add @pirate-608/dsh-comfy-local-tools
dsh plugin --profile web exec dsh-comfy-local-tools preset install
dsh plugin --profile web exec dsh-comfy-local-tools doctor
```

受管 Preset：`comfy-local`。标准 Preset 不会得到本包的工具或技能；MCP 写操作和未知工具必须经过一次性审批。
<!-- /dsh-package-header -->

# Comfy Local Tools

这是一个面向 Windows DSH 的本地优先 ComfyUI 插件，通过 Comfy 官方的 `comfy-mcp` 与 `comfy-cli` 控制 ComfyUI 或 Comfy Desktop。

## 功能

- 检查当前运行的 ComfyUI、节点、模型、模板、日志和系统信息。
- 校验并执行工作流 JSON 或兼容模板。
- 监控生成任务，并将输出复制到用户明确指定的目录。
- 诊断 MCP/CLI 安装与 Comfy Desktop 工作区差异。

安装节点或模型、更新或重启 ComfyUI、切换版本，以及可能上传数据或消费额度的合作方服务，都会先要求用户明确授权。

## 安装要求

- Windows DSH。
- ComfyUI 或 Comfy Desktop。
- 已安装 [`uv`](https://docs.astral.sh/uv/)，并执行：

```powershell
dsh plugin --profile web exec dsh-comfy-local-tools runtime install
```

该运行时命令只会安装缺失的 `comfy-cli` 与 `comfy-mcp` uv 工具，不会安装 ComfyUI、下载模型、启动服务、更新已有工具或配置凭据。

插件优先解析 `%USERPROFILE%\.local\bin\comfy.exe` 和 uv 工具环境，也支持通过 `COMFY_BIN`、`COMFY_MCP_BIN` 指定其他安装。

## 诊断

```powershell
powershell -NoProfile -File .\scripts\diagnose-comfy-local.ps1
powershell -NoProfile -File .\scripts\probe-comfy-mcp.ps1
```

执行工作流前请先启动 Comfy Desktop 或本地 ComfyUI。插件以 `127.0.0.1:8188` 上实际运行的实例为准，不会静默修改 comfy-cli 保存的默认工作区。

## 隐私边界

普通查询与生成均在配置的本机 ComfyUI 中完成。合作方 API 节点与 `partner_generate` 可能把输入发送到托管服务或消费额度，因此 Skill 会在调用前要求明确同意。插件不会捆绑或保存 `COMFY_API_KEY`。

## 上游

- [本地 Comfy MCP 文档](https://docs.comfy.org/agent-tools/mcp)
- [Comfy MCP 仓库](https://github.com/Comfy-Org/comfy-mcp)
- [Comfy CLI 文档](https://docs.comfy.org/agent-tools/cli)

仓库不包含上游二进制、模型或源码副本；本插件的包装脚本与 Skill 使用 MIT 许可证。
