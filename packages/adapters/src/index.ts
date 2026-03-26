/**
 * @webnovel-skill/adapters
 *
 * 平台适配器统一入口
 */

import { generateClaudeSkill } from './claude-code/generator.js';
import { generateCursorRules } from './cursor/generator.js';
import { generateOpenAIFunctions } from './openai/generator.js';
import { generateOpenClawSkill } from './openclaw/generator.js';

import { Skill } from '@webnovel-skill/core';

export type Platform = 'claude-code' | 'cursor' | 'openai' | 'openclaw';

export interface AdapterOptions {
  platform: Platform;
  outputDir: string;
  skills: Skill[];
}

export interface AdapterOutput {
  files: Array<{ path: string; content: string }>;
  metadata?: Record<string, unknown>;
}

/**
 * 适配器工厂
 */
export function adapt(options: AdapterOptions): AdapterOutput {
  const { platform, skills } = options;

  const files: Array<{ path: string; content: string }> = [];

  switch (platform) {
    case 'claude-code':
      for (const skill of skills) {
        files.push(generateClaudeSkill(skill));
      }
      break;

    case 'cursor':
      const allRules = skills.map(s => generateCursorRules(s));
      // 合并为一个文件
      files.push({
        path: '.cursorrules',
        content: allRules.map(r => r.content).join('\n\n---\n\n'),
      });
      break;

    case 'openai':
      for (const skill of skills) {
        const output = generateOpenAIFunctions(skill);
        files.push({
          path: `${skill.name}/functions.json`,
          content: JSON.stringify(output.functions, null, 2),
        });
        files.push({
          path: `${skill.name}/system-prompt.md`,
          content: output.systemPrompt,
        });
        if (output.userPromptTemplate) {
          files.push({
            path: `${skill.name}/user-prompt-template.md`,
            content: output.userPromptTemplate,
          });
        }
      }
      break;

    case 'openclaw':
      for (const skill of skills) {
        const output = generateOpenClawSkill(skill);
        files.push({
          path: output.path,
          content: output.content,
        });
      }
      break;

    default:
      throw new Error(`Unknown platform: ${platform}`);
  }

  return { files };
}

// Re-export generator functions
export { generateClaudeSkill, generateCursorRules, generateOpenAIFunctions, generateOpenClawSkill };

export default adapt;
