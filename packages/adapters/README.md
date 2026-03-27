# @changw98ic/adapters

平台适配器与直接可用 Skill bundle 生成器。

## 安装

```bash
npm install @changw98ic/adapters
```

## 使用

### 根入口（推荐）

```typescript
import {
  adapt,
  generateBundle,
  generateClaudeSkill,
  generateCursorRules,
  generateOpenAIFunctions,
  generateOpenClawSkill,
} from '@changw98ic/adapters';
```

### 子路径导入

```typescript
import { generateClaudeSkill } from '@changw98ic/adapters/claude-code';
import { generateOpenAIFunctions } from '@changw98ic/adapters/openai';
import { generateCursorRules } from '@changw98ic/adapters/cursor';
import { generateOpenClawSkill } from '@changw98ic/adapters/openclaw';
import { generateBundle } from '@changw98ic/adapters/bundle';
```

## `adapt()` 当前怎么分流

### 完整 bundle

- `codex`
- `opencode`
- `openclaw`

这 3 个平台会直接输出 `webnovel-writer/` 下的完整运行时资产，并保留：

- `skills/`
- `agents/`
- `references/`
- `scripts/`
- `templates/`
- `dashboard/`
- `genres/`

另外会生成：

- `webnovel-bootstrap-env.sh`
- `WEBNOVEL_BUNDLE.md`
- `openclaw-plugin/`（仅 `openclaw`）

### 旧式 adapter

- `claude-code`
- `cursor`
- `openai`

这 3 个平台仍然基于传入的 `skills: Skill[]` 生成结构化输出。

## CLI 配合

```bash
webnovel adapt --platform codex --output ./target
webnovel adapt --platform opencode --output ./target
webnovel adapt --platform openclaw --output ./target
```

OpenClaw 还可直接安装原生插件包：

```bash
openclaw plugins install ./target/openclaw-plugin
openclaw plugins enable webnovel-writer-skill
```

## 文档

详见 <https://github.com/changw98ic/webnovel-writer-skill#readme>

## License

GPL-3.0-or-later
