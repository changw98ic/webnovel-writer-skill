# @changw98ic/core

通用网文创作 TypeScript 工具链的核心类型与 Skill 定义。

## 安装

```bash
npm install @changw98ic/core
```

## 使用

### 根入口

```typescript
import { ProjectStateSchema, validateProjectState } from '@changw98ic/core';
import {
  type Skill,
  type ProjectState,
  type Entity,
  type EntityType,
} from '@changw98ic/core';
```

### 子路径导入

```typescript
import { ProjectStateSchema } from '@changw98ic/core/types';
import type {
  Skill,
  ProjectState,
  Entity,
  EntityType,
} from '@changw98ic/core/types';
```

## 说明

- 根入口当前主要重导出 `types` 模块。
- 已发布的导出路径见 `packages/core/package.json`：`.`、`./types`。
- 上层 CLI、数据层和适配器包都依赖这里的类型定义。
- `ProjectState`、`Entity`、`EntityType`、`Skill` 是 TypeScript 类型；在 TS 中请用 `import type`。
- 纯运行时可直接导入的是 `ProjectStateSchema`、`EntitySchema`、`SkillSchema`、`validateProjectState()` 这类 JS 导出。

## 文档

- 项目主页：<https://github.com/changw98ic/webnovel-writer-skill#readme>
- 工作区包总览：`packages/README.md`

## License

GPL-3.0-or-later
