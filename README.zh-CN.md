# DSH Multi Tools

[English](README.md) | 简体中文

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 0.1.2-alpha.3 及以上版本的私有多模态插件集。一次安装即可加入 ModLens 视觉核心、Multi Tools 设置页、统一依赖状态，以及面向创意软件、游戏引擎与 CAD 的独立 Agent Preset。

## 安装

安装聚合包前，先从目标 profile 移除 `@liustack/modlens` 或 `@pirate-608/dsh-modlens`。这两个独立包都会注册 `modlens_read_image`，因此聚合包会拒绝与任意一个同时启动。

```powershell
dsh plugin --profile web add github:pirate-608/dsh-multi-tools
```

Git 依赖会在 pnpm 安装阶段构建 Host 与浏览器 bundle。第一次 `add` 可能以 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` 停止；这是 pnpm 在请求允许仓库的 `prepare` 脚本于 agent 沙箱外执行。请把错误中打印的精确包键复制到 `C:\Users\<user>\.dsh\profiles\web\pnpm-workspace.yaml`，用引号包住键，再重复原命令：

```yaml
allowBuilds:
  '<pnpm 打印的精确包键>': true
```

只应授权已经审查的 commit。测试评审版本时，请安装固定引用，例如 `github:pirate-608/dsh-multi-tools#<完整-commit-sha>`，并放行该 commit 对应错误中打印的 archive 键。本包没有 `postinstall`，不会自动安装 MCP、下载模型或启动桌面应用。

重启 Web profile 后打开 **设置 → 插件 → Multi Tools**。ModLens 始终存在但默认没有视觉路线；其余集成默认关闭，启用后只为新会话创建对应的独立受管 Preset。

## 多模态工作流

- `modlens` 通过本地 Codex、OpenAI-compatible 端点或本地 Ollama，把图片文件转换为可记录、可重建的结构化视觉证据，供纯文本模型使用。
- `comfy-local` 通过 Comfy 官方 MCP 与 CLI 工具检查并运行本地 ComfyUI 工作流。
- Unity、Adobe、CAD 与 Ren'Py 集成输出结构化状态和文件式截图、预览、渲染或导出；需要视觉理解时再把这些文件交给 ModLens。
- 原生多模态 adapter 继续负责自己的图片输入；回退逻辑不会根据模型名称猜测能力。

页面打开时只执行被动 installed 检查。只有用户主动点击实时检查，才会连接 loopback 服务或运行短生命周期本地 MCP 探针；整个过程不会安装、下载、启动应用或调用云端视觉推理。

## CLI

```text
dsh-multi-tools status [--live] [--json] [--integration <id>]
dsh-multi-tools doctor
dsh-multi-tools integrations set [<id>...] [--json]
dsh-multi-tools runtime <id> install|remove
```

外部运行时操作只通过显式 CLI 执行。没有安全卸载实现的集成会明确返回不支持，不推算要删除的用户文件。

ModLens 路线保存在 DSH settings 文档的 `dsh-multi-tools` 段；安装本身不会隐式选择路线：

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

复用 Codex 还必须显式设置 `consent: true`；OpenAI-compatible 密钥继续使用 DSH credential reference，不能作为明文写入 settings。

## 内置集成

| 包 | 用途 |
| --- | --- |
| `modlens` | 始终启用的文本优先视觉证据；路线必须显式选择 Codex、OpenAI-compatible 或 Ollama |
| `comfy-local` | 本地 ComfyUI 发现、工作流验证、生成、任务监控与输出收集 |
| `unity` | 通过 MCP for Unity 10.1.2 操作 Unity Editor，并使用文件式视觉证据 |
| `after-effects` | After Effects 自动化 |
| `photoshop` | Photoshop Windows COM 自动化 |
| `premiere` | Premiere Pro CEP 自动化 |
| `autocad` | AutoCAD 与无界面 DXF 自动化 |
| `solidworks` | SolidWorks COM 与 MCP 工作流 |
| `renpy` | Ren'Py 开发、预览与验证 |

聚合构建只复制显式 allowlist 中的集成文件，并记录 SHA-256 清单；虚拟环境、缓存、测试、Codex manifests 和 workspace 依赖不会进入产物。After Effects、Photoshop、Premiere、AutoCAD 的第一方再分发状态尚未解决，因此仅用于个人构建；根包保持 private，不得发布到 npm。

## 开发

需要 Node.js 22.19+ 或 24+、pnpm 10。

```sh
pnpm install
pnpm run check
```

构建和测试不会发布包、安装外部运行时、下载模型或连接本机创意软件。
