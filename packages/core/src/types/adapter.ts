/**
 * Adapter Types - 平台适配器类型定义
 */
import { z } from 'zod';

// ============================================================================
// Claude Code Adapter
// ============================================================================

export const ClaudeCodeSkillMetaSchema = z.object({
  name: z.string(),
  description: z.string(),
  allowedTools: z.array(z.string()),
});

export type ClaudeCodeSkillMeta = z.infer<typeof ClaudeCodeSkillMetaSchema>;

// ============================================================================
// OpenAI Adapter
// ============================================================================

export const OpenAIFunctionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.unknown()),          // JSON Schema
});

export type OpenAIFunction = z.infer<typeof OpenAIFunctionSchema>;

export const OpenAIToolSchema = z.object({
  type: z.literal('function'),
  function: OpenAIFunctionSchema,
});

export type OpenAITool = z.infer<typeof OpenAIToolSchema>;

// ============================================================================
// Cursor Adapter
// ============================================================================

export const CursorRulesConfigSchema = z.object({
  projectName: z.string(),
  triggers: z.array(z.string()),
  rules: z.array(z.string()),
  tools: z.array(z.object({
    name: z.string(),
    description: z.string(),
    usage: z.string().optional(),
  })),
});

export type CursorRulesConfig = z.infer<typeof CursorRulesConfigSchema>;

// ============================================================================
// OpenClaw Adapter
// ============================================================================

export const OpenClawToolSchema = z.object({
  name: z.string(),
  type: z.enum(['read', 'write', 'bash', 'http', 'custom']),
  config: z.record(z.unknown()),
});

export type OpenClawTool = z.infer<typeof OpenClawToolSchema>;

export const OpenClawSkillSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  triggers: z.array(z.string()),
  tools: z.array(OpenClawToolSchema),
  prompts: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })),
  workflow: z.array(z.object({
    step: z.string(),
    action: z.string(),
  })),
});

export type OpenClawSkill = z.infer<typeof OpenClawSkillSchema>;

// ============================================================================
// Adapter Output
// ============================================================================

export const AdapterOutputSchema = z.object({
  platform: z.enum(['claude-code', 'openai', 'cursor', 'openclaw', 'codex', 'opencode']),
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
  })),
  metadata: z.record(z.unknown()).optional(),
});

export type AdapterOutput = z.infer<typeof AdapterOutputSchema>;
