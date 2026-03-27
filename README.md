# Webnovel Writer

[![License](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Compatible-purple.svg)](https://claude.ai/claude-code)

<a href="https://trendshift.io/repositories/22487" target="_blank"><img src="https://trendshift.io/api/badge/repositories/22487" alt="changw98ic%2Fwebnovel-writer-skill | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

`Webnovel Writer` 现在是一个同时包含 **Claude Plugin 运行时** 与 **Node.js / TypeScript 工具链** 的 monorepo。

当前仓库有两条明确入口：

- `webnovel-writer/`：Claude Plugin 运行时资源、Skills、Agents、模板、Python 数据链
- `packages/*`：npm 包、CLI、适配器、Dashboard 后端

## 仓库现在包含什么

### 1) Claude Plugin / Python 写作链

- 插件元数据：`.claude-plugin/marketplace.json`
- 插件包元数据：`webnovel-writer/.claude-plugin/plugin.json`
- Skills / Agents / 模板 / 参考资料：`webnovel-writer/`
- Python 数据模块与 RAG 链路：`webnovel-writer/scripts/data_modules/`

### 2) npm 包与 CLI

- `@changw98ic/core`：核心类型、Schema、共享模型
- `@changw98ic/data`：状态管理、实体索引、RAG 检索
- `@changw98ic/adapters`：Claude Code / Cursor / OpenAI / OpenClaw 适配输出
- `@changw98ic/dashboard`：Fastify Dashboard 后端
- `@changw98ic/cli`：`webnovel` 命令行入口

### 3) 当前已落地的平台适配

- Claude Code
- Cursor
- OpenAI
- OpenClaw

> 这些适配入口来自 `packages/cli/src/index.ts` 的 `adapt` 命令和 `packages/adapters/src/index.ts` 的平台分发逻辑。

## 快速开始

### 方案 A：通过 Claude Plugin 使用

```bash
claude plugin marketplace add changw98ic/webnovel-writer-skill --scope user
claude plugin install webnovel-writer@webnovel-writer-marketplace --scope user
```

> 仅当前项目生效时，将 `--scope user` 改为 `--scope project`。

安装 Python 依赖：

```bash
python -m pip install -r https://raw.githubusercontent.com/changw98ic/webnovel-writer-skill/HEAD/requirements.txt
```

初始化项目后，在 Claude Code 中执行：

```bash
/webnovel-init
/webnovel-plan 1
/webnovel-write 1
/webnovel-review 1-5
```

### 方案 B：通过 npm CLI 使用

```bash
npm install -g @changw98ic/cli

webnovel --help
webnovel init "我的小说"
webnovel plan 1 --detailed
webnovel write 1 --fast
webnovel review 1-5 --detailed
webnovel query 主角 --type entity
```

### 方案 C：按平台生成适配文件

```bash
webnovel adapt --platform claude-code --output ./skills
webnovel adapt --platform cursor --output ./
webnovel adapt --platform openai --output ./functions
webnovel adapt --platform openclaw --output ./skills
```

说明：

- `cursor` 会生成 `.cursorrules`
- `openai` 会输出 `functions.json` 与 prompt 文件
- `adapt` 当前使用 CLI 内置 `builtinSkills`，不是直接读取 `webnovel-writer/skills/*`

## Cursor / Codex / OpenCode

### Cursor

Cursor 在当前仓库里有**明确的适配实现**：

- CLI 入口：`packages/cli/src/index.ts`
- 平台适配器：`packages/adapters/src/index.ts`
- Cursor 生成器：`packages/adapters/src/cursor/generator.ts`

推荐用法：

```bash
webnovel adapt --platform cursor --output ./
```

### Codex / OpenCode

当前仓库里**没有找到专门命名为 `codex` 或 `opencode` 的 adapter target、模板目录或生成器文件**。

如果你要在 Codex / OpenCode 这类代理终端中使用本仓库，当前更合适的入口是：

- 直接安装并运行 `@changw98ic/cli`
- 直接调用 `packages/*` 提供的 npm 包
- 参考 `Cursor / OpenAI / Claude Code` 已有适配产物组织自己的终端工作流

> 也就是说：**Cursor 适配是当前源码里明确存在的；Codex / OpenCode 目前更像“使用场景”，不是仓库里已有的专用适配目标。**

## RAG 配置

最小环境变量示例：

```bash
EMBED_BASE_URL=https://api-inference.modelscope.cn/v1
EMBED_MODEL=Qwen/Qwen3-Embedding-8B
EMBED_API_KEY=your_embed_api_key

RERANK_BASE_URL=https://api.jina.ai/v1
RERANK_MODEL=jina-reranker-v3
RERANK_API_KEY=your_rerank_api_key
```

补充说明：

- npm 包侧的 `RAGAdapter` 默认读取 `process.env`
- TypeScript 包当前未内置项目级 `.env` 自动加载
- 插件版 `.env` 与 Python 数据链约定见 `docs/rag-and-config.md`

## 目录结构

```text
.
├── packages/
│   ├── core/
│   ├── data/
│   ├── adapters/
│   ├── cli/
│   └── dashboard/
├── webnovel-writer/
│   ├── skills/
│   ├── agents/
│   ├── templates/
│   ├── references/
│   └── scripts/
├── docs/
└── .claude-plugin/
```

## 开发命令

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm cli --help
```

## 文档入口

- `docs/README.md`：文档导航
- `docs/architecture.md`：整体结构
- `docs/commands.md`：命令详解
- `docs/rag-and-config.md`：RAG 与配置
- `packages/README.md`：npm 包总览
- `packages/*/README.md`：各包单独说明

## 开源协议

本项目使用 `GPL-3.0-or-later`，详见 `LICENSE`。

## 致谢

本项目基于 [lingfengQAQ/webnovel-writer-skill](https://github.com/lingfengQAQ/webnovel-writer-skill) 演进而来，当前仓库已补充 npm 包发布、CLI、Dashboard 与多平台适配链路。
