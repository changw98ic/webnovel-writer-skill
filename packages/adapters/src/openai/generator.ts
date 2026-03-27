/**
 * OpenAI Adapter - Function Calling 生成器
 *
 * 将统一 Skill 定义转换为 OpenAI Function Calling 格式
 */
import { Skill, ToolDefinition } from '@changw98ic/core';

export interface OpenAIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface OpenAIOutput {
  functions: OpenAIFunction[];
  systemPrompt: string;
  userPromptTemplate: string;
}

/**
 * 生成 OpenAI Function Calling 定义
 */
export function generateOpenAIFunctions(skill: Skill): OpenAIOutput {
  const functions = skill.tools.map(tool => convertToolToFunction(tool));
  const systemPrompt = generateSystemPrompt(skill);
  const userPromptTemplate = generateUserPromptTemplate(skill);

  return {
    functions,
    systemPrompt,
    userPromptTemplate,
  };
}

/**
 * 将 Tool 转换为 Function Calling 格式
 */
function convertToolToFunction(tool: ToolDefinition): OpenAIFunction {
  return {
    name: tool.name,
    description: tool.description || `Execute ${tool.type} operation`,
    parameters: {
      type: 'object',
      properties: tool.schema || {},
      required: tool.required ? Object.keys(tool.schema || {}) : [],
    },
  };
}

/**
 * 生成系统提示词
 */
function generateSystemPrompt(skill: Skill): string {
  const sections: string[] = [];

  sections.push(`# ${skill.name}`, '');
  sections.push(skill.description, '');

  // 工作流说明
  if (skill.workflow.length > 0) {
    sections.push('## 工作流', '');
    for (const step of skill.workflow) {
      const optional = step.optional ? ' [可选]' : '';
      sections.push(`${step.step}${optional}: ${step.action}`);
    }
    sections.push('');
  }

  // 成功标准
  if (skill.successCriteria && skill.successCriteria.length > 0) {
    sections.push('## 成功标准', '');
    for (const criterion of skill.successCriteria) {
      const required = criterion.required ? '[必须]' : '[可选]';
      sections.push(`- ${required} ${criterion.description}`);
    }
  }

  return sections.join('\n');
}

/**
 * 生成用户提示词模板
 */
function generateUserPromptTemplate(skill: Skill): string {
  const userPrompts = skill.prompts.filter(p => p.role === 'user');

  if (userPrompts.length === 0) {
    return '';
  }

  // 使用第一个用户提示词作为模板
  return userPrompts[0].content;
}

/**
 * 批量生成
 */
export function generateOpenAIFunctionsAll(skills: Skill[]): OpenAIOutput[] {
  return skills.map(generateOpenAIFunctions);
}
