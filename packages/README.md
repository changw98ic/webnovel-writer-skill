# Webnovel Writer npm packages

`packages/` 目录对应本仓库的 pnpm workspace 包；它和 `webnovel-writer/` 下的 Claude Plugin / Python 运行时是两套入口。

## 包结构

- `@changw98ic/core`：核心类型、Skill Schema、共享模型
- `@changw98ic/data`：状态管理、实体索引、RAG 检索
- `@changw98ic/adapters`：adapter 输出 + codex/opencode/openclaw bundle 生成
- `@changw98ic/dashboard`：Dashboard 后端
- `@changw98ic/cli`：`webnovel` 命令行入口

## 安装

```bash
npm install -g @changw98ic/cli

# 或按需安装库
npm install @changw98ic/core @changw98ic/data @changw98ic/adapters @changw98ic/dashboard
```

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
# 完整 Skill bundle
webnovel adapt --platform codex --output ./target
webnovel adapt --platform opencode --output ./target
webnovel adapt --platform openclaw --output ./target

# 旧式 adapter 输出
webnovel adapt --platform claude-code --output ./target
webnovel adapt --platform cursor --output ./target
webnovel adapt --platform openai --output ./target
```

说明：

- `codex / opencode / openclaw`：直接复制 `webnovel-writer/` 下的完整技能资产
- `openclaw` 还会额外生成 `openclaw-plugin/` 原生插件包
- `claude-code / cursor / openai`：仍使用 CLI 内置 `builtinSkills`

## RAG 配置

```bash
export EMBED_BASE_URL=https://api-inference.modelscope.cn/v1
export EMBED_MODEL=Qwen/Qwen3-Embedding-8B
export EMBED_API_KEY=your_embed_api_key

export RERANK_BASE_URL=https://api.jina.ai/v1
export RERANK_MODEL=jina-reranker-v3
export RERANK_API_KEY=your_rerank_api_key
```

- `@changw98ic/data` 的 `RAGAdapter` 默认从 `process.env` 读取变量
- npm 包侧当前未内置项目级 `.env` 自动加载
- 插件版配置见根 `README.md` 与 `docs/rag-and-config.md`

## 开发

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm cli --help
```

## 文档入口

- 根 `README.md`：仓库总览
- `packages/cli/README.md`：CLI 用法
- `packages/adapters/README.md`：平台适配与 bundle 生成
- `docs/rag-and-config.md`：RAG 与配置

## License

GPL-3.0-or-later
