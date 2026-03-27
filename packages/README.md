# Webnovel Skill - Node.js 版本

通用网文创作 Skill 框架的 Node.js/TypeScript 实现。

## 特性

- **多平台支持**: 一次定义，自动适配到 Claude Code / OpenAI / Cursor / OpenClaw
- **数据兼容**: 完全兼容现有 Python 版本的 state.json 和 index.db
- **类型安全**: TypeScript + Zod 提供完整的类型检查
- **NPM 发布**: 可作为 npm 包安装使用

## 安装

```bash
# 全局安装
npm install -g @changw98ic/cli

# 或者在项目中安装
npm install @changw98ic/core @changw98ic/data @changw98ic/adapters
```

## 快速开始

```bash
# 初始化项目
webnovel init "我的小说"

# 规划章节
webnovel plan 1

# 写作
webnovel write 1

# 审查
webnovel review 1-5

# 查询
webnovel query "萧炎"
```

## 平台适配

```bash
# 生成 Claude Code SKILL.md
webnovel adapt --platform claude-code --output ./skills/

# 生成 Cursor .cursorrules
webnovel adapt --platform cursor --output ./

# 生成 OpenAI Function Calling
webnovel adapt --platform openai --output ./functions/
```

## 包结构

| 包名 | 用途 |
|------|------|
| `@changw98ic/core` | 核心类型和 Skill 定义 |
| `@changw98ic/data` | 数据层（state/index/rag） |
| `@changw98ic/adapters` | 平台适配器 |
| `@changw98ic/cli` | 命令行工具 |

## 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 测试
pnpm test

# 开发模式（监听文件变化）
pnpm dev
```

## 从 Python 版本迁移

Node.js 版本完全兼容现有数据格式：

- `state.json` - 直接读写，无需转换
- `index.db` - 使用 better-sqlite3，表结构不变
- `vectors.db` - 向量索引格式不变

只需安装 Node.js 版本，现有项目可直接使用。

## 许可证

GPL-3.0
