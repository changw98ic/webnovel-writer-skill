# @changw98ic/adapters

平台适配器 - Claude Code / OpenAI / Cursor / OpenClaw。

## 安装

```bash
npm install @changw98ic/adapters
```

## 使用

### 根入口（推荐）

```typescript
import {
  adapt,
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
```

> 提示：`@changw98ic/adapters/openclaw` 也导出了 `generateOpenClawSkills`。

### CLI 配合

```bash
webnovel adapt --platform claude-code --output ./out
```

> `webnovel adapt` 当前使用 CLI 内置 `builtinSkills` 生成文件；如果你需要仓库里的插件版 Skill 资源，请查看根 `README.md` 与 `webnovel-writer/` 目录。

## 文档

详见 <https://github.com/changw98ic/webnovel-writer-skill#readme>

## License

GPL-3.0-or-later
