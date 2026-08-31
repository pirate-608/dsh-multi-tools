# pirate-608 DSH Multi Tools

[English](README.md) | 简体中文

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的精选多模态工具套件。它将视觉理解、本地图片生成、游戏引擎、创意软件与 CAD 自动化组合起来，同时把每个领域能力限制在独立的 Agent Preset 中。

## 多模态工作流

- `dsh-modlens` 通过本地 Codex、OpenAI-compatible 端点或本地 Ollama，把图片文件转换为可记录、可重建的结构化视觉证据，供纯文本模型使用。
- `dsh-comfy-local-tools` 通过 Comfy 官方 MCP 与 CLI 工具检查并运行本地 ComfyUI 工作流。
- Unity、Adobe、CAD 与 Ren'Py 集成输出结构化状态和文件式截图、预览、渲染或导出；需要视觉理解时再把这些文件交给 ModLens。
- 原生多模态 adapter 继续负责自己的图片输入；回退逻辑不会根据模型名称猜测能力。

仓库刻意不提供“全部安装”包。只向 DSH profile 安装实际需要的领域包；每个包从当前 DSH `standard` 派生受管 Preset，标准会话不会得到这些工具。

## 包

| 包 | 用途 |
| --- | --- |
| `@pirate-608/dsh-plugin-kit` | 共享的受管 Preset 生命周期与默认关闭的 MCP 审批策略 |
| `@pirate-608/dsh-modlens` | 通过本地 Codex、OpenAI-compatible 与本地 Ollama 提供文本优先的视觉证据 |
| `@pirate-608/dsh-comfy-local-tools` | 本地 ComfyUI 发现、工作流验证、生成、任务监控与输出收集 |
| `@pirate-608/dsh-unity-mcp` | 通过 MCP for Unity 10.1.2 操作 Unity Editor，并使用文件式视觉证据 |
| `@pirate-608/dsh-after-effects` | After Effects 自动化 |
| `@pirate-608/dsh-photoshop` | Photoshop Windows COM 自动化 |
| `@pirate-608/dsh-premiere` | Premiere Pro CEP 自动化 |
| `@pirate-608/dsh-autocad-mcp` | AutoCAD 与无界面 DXF 自动化 |
| `@pirate-608/dsh-solidworks-automation` | SolidWorks COM 与 MCP 工作流 |
| `@pirate-608/dsh-renpy-visual-novel-dev` | Ren'Py 开发、预览与验证 |

共享的 `@pirate-608/dsh-plugin-kit` 统一生命周期和未知工具审批行为。作者代码许可证尚未明确的包保持 private，不能发布。外部运行时只能通过显式命令安装；npm 安装不包含自动安装软件的 `postinstall`。

## 开发

需要 Node.js 22.19+ 或 24+、pnpm 10。

```sh
pnpm install
pnpm run check
```

测试和构建命令不会发布包、安装 DSH Preset，或连接本机创意软件。
