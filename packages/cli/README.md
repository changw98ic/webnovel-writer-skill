# @changw98ic/cli

`webnovel` 命令行入口，用于初始化项目、执行写作链、生成适配文件，以及管理状态 / 索引 / RAG / 备份。

## 安装

```bash
npm install -g @changw98ic/cli

# 或临时执行
npx @changw98ic/cli --help
```

## 快速开始

```bash
webnovel --help

webnovel init "我的小说" --genre 玄幻 --chapters 100
webnovel plan 1 --detailed
webnovel write 1 --fast
webnovel review 1-5 --detailed
webnovel query 主角 --type entity
```

## 命令概览

### 创作链

- `init <title>`：初始化新项目
- `plan <chapter>`：规划章节大纲
- `write <chapter>`：写作章节
- `review <range>`：审查章节质量
- `query <keyword>`：查询项目状态
- `adapt`：生成平台适配文件
- `dashboard`：启动可视化面板
- `resume`：恢复中断任务（当前仍是占位实现）

### 项目定位与预检

- `where`：打印解析后的 `project_root`
- `use <project-root>`：为工作区 / 全局注册当前书项目
- `preflight`：检查 CLI 目录、插件根目录、Skill 目录和 `project_root`

### 报告、归档与数据管理

- `status`
- `backup create|list|rollback|diff`
- `archive auto|stats|restore`
- `index stats|process-chapter`
- `state stats|process-chapter`
- `rag stats|index-chapter|search`
- `style sample|analyze`
- `entity search|link|stats|get`
- `context build|stats|extract`
- `migrate state-to-sqlite`
- `workflow health-check|validate`
- `update-state`
- `extract-context`

> 建议直接执行 `webnovel <命令> --help` 查看各命令的实时参数面。

## `adapt` 如何使用 Skill

```bash
webnovel adapt --platform claude-code --output ./out
```

- `--platform` 可选：`claude-code`、`cursor`、`openai`、`openclaw`
- 当前 `adapt` 命令直接使用 `packages/cli/src/commands/adapt.ts` 中的内置 `builtinSkills`
- 它不会直接读取仓库里的 `webnovel-writer/skills/*` Markdown Skill 文件

## RAG 配置

```bash
export EMBED_BASE_URL=https://api-inference.modelscope.cn/v1
export EMBED_MODEL=Qwen/Qwen3-Embedding-8B
export EMBED_API_KEY=your_embed_api_key

export RERANK_BASE_URL=https://api.jina.ai/v1
export RERANK_MODEL=jina-reranker-v3
export RERANK_API_KEY=your_rerank_api_key

webnovel rag stats
webnovel rag search "主角身份" --top-k 5
```

- TypeScript 版 `RAGAdapter` 默认读取 `process.env` 中的 `EMBED_*` / `RERANK_*`
- 当前 npm CLI 包内未内置项目级 `.env` 自动加载逻辑；独立使用时，请先在 shell 导出环境变量，或由宿主进程自行加载 `.env`
- 仓库内插件版 `.env` 约定见根 `README.md` 与 `docs/rag-and-config.md`

## 文档

- 项目主页：<https://github.com/changw98ic/webnovel-writer-skill#readme>
- RAG 与配置：`docs/rag-and-config.md`
- 工作区包总览：`packages/README.md`

## License

GPL-3.0-or-later
