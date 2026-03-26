# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Webnovel Writer is a Claude Code plugin for long-form Chinese web novel creation. It aims to reduce AI "hallucination" and "forgetting" issues during extended serial writing by maintaining strict context contracts and state management.

## Common Commands
```bash
# Initialize a new novel project
/webnovel-init

# Plan chapters for a volume
/webnovel-plan 1
/webnovel-plan 2-3

# Write a chapter
/webnovel-write 1
/webnovel-write 45

# Review chapters
/webnovel-review 1-5
/webnovel-review 45

# Query project state
/webnovel-query <keyword>
/webnovel-query 萧炎
/webnovel-query 伏笔

# Resume interrupted work
/webnovel-resume

# Start visualization dashboard
/webnovel-dashboard

# Learn from current session
/webnovel-learn "description"
```

## Node CLI (推荐)

Node.js CLI 是主要命令行工具，提供更快的执行速度和更好的跨平台兼容性。

```bash
# 安装依赖
pnpm install

# 构建 CLI
pnpm --filter @webnovel-skill/cli build

# 运行命令
node packages/cli/dist/index.js --help

# 或者使用 pnpm
pnpm --filter @webnovel-skill/cli start -- --help
```

### 可用命令

| 命令 | 说明 |
|------|------|
| `init <title>` | 初始化新小说项目 |
| `plan <chapter>` | 规划章节大纲 |
| `write <chapter>` | 写作章节 |
| `review <range>` | 审查章节质量 |
| `query <keyword>` | 查询项目状态 |
| `where` | 打印解析出的 project_root |
| `preflight` | 校验运行环境 |
| `use <project-root>` | 绑定当前工作区使用的书项目 |
| `resume` | 恢复中断的任务 |
| `dashboard` | 启动可视化面板 |

### 示例

```bash
# 初始化项目
node packages/cli/dist/index.js init "我的小说" --genre xuanhuan --target-words 2000000

# 规划第1章
node packages/cli/dist/index.js -p /path/to/novel plan 1

# 写作第1章
node packages/cli/dist/index.js -p /path/to/novel write 1

# 审查第1-5章
node packages/cli/dist/index.js -p /path/to/novel review 1-5

# 查询角色信息
node packages/cli/dist/index.js -p /path/to/novel query 萧炎

# 环境检查
node packages/cli/dist/index.js preflight

# 显示当前项目路径
node packages/cli/dist/index.js where
```

## Python CLI (兼容)

Python CLI 仍然可用，用于向后兼容和调试。

```bash
# Set environment variables first
export WORKSPACE_ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
export SCRIPTS_DIR="${CLAUDE_PLUGIN_ROOT}/scripts"

# Preflight check
python "${SCRIPTS_DIR}/webnovel.py" preflight

# Show current project root
python "${SCRIPTS_DIR}/webnovel.py" where

# Index operations
python "${SCRIPTS_DIR}/webnovel.py" --project-root "${PROJECT_ROOT}" index stats
python "${SCRIPTS_DIR}/webnovel.py" --project-root "${PROJECT_ROOT}" index process-chapter --chapter 1

# State operations
python "${SCRIPTS_DIR}/webnovel.py" --project-root "${PROJECT_ROOT}" state process-chapter --chapter 1 --data @payload.json

python "${SCRIPTS_DIR}/webnovel.py" --project-root "${PROJECT_ROOT}" status -- --focus all

# RAG operations
python "${SCRIPTS_DIR}/webnovel.py" --project-root "${PROJECT_ROOT}" rag stats
python "${SCRIPTS_DIR}/webnovel.py" --project-root "${PROJECT_ROOT}" rag index-chapter --chapter 1

# Extract chapter context
python "${SCRIPTS_DIR}/webnovel.py" --project-root "${PROJECT_ROOT}" extract-context --chapter 1 --format json

# Run tests (PowerShell)
pwsh "${CLAUDE_PLUGIN_ROOT}/scripts/run_tests.ps1" -Mode smoke
pwsh "${CLAUDE_PLUGIN_ROOT}/scripts/run_tests.ps1" -Mode full
```

## Architecture
```
Claude Code
├── Skills (7): init / plan / write / review / query / resume / dashboard / learn
├── Agents (8): Context / Data / 6 Checkers (high-point / consistency / pacing / OOC / continuity / reader-pull)
├── Data Layer
│   ├── .webnovel/state.json (project state)
│   ├── .webnovel/index.db (SQLite: entity index)
│   └── .webnovel/vectors.db (vector embeddings)
├── CLI (Node.js)
│   ├── packages/cli/src/commands/ - CLI commands
│   └── packages/cli/src/utils/ - Utility modules
└── Dashboard (FastAPI + frontend)
```

## Node CLI Modules

### P1: Core Utilities (已完成)
- `api-client.ts` - Embedding/Rerank API 客户端
- `security.ts` - 安全工具（路径消毒、原子写入）
- `style-sampler.ts` - 风格采样器
- `entity-linker.ts` - 实体链接/消歧

### P2: Workflow Utilities (已完成)
- `workflow-manager.ts` - 工作流状态管理
- `backup-manager.ts` - Git 备份管理
- `chapter-context.ts` - 章节上下文提取
- `status-reporter.ts` - 健康报告生成
- `archive-manager.ts` - 数据归档管理

### P3: Observability (已完成)
- `observability.ts` - 工具调用日志、性能计时

## Key Concepts
- **Anti-hallucination principles**: "Outline is law" (follow outline), "Settings are physics" (respect settings), "Inventions need identified" (new entities must be registered)
- **Strand Weave rhythm**: Quest (60%) / Fire (20%) / Constellation (20%) - controls pacing and content balance
- **Dual Agent architecture**: Context Agent builds context before writing; Data Agent extracts entities after writing
- **Six-dimensional review**: parallel checks for cool-points, consistency, pacing, OOC, continuity, reader-pull

## Project Structure
```
workspace-root/
├── .claude/
│   └── .webnovel-current-project   # Points to active novel project
├── NovelName/                      # Novel project root (PROJECT_ROOT)
│   ├── .webnovel/               # Runtime data (state.json, index.db, vectors.db)
│   ├── 正文/                   # Published chapters
│   ├── 大纲/                   # Outlines (总纲.md, vol1.md, etc.)
│   └── 设定集/                # Settings (世界观, 角色, 力量体系, etc.)
```

## RAG Configuration
Requires `.env` file in project root with:
```bash
EMBED_BASE_URL=https://api-inference.modelscope.cn/v1
EMBED_MODEL=Qwen/Qwen3-Embedding-8B
EMBED_API_KEY=your_key

RERANK_BASE_URL=https://api.jina.ai/v1
RERANK_MODEL=jina-reranker-v3
RERANK_API_KEY=your_key
```
Without embedding config, semantic search falls back to BM25.

## Python Dependencies
```bash
python -m pip install -r https://raw.githubusercontent.com/lingfengQAQ/webnovel-writer/HEAD/requirements.txt
```
Requires: Python 3.10+, aiohttp, filelock, pydantic

## Node.js Dependencies
```bash
pnpm install
```
Requires: Node.js 18+, pnpm 8+

## Plugin Release
```bash
# Sync version before release
python -X utf8 webnovel-writer/scripts/sync_plugin_version.py --version X.Y.Z --release-notes "Notes"

# Then use GitHub Actions "Plugin Release" workflow
```

## Notes
- Use `python -X utf8` for proper UTF-8 handling on Windows
- Skills use lazy loading (L0-L3) for references to reduce context overhead
- Agent model defaults to `inherit` (uses current session model)
- Node CLI is the recommended interface; Python CLI remains for compatibility
