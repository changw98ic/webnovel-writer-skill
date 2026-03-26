/**
 * State Types - 项目状态定义
 *
 * 与 Python 版本的 state.json 格式保持兼容
 */
import { z } from 'zod';

// ============================================================================
// Project Info
// ============================================================================

export const ProjectInfoSchema = z.object({
  title: z.string(),
  genre: z.string(),
  target_words: z.number().int().min(0).default(0),
  target_chapters: z.number().int().min(0).default(0),
  one_liner: z.string().optional(),
  core_conflict: z.string().optional(),
  target_reader: z.string().optional(),
  platform: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ProjectInfo = z.infer<typeof ProjectInfoSchema>;

// ============================================================================
// Progress
// ============================================================================

export const ProgressSchema = z.object({
  current_chapter: z.number().int().min(0).default(0),
  total_words: z.number().int().min(0).default(0),
  completed_chapters: z.array(z.number().int()).default([]),
  planned_chapters: z.array(z.number().int()).default([]),
  reviewed_chapters: z.array(z.number().int()).default([]),
});

export type Progress = z.infer<typeof ProgressSchema>;

// ============================================================================
// Protagonist State
// ============================================================================

export const ProtagonistStateSchema = z.object({
  name: z.string(),
  realm: z.string().optional(),
  location: z.string().optional(),
  items: z.array(z.string()).default([]),
  relationships: z.record(z.unknown()).default({}),
  goals: z.array(z.string()).default([]),
  status: z.record(z.unknown()).default({}),
});

export type ProtagonistState = z.infer<typeof ProtagonistStateSchema>;

// ============================================================================
// Chapter Meta
// ============================================================================

export const HookSchema = z.object({
  type: z.string(),                           // 钩子类型（如 "危机钩", "悬念钩"）
  content: z.string(),                        // 钩子内容
  strength: z.enum(['strong', 'medium', 'weak']).default('medium'),
});

export type Hook = z.infer<typeof HookSchema>;

export const PatternSchema = z.object({
  opening: z.string().optional(),             // 开场类型
  hook: z.string().optional(),                // 钩子类型
  emotion_rhythm: z.string().optional(),      // 情绪节奏
  info_density: z.enum(['high', 'medium', 'low']).optional(),
});

export type Pattern = z.infer<typeof PatternSchema>;

export const EndingSchema = z.object({
  time: z.string().optional(),                // 结束时间
  location: z.string().optional(),            // 结束地点
  emotion: z.string().optional(),             // 结束情绪
});

export type Ending = z.infer<typeof EndingSchema>;

export const ChapterMetaSchema = z.object({
  chapter: z.number().int(),
  title: z.string().optional(),
  hook: HookSchema.optional(),
  pattern: PatternSchema.optional(),
  ending: EndingSchema.optional(),
  word_count: z.number().int().optional(),
  summary: z.string().optional(),
});

export type ChapterMeta = z.infer<typeof ChapterMetaSchema>;

// ============================================================================
// Plot Threads
// ============================================================================

export const ForeshadowingSchema = z.object({
  id: z.string(),
  content: z.string(),
  planted_chapter: z.number().int(),
  target_chapter: z.number().int().optional(),
  resolved_chapter: z.number().int().optional(),
  status: z.enum(['active', 'resolved', 'abandoned']).default('active'),
  type: z.string().optional(),                // 伏笔类型
});

export type Foreshadowing = z.infer<typeof ForeshadowingSchema>;

export const PlotThreadsSchema = z.object({
  foreshadowing: z.array(ForeshadowingSchema).default([]),
  active_conflicts: z.array(z.string()).default([]),
  unresolved_questions: z.array(z.string()).default([]),
});

export type PlotThreads = z.infer<typeof PlotThreadsSchema>;

// ============================================================================
// Strand Tracker
// ============================================================================

export const StrandTypeSchema = z.enum(['Quest', 'Fire', 'Constellation']);

export type StrandType = z.infer<typeof StrandTypeSchema>;

export const StrandEntrySchema = z.object({
  chapter: z.number().int(),
  type: StrandTypeSchema,
  content: z.string().optional(),
});

export type StrandEntry = z.infer<typeof StrandEntrySchema>;

export const StrandTrackerSchema = z.object({
  entries: z.array(StrandEntrySchema).default([]),
  quest_consecutive: z.number().int().min(0).default(0),
  fire_gap: z.number().int().min(0).default(0),
  constellation_gap: z.number().int().min(0).default(0),
});

export type StrandTracker = z.infer<typeof StrandTrackerSchema>;

// ============================================================================
// Project State (Root)
// ============================================================================

export const ProjectStateSchema = z.object({
  project_info: ProjectInfoSchema,
  progress: ProgressSchema.default({}),
  protagonist_state: ProtagonistStateSchema.optional(),
  chapter_meta: z.record(ChapterMetaSchema).default({}),
  plot_threads: PlotThreadsSchema.default({}),
  strand_tracker: StrandTrackerSchema.default({}),

  // 扩展字段
  disambiguation_warnings: z.array(z.unknown()).default([]),
  disambiguation_pending: z.array(z.unknown()).default([]),
  review_history: z.array(z.unknown()).default([]),

  // 兼容性字段（保留）
  entities_v3: z.record(z.unknown()).optional(),
  alias_index: z.record(z.string()).optional(),
  state_changes: z.array(z.unknown()).optional(),
});

export type ProjectState = z.infer<typeof ProjectStateSchema>;

// ============================================================================
// Validation Helper
// ============================================================================

export function validateProjectState(data: unknown): ProjectState {
  return ProjectStateSchema.parse(data);
}

export function loadProjectState(jsonString: string): ProjectState {
  const data = JSON.parse(jsonString);
  return ProjectStateSchema.parse(data);
}

export function saveProjectState(state: ProjectState): string {
  return JSON.stringify(state, null, 2);
}
