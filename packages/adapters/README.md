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

## 文档

详见 [项目主页](https://github.com/changw98ic/webnovel-writer-skill#readme)

## 致谢

本项目基于 [lingfengQAQ/webnovel-writer](https://github.com/lingfengQAQ/webnovel-writer) 开发。

## License

GPL-3.0-or-later
