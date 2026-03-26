/**
 * Skill Schema Tests
 */
import { describe, it, expect } from 'vitest';
import {
  SkillSchema,
  ToolDefinitionSchema,
  WorkflowStepSchema,
  PromptTemplateSchema,
  validateSkill,
  safeValidateSkill,
} from '../types/skill.js';

describe('ToolDefinitionSchema', () => {
  it('should validate a minimal tool definition', () => {
    const tool = {
      name: 'Read',
      type: 'read' as const,
      required: true,
    };

    const result = ToolDefinitionSchema.safeParse(tool);
    expect(result.success).toBe(true);
  });

  it('should validate a complete tool definition', () => {
    const tool = {
      name: 'Write',
      type: 'write' as const,
      description: '写入文件',
      schema: { type: 'object', properties: { path: { type: 'string' } } },
      required: true,
    };

    const result = ToolDefinitionSchema.safeParse(tool);
    expect(result.success).toBe(true);
  });

  it('should reject invalid tool type', () => {
    const tool = {
      name: 'Invalid',
      type: 'invalid',
      required: true,
    };

    const result = ToolDefinitionSchema.safeParse(tool);
    expect(result.success).toBe(false);
  });
});

describe('WorkflowStepSchema', () => {
  it('should validate a workflow step', () => {
    const step = {
      step: 'Step 1',
      action: '读取总纲',
      tools: ['Read'],
      optional: false,
      onFailure: 'abort' as const,
    };

    const result = WorkflowStepSchema.safeParse(step);
    expect(result.success).toBe(true);
  });

  it('should default optional to false', () => {
    const step = {
      step: 'Step 1',
      action: '读取总纲',
    };

    const result = WorkflowStepSchema.parse(step);
    expect(result.optional).toBe(false);
  });
});

describe('PromptTemplateSchema', () => {
  it('should validate a system prompt', () => {
    const prompt = {
      role: 'system' as const,
      content: '你是一个网文创作助手',
    };

    const result = PromptTemplateSchema.safeParse(prompt);
    expect(result.success).toBe(true);
  });

  it('should validate with condition', () => {
    const prompt = {
      role: 'user' as const,
      content: '请继续写作',
      condition: 'chapter > 1',
    };

    const result = PromptTemplateSchema.safeParse(prompt);
    expect(result.success).toBe(true);
  });
});

describe('SkillSchema', () => {
  const validSkill = {
    name: 'test-skill',
    version: '1.0.0',
    description: 'A test skill',
    triggers: ['/test'],
    tools: [
      { name: 'Read', type: 'read', required: true },
    ],
    prompts: [
      { role: 'system', content: 'Test prompt' },
    ],
    workflow: [
      { step: 'Step 1', action: 'Test action', optional: false, onFailure: 'abort' },
    ],
  };

  it('should validate a complete skill', () => {
    const result = SkillSchema.safeParse(validSkill);
    expect(result.success).toBe(true);
  });

  it('should require name', () => {
    const { name, ...rest } = validSkill;
    const result = SkillSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should require version in semver format', () => {
    const result = SkillSchema.safeParse({ ...validSkill, version: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('should require at least one trigger', () => {
    const result = SkillSchema.safeParse({ ...validSkill, triggers: [] });
    expect(result.success).toBe(false);
  });

  it('should require at least one tool', () => {
    const result = SkillSchema.safeParse({ ...validSkill, tools: [] });
    expect(result.success).toBe(false);
  });
});

describe('validateSkill', () => {
  it('should parse valid skill', () => {
    const skill = {
      name: 'test',
      version: '1.0.0',
      description: 'Test',
      triggers: ['/test'],
      tools: [{ name: 'Read', type: 'read', required: true }],
      prompts: [{ role: 'system', content: 'Test' }],
      workflow: [{ step: 'Step 1', action: 'Test', optional: false, onFailure: 'abort' }],
    };

    const result = validateSkill(skill);
    expect(result.name).toBe('test');
  });

  it('should throw on invalid skill', () => {
    expect(() => validateSkill({})).toThrow();
  });
});

describe('safeValidateSkill', () => {
  it('should return success for valid skill', () => {
    const skill = {
      name: 'test',
      version: '1.0.0',
      description: 'Test',
      triggers: ['/test'],
      tools: [{ name: 'Read', type: 'read', required: true }],
      prompts: [{ role: 'system', content: 'Test' }],
      workflow: [{ step: 'Step 1', action: 'Test', optional: false, onFailure: 'abort' }],
    };

    const result = safeValidateSkill(skill);
    expect(result.success).toBe(true);
  });

  it('should return error for invalid skill', () => {
    const result = safeValidateSkill({});
    expect(result.success).toBe(false);
  });
});
