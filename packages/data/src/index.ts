/**
 * @changw98ic/data
 *
 * 数据层 - 状态管理、实体索引、 RAG 检索
 */

export { StateManager } from './state/manager.js';
export { IndexManager } from './index-manager/manager.js';
export { RAGAdapter } from './rag/adapter.js';

// Re-export types
export type {
  ProjectState,
  ProjectInfo,
  Progress,
  ChapterMeta,
  Hook,
  Pattern,
  Ending,
  PlotThreads,
  Foreshadowing,
  StrandTracker,
  StrandEntry,
  Entity,
  EntityType,
  EntityTier,
  Alias,
  StateChange,
  Relationship,
} from '@changw98ic/core';
