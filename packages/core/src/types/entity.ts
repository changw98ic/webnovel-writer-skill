/**
 * Entity Types - 实体类型定义
 *
 * 与 Python 版本保持兼容，用于：
 * - index.db 的 entities 表
 * - state.json 的实体状态
 */
import { z } from 'zod';

// ============================================================================
// Entity Types
// ============================================================================

export const EntityTypeSchema = z.enum([
  '角色',
  '地点',
  '物品',
  '势力',
  '招式',
  '事件',
  '概念',
]);

export type EntityType = z.infer<typeof EntityTypeSchema>;

export const EntityTierSchema = z.enum([
  '核心',      // 主角、核心配角
  '重要',      // 重要配角
  '次要',      // 次要配角
  '装饰',      // 龙套
]);

export type EntityTier = z.infer<typeof EntityTierSchema>;

// ============================================================================
// Entity Definition
// ============================================================================

export const EntitySchema = z.object({
  id: z.string(),                              // 唯一标识符（如 xiaoyan）
  type: EntityTypeSchema,
  canonical_name: z.string(),                  // 正式名称
  tier: EntityTierSchema.default('装饰'),

  // 当前状态（动态属性）
  current: z.record(z.unknown()).default({}),

  // 出场记录
  first_appearance: z.number().int().min(0).default(0),
  last_appearance: z.number().int().min(0).default(0),

  // 标记
  is_protagonist: z.boolean().default(false),
  is_archived: z.boolean().default(false),

  // 描述
  desc: z.string().optional(),
});

export type Entity = z.infer<typeof EntitySchema>;

// ============================================================================
// Alias
// ============================================================================

export const AliasSchema = z.object({
  id: z.number().int().optional(),
  alias: z.string(),
  entity_id: z.string(),
  entity_type: EntityTypeSchema,
});

export type Alias = z.infer<typeof AliasSchema>;

// ============================================================================
// State Change
// ============================================================================

export const StateChangeSchema = z.object({
  id: z.number().int().optional(),
  entity_id: z.string(),
  field: z.string(),
  old_value: z.string().nullable(),
  new_value: z.string().nullable(),
  reason: z.string().optional(),
  chapter: z.number().int().min(1),
});

export type StateChange = z.infer<typeof StateChangeSchema>;

// ============================================================================
// Relationship
// ============================================================================

export const RelationshipSchema = z.object({
  id: z.number().int().optional(),
  from_entity: z.string(),
  to_entity: z.string(),
  type: z.string(),                           // 关系类型（如 师徒、朋友、敌人）
  description: z.string().optional(),
  chapter: z.number().int().min(1),
});

export type Relationship = z.infer<typeof RelationshipSchema>;

// ============================================================================
// Relationship Event (v5.5+)
// ============================================================================

export const RelationshipEventSchema = z.object({
  id: z.number().int().optional(),
  from_entity: z.string(),
  to_entity: z.string(),
  type: z.string(),
  chapter: z.number().int().min(1),
  action: z.enum(['create', 'update', 'decay', 'remove']).default('update'),
  polarity: z.number().int().min(-1).max(1).default(0),
  strength: z.number().min(0).max(1).default(0.5),
  description: z.string().optional(),
  scene_index: z.number().int().min(0).default(0),
  evidence: z.string().optional(),
  confidence: z.number().min(0).max(1).default(1.0),
});

export type RelationshipEvent = z.infer<typeof RelationshipEventSchema>;

// ============================================================================
// Entity Extract Result (Data Agent Output)
// ============================================================================

export const EntityExtractResultSchema = z.object({
  entities_appeared: z.array(z.object({
    id: z.string(),
    type: EntityTypeSchema,
    mentions: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  })),

  entities_new: z.array(z.object({
    suggested_id: z.string(),
    name: z.string(),
    type: EntityTypeSchema,
    tier: EntityTierSchema,
  })),

  state_changes: z.array(z.object({
    entity_id: z.string(),
    field: z.string(),
    old: z.string(),
    new: z.string(),
    reason: z.string(),
  })),

  relationships_new: z.array(z.object({
    from: z.string(),
    to: z.string(),
    type: z.string(),
    description: z.string(),
  })),

  scenes_chunked: z.number().int().min(0),

  uncertain: z.array(z.object({
    mention: z.string(),
    candidates: z.array(z.object({
      type: EntityTypeSchema,
      id: z.string(),
    })),
    confidence: z.number().min(0).max(1),
  })),

  warnings: z.array(z.string()),
});

export type EntityExtractResult = z.infer<typeof EntityExtractResultSchema>;
