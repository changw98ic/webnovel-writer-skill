# Webnovel Writer npm packages

`packages/` 目录对应本仓库的 pnpm workspace 包；它和根 `README.md` 里的 Claude Plugin / Python 使用说明是两套入口：

- `packages/*`：Node.js / TypeScript npm 包
- `webnovel-writer/`：插件运行时资源、Skill、Agent、模板与脚本

## 安装

```bash
# CLI 入口
npm install -g @changw98ic/cli

# 按需安装库
npm install @changw98ic/core @changw98ic/data @changw98ic/adapters @changw98ic/dashboard
```

## 包结构

- `@changw98ic/core`：核心类型、Skill 结构、共享模型
- `@changw98ic/data`：状态管理、实体索引、RAG 检索
- `@changw98ic/adapters`：Claude Code / OpenAI / Cursor / OpenClaw 适配输出
- `@changw98ic/dashboard`：Fastify Dashboard 后端
- `@changw98ic/cli`：`webnovel` 命令行入口

## CLI 快速开始

```bash
webnovel --help

webnovel init "我的小说"
webnovel plan 1 --detailed
webnovel write 1 --fast
webnovel review 1-5 --detailed
webnovel query 主角 --type entity
```

## 平台适配

```bash
webnovel adapt --platform claude-code --output ./skills
webnovel adapt --platform cursor --output ./
webnovel adapt --platform openai --output ./functions
```

> 当前 `webnovel adapt` 使用 CLI 内置 `builtinSkills` 生成文件，不会直接读取 `webnovel-writer/skills/*` Markdown Skill 文件。

## RAG 配置

```bash
export EMBED_BASE_URL=https://api-inference.modelscope.cn/v1
export EMBED_MODEL=Qwen/Qwen3-Embedding-8B
export EMBED_API_KEY=your_embed_api_key

export RERANK_BASE_URL=https://api.jina.ai/v1
export RERANK_MODEL=jina-reranker-v3
export RERANK_API_KEY=your_rerank_api_key
```

- `@changw98ic/data` 的 `RAGAdapter` 默认从 `process.env` 读取这些变量
- 当前 TypeScript 包侧未内置项目级 `.env` 自动加载逻辑；如果独立使用 npm 包，请自行导出环境变量或手动加载 `.env`
- 插件版 `.env` 约定见根 `README.md` 与 `docs/rag-and-config.md`

## 开发

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm cli --help
```

## 文档入口

- 根 README：插件安装、Python 入口、整体介绍
- `docs/commands.md`：命令详解
- `docs/rag-and-config.md`：RAG 与配置
- `packages/*/README.md`：各 npm 包单独说明

## License

GPL-3.0-or-later
