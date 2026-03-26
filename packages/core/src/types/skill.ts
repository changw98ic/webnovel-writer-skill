/**
 * Skill Schema - 通用 Skill 定义格式
 *
 * 设计目标:
 * - 平台无关: 可编译到 Claude Code / OpenAI / Cursor / OpenClaw
 * - 类型安全: 使用 Zod 进行运行时验证
 * - 可扩展: 支持自定义工具和工作流
 */
import { z } from 'zod';

// ============================================================================
// Tool Definition
// ============================================================================

export const ToolTypeSchema = z.enum([
  'read',      // 读取文件
  'write',     // 写入文件
  'edit',      // 编辑文件
  'bash',      // 执行命令
  'http',      // HTTP 请求
  'task',      // 子任务/Agent 调用
  'grep',      // 搜索文件内容
  'glob',      // 搜索文件路径
  'ask',       // 用户交互
  'custom',    // 自定义工具
]);

export type ToolType = z.infer<typeof ToolTypeSchema>;

export const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  type: ToolTypeSchema,
  description: z.string().optional(),
  schema: z.record(z.unknown()).optional(),    // JSON Schema for parameters
  required: z.boolean().default(false),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// ============================================================================
// Prompt Template
// ============================================================================

export const PromptRoleSchema = z.enum(['system', 'user', 'assistant']);

export type PromptRole = z.infer<typeof PromptRoleSchema>;

export const PromptTemplateSchema = z.object({
  role: PromptRoleSchema,
  content: z.string(),
  condition: z.string().optional(),           // 条件表达式（何时使用此 prompt）
  template: z.string().optional(),            // 模板文件路径（替代 content）
  variables: z.record(z.string()).optional(), // 模板变量
});

export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;

// ============================================================================
// Workflow Step
// ============================================================================

export const WorkflowStepSchema = z.object({
  step: z.string(),                           // Step ID (如 "Step 0", "Step 1")
  name: z.string().optional(),                // Step 名称
  action: z.string(),                         // 动作描述
  tools: z.array(z.string()).optional(),      // 使用的工具名称
  references: z.array(z.string()).optional(), // 参考文档路径
  condition: z.string().optional(),           // 条件表达式
  optional: z.boolean().default(false),       // 是否可选
  timeout: z.number().optional(),             // 超时时间（毫秒）
  retry: z.number().optional(),               // 重试次数
  onFailure: z.enum(['abort', 'skip', 'continue']).default('abort'),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

// ============================================================================
// Reference Loading
// ============================================================================

export const ReferenceLoadLevelSchema = z.enum(['L0', 'L1', 'L2', 'L3']);

export type ReferenceLoadLevel = z.infer<typeof ReferenceLoadLevelSchema>;

export const ReferenceDefinitionSchema = z.object({
  path: z.string(),                           // 文件路径（相对于 skill 目录）
  purpose: z.string().optional(),             // 用途说明
  level: ReferenceLoadLevelSchema.default('L1'),
  trigger: z.string().optional(),             // 触发条件
});

export type ReferenceDefinition = z.infer<typeof ReferenceDefinitionSchema>;

// ============================================================================
// Success Criteria
// ============================================================================

export const SuccessCriterionSchema = z.object({
  id: z.string(),
  description: z.string(),
  required: z.boolean().default(true),
  validateCommand: z.string().optional(),     // 验证命令
});

export type SuccessCriterion = z.infer<typeof SuccessCriterionSchema>;

// ============================================================================
// Skill Definition
// ============================================================================

export const SkillSchema = z.object({
  // 基本信息
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string(),

  // 触发
  triggers: z.array(z.string()).min(1),       // 触发词/命令

  // 工具
  tools: z.array(ToolDefinitionSchema).min(1),

  // 提示词
  prompts: z.array(PromptTemplateSchema).min(1),

  // 工作流
  workflow: z.array(WorkflowStepSchema).min(1),

  // 参考文档
  references: z.array(ReferenceDefinitionSchema).optional(),

  // 成功标准
  successCriteria: z.array(SuccessCriterionSchema).optional(),

  // 元数据
  author: z.string().optional(),
  license: z.string().default('GPL-3.0'),
  keywords: z.array(z.string()).optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),

  // 平台适配配置
  adapters: z.record(z.unknown()).optional(),
});

export type Skill = z.infer<typeof SkillSchema>;

// ============================================================================
// Skill Collection
// ============================================================================

export const SkillCollectionSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  skills: z.array(SkillSchema),
});

export type SkillCollection = z.infer<typeof SkillCollectionSchema>;

// ============================================================================
// Validation Helper
// ============================================================================

export function validateSkill(data: unknown): Skill {
  return SkillSchema.parse(data);
}

export function safeValidateSkill(data: unknown): { success: true; data: Skill } | { success: false; error: z.ZodError } {
  const result = SkillSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
