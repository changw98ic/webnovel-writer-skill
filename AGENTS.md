# Repository Guidelines

## Project Structure & Module Organization

本仓库是 `pnpm` monorepo，workspace 定义见 `pnpm-workspace.yaml`，当前只包含 `packages/*`。核心代码位于 `packages/core/src`、`packages/data/src`、`packages/adapters/src`、`packages/cli/src`、`packages/dashboard/src`；测试主要放在 `packages/*/src/**/*.test.ts` 和 `packages/*/__tests__/**/*.ts`，由 `vitest.config.ts` 统一收集。发布用的插件资产不在 workspace 包内，而在 `webnovel-writer/`，其中 `skills/`、`agents/`、`templates/`、`references/`、`scripts/` 为运行时资源，`webnovel-writer/dashboard/frontend/` 为前端子项目。

## Build, Test, and Development Commands

- `pnpm install`：安装根工作区依赖，要求 Node `>=18`、`pnpm@9`。
- `pnpm build`：递归执行各包 `tsc -p tsconfig.build.json`，产出到 `packages/*/dist`。
- `pnpm test`：运行根级 `vitest run`。
- `pnpm test:watch`：本地持续观察测试。
- `pnpm lint`：执行 `eslint packages --ext .ts`，仅检查 workspace 源码。
- `pnpm dev`：并行启动各包 watch 编译。
- `pnpm cli -- --help`：通过 `tsx packages/cli/src/index.ts` 调试 CLI；示例：`pnpm cli -- init "示例小说"`。

## Coding Style & Naming Conventions

使用 TypeScript ESM，导入路径保留显式 `.js` 后缀，示例见 `packages/cli/src/index.ts`。现有源码以 2 空格缩进、保留分号、按职责拆分到 `src/<domain>/`；类型、状态、适配器等使用清晰名词命名，命令实现放在 `packages/cli/src/commands/*.ts`。仓库未发现独立 Prettier 配置，提交前至少运行 `pnpm lint`，并保持与相邻文件一致的排版与注释风格。

## Testing Guidelines

测试框架是 Vitest，环境为 `node`，覆盖率使用 V8，并输出 `text`、`json`、`html` 报告。新增逻辑优先补同目录测试，命名建议沿用 `*.test.ts`，例如 `packages/core/src/__tests__/skill.test.ts`。修改数据层或状态持久化时，优先补充临时目录、文件锁和边界条件用例。

## Commit & Pull Request Guidelines

近期提交以 Conventional Commits 为主：`fix:`、`docs:`、`chore:`，也存在面向版本的 `chore: release vX.Y.Z` 与少量合并提交。建议继续使用 `type: summary`，一句话写清影响面；大改动拆成多个逻辑独立提交。PR 需说明改动模块、验证命令和结果；涉及 CLI 输出、技能模板或 Dashboard 行为时，附示例命令、生成文件路径，UI 变更附截图。若触及版本元数据或发版流程，额外检查 `.github/workflows/plugin-version.yml` 和 `.github/workflows/plugin-release.yml` 相关约束。
