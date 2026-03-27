/**
 * @changw98ic/adapters
 *
 * 平台适配器统一入口
 */

import { generateBundle } from './bundle/generator.js';
import { generateClaudeSkill } from './claude-code/generator.js';
import { generateCursorRules } from './cursor/generator.js';
import { generateOpenAIFunctions } from './openai/generator.js';
import { generateOpenClawSkill } from './openclaw/generator.js';

import { Skill } from '@changw98ic/core';

export type Platform = 'claude-code' | 'cursor' | 'openai' | 'openclaw' | 'codex' | 'opencode';

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
  let metadata: Record<string, unknown> | undefined;

  switch (platform) {
    case 'claude-code':
      for (const skill of skills) {
        files.push(generateClaudeSkill(skill));
      }
      break;

    case 'cursor': {
      const allRules = skills.map((skill) => generateCursorRules(skill));
      files.push({
        path: '.cursorrules',
        content: allRules.map((rule) => rule.content).join('\n\n---\n\n'),
      });
      break;
    }

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
    case 'codex':
    case 'opencode': {
      const bundleOutput = generateBundle(platform);
      files.push(...bundleOutput.files);
      metadata = { ...bundleOutput.metadata };
      break;
    }

    default:
      throw new Error(`Unknown platform: ${platform}`);
  }

  return { files, metadata };
}

// Re-export generator functions
export { generateBundle, generateClaudeSkill, generateCursorRules, generateOpenAIFunctions, generateOpenClawSkill };

export type { BundlePlatform, BundleOutput, BundleMetadata, BundleFileOutput } from './bundle/generator.js';

export default adapt;
