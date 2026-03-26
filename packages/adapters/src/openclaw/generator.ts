/**
 * OpenClaw Adapter - Skill JSON 生成器
 *
 * 将统一 Skill 定义转换为 OpenClaw skill.json 格式
 */
import { Skill, ToolDefinition } from '@webnovel-skill/core';

export interface OpenClawSkillJSON {
  name: string;
  version: string;
  description: string;
  triggers: string[];
  tools: Array<{
    name: string;
    type: string;
    config?: Record<string, unknown>;
  }>;
  prompts: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  workflow: Array<{
    step: string;
    action: string;
    tools?: string[];
    optional?: boolean;
  }>;
  metadata?: {
    author?: string;
    license?: string;
    keywords?: string[];
  };
}

export interface OpenClawOutput {
  skill: OpenClawSkillJSON;
  path: string;
  content: string;
}

/**
 * 生成 OpenClaw skill.json
 */
export function generateOpenClawSkill(skill: Skill): OpenClawOutput {
  const openClawSkill: OpenClawSkillJSON = {
    name: skill.name,
    version: skill.version,
    description: skill.description,
    triggers: skill.triggers,
    tools: skill.tools.map(tool => convertTool(tool)),
    prompts: skill.prompts,
    workflow: skill.workflow.map(step => ({
      step: step.step,
      action: step.action,
      tools: step.tools,
      optional: step.optional,
    })),
    metadata: {
      author: skill.author,
      license: skill.license,
      keywords: skill.keywords,
    },
  };

  return {
    skill: openClawSkill,
    path: `${skill.name}/skill.json`,
    content: JSON.stringify(openClawSkill, null, 2),
  };
}

/**
 * 转换工具定义
 */
function convertTool(tool: ToolDefinition): OpenClawSkillJSON['tools'][0] {
  return {
    name: tool.name,
    type: tool.type,
    config: tool.schema,
  };
}

/**
 * 批量生成
 */
export function generateOpenClawSkills(skills: Skill[]): OpenClawOutput[] {
  return skills.map(generateOpenClawSkill);
}
