# Webnovel Writer

[![License](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-43853d.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178c6.svg)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776ab.svg)](https://www.python.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9-f69220.svg)](https://pnpm.io/)
[![npm scope](https://img.shields.io/badge/npm-%40changw98ic%2F*-cb3837.svg)](https://www.npmjs.com/search?q=%40changw98ic)

`Webnovel Writer` 现在是一个同时包含 **Claude Plugin 运行时**、**npm CLI / TypeScript 包**、以及 **Codex / OpenCode / OpenClaw 直接可用 Skill bundle** 的 monorepo。

当前仓库有两条主入口：

- `webnovel-writer/`：原始运行时资产，包含 Skills、Agents、参考资料、模板、Python 数据链与 Dashboard
- `packages/*`：npm 包、CLI、适配器与 Dashboard 后端

## 当前支持什么

### 1) Claude Plugin / Python 运行时

- 插件元数据：`.claude-plugin/marketplace.json`
- 插件包元数据：`webnovel-writer/.claude-plugin/plugin.json`
- Skills / Agents / 参考资料 / 模板 / 脚本：`webnovel-writer/`

### 2) npm 包与 CLI

- `@changw98ic/core`：核心类型、Schema、共享模型
- `@changw98ic/data`：状态管理、实体索引、RAG 检索
- `@changw98ic/adapters`：平台适配器与 bundle 生成
- `@changw98ic/dashboard`：Dashboard 后端
- `@changw98ic/cli`：`webnovel` 命令行入口

### 3) 当前平台适配矩阵

- `claude-code`：生成 Markdown `SKILL.md`
- `cursor`：生成 `.cursorrules`
- `openai`：生成 `functions.json` 与 prompt 模板
- `codex`：生成 `.codex/skills/*`、`.codex/agents/*` 等直接可用 bundle
- `opencode`：生成 `.opencode/skills/*`、`.opencode/agents/*` 等直接可用 bundle
- `openclaw`：生成工作区级 bundle，并额外生成 `openclaw-plugin/` 原生插件包

> `codex / opencode / openclaw` 现在走的是 **完整运行时资产 bundle**，来源不是 CLI 里的简化 `builtinSkills`，而是 `webnovel-writer/` 下的真实 Skill / Agent / 脚本目录。

## 快速开始

### 方案 A：通过 Claude Plugin 使用

```bash
claude plugin marketplace add changw98ic/webnovel-writer-skill --scope user
claude plugin install webnovel-writer@webnovel-writer-marketplace --scope user
```

安装 Python 依赖：

```bash
python -m pip install -r https://raw.githubusercontent.com/changw98ic/webnovel-writer-skill/HEAD/requirements.txt
```

然后在 Claude Code 中执行：

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

### 方案 C：生成直接可用 bundle / 适配文件

```bash
# 完整 bundle
webnovel adapt --platform codex --output ./target
webnovel adapt --platform opencode --output ./target
webnovel adapt --platform openclaw --output ./target

# 旧式 adapter 输出
webnovel adapt --platform claude-code --output ./target
webnovel adapt --platform cursor --output ./target
webnovel adapt --platform openai --output ./target
```

生成结果的关键结构：

```text
codex    -> target/.codex/{skills,agents,references,scripts,templates,dashboard,genres}
opencode -> target/.opencode/{skills,agents,references,scripts,templates,dashboard,genres}
openclaw -> target/{skills,agents,references,scripts,templates,dashboard,genres}
          + target/openclaw-plugin/{openclaw.plugin.json,package.json,index.ts,...}
```

每个 bundle 都会额外生成：

- `webnovel-bootstrap-env.sh`：把 `CLAUDE_PLUGIN_ROOT` 绑定到当前 bundle 根目录
- `WEBNOVEL_BUNDLE.md`：bundle 用法说明
- `openclaw-plugin/`：OpenClaw native plugin 包（仅 `--platform openclaw` 生成）

使用 bundle 前先执行：

```bash
# codex
source "$PWD/.codex/webnovel-bootstrap-env.sh"

# opencode
source "$PWD/.opencode/webnovel-bootstrap-env.sh"

# openclaw
source "$PWD/webnovel-bootstrap-env.sh"
```

## CLI `adapt` 现在怎么用 Skill

### `codex / opencode / openclaw`

这 3 个平台现在直接复制并输出 `webnovel-writer/` 下的真实资产：

- `skills/`
- `agents/`
- `references/`
- `scripts/`
- `templates/`
- `dashboard/`
- `genres/`

并在每个 `SKILL.md` 顶部注入平台引导；OpenClaw Skill 会使用官方 `{baseDir}` 占位符定位 `webnovel-bootstrap-env.sh`。

### `claude-code / cursor / openai`

这 3 个平台仍然沿用 `packages/cli/src/commands/adapt.ts` 里的简化 `builtinSkills`：

- `claude-code`：适合导出示例 `SKILL.md`
- `cursor`：适合生成 `.cursorrules`
- `openai`：适合导出 function calling 结构

### OpenClaw native plugin 安装

```bash
webnovel adapt --platform openclaw --output ./target
cd ./target
openclaw plugins install ./openclaw-plugin
openclaw plugins enable webnovel-writer-skill
# 然后重启 gateway
```

## RAG 配置

最小环境变量示例：

```bash
export EMBED_BASE_URL=https://api-inference.modelscope.cn/v1
export EMBED_MODEL=Qwen/Qwen3-Embedding-8B
export EMBED_API_KEY=your_embed_api_key

export RERANK_BASE_URL=https://api.jina.ai/v1
export RERANK_MODEL=jina-reranker-v3
export RERANK_API_KEY=your_rerank_api_key
```

补充说明：

- `@changw98ic/data` 的 `RAGAdapter` 默认读取 `process.env`
- npm 包侧当前未内置项目级 `.env` 自动加载
- 插件版 `.env` / Python 数据链约定见 `docs/rag-and-config.md`

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
│   ├── references/
│   ├── templates/
│   ├── scripts/
│   ├── dashboard/
│   └── genres/
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

- `packages/README.md`：npm 包总览
- `packages/cli/README.md`：CLI 用法
- `packages/adapters/README.md`：适配器与 bundle 生成
- `docs/commands.md`：命令说明
- `docs/rag-and-config.md`：RAG 与配置

## 开源协议

本项目使用 `GPL-3.0-or-later`，详见 `LICENSE`。

## 致谢

本项目基于 [lingfengQAQ/webnovel-writer](https://github.com/lingfengQAQ/webnovel-writer) 演进而来；当前仓库在其基础上补充了 npm 发布、CLI、Dashboard 与多平台 bundle / adapter 生成链路。
