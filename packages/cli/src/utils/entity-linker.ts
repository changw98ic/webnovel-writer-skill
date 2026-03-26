/**
 * 实体链接器 - 实体消歧辅助模块
 *
 * 迁移自 Python entity_linker.py
 * 为 Data Agent 提供实体消歧的辅助功能：
 * - 置信度判断
 * - 别名索引管理
 * - 消歧结果记录
 */
import { IndexManager } from '@webnovel-skill/data';
import type { EntityType } from '@webnovel-skill/core';

// ============================================================================
// Types
// ============================================================================

/** 消歧结果 */
export interface DisambiguationResult {
  mention: string;
  entityId: string | null;
  confidence: number;
  candidates: string[];
  adopted: boolean;
  warning?: string;
}

/** 不确定项 */
export interface UncertainItem {
  mention: string;
  candidates: string[];
  suggested?: string;
  confidence: number;
  context?: string;
}

/** 新实体 */
export interface NewEntity {
  id?: string;
  suggested_id?: string;
  name: string;
  type: EntityType;
  aliases?: string[];
}

// ============================================================================
// Entity Linker
// ============================================================================

export class EntityLinker {
  private indexManager: IndexManager;

  constructor(indexManager: IndexManager) {
    this.indexManager = indexManager;
  }

  // ==================== 别名管理 ====================

  /**
   * 注册新别名
   */
  registerAlias(entityId: string, alias: string, entityType: EntityType): boolean {
    if (!alias || !entityId) {
      return false;
    }

    try {
      this.indexManager.registerAlias(alias, entityId, entityType);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 查找别名对应的实体ID
   */
  lookupAlias(mention: string, entityType?: EntityType): string | null {
    const entity = this.indexManager.getEntityByAlias(mention);

    if (!entity) {
      return null;
    }

    if (entityType && entity.type !== entityType) {
      return null;
    }

    return entity.id;
  }

  /**
   * 查找别名对应的所有实体
   */
  lookupAliasAll(mention: string): Array<{ id: string; type: string }> {
    // IndexManager doesn't have a method to get all entities by alias,
    // so we use getEntityByAlias which returns the first match
    const entity = this.indexManager.getEntityByAlias(mention);
    if (!entity) {
      return [];
    }
    return [{ id: entity.id, type: entity.type }];
  }

  /**
   * 获取实体的所有别名
   */
  getAllAliases(entityId: string, entityType?: EntityType): string[] {
    const aliases = this.indexManager.getAliasesForEntity(entityId);

    if (entityType) {
      // Filter by type if needed - but IndexManager doesn't support this directly
      // For now, return all aliases
      return aliases.map(a => a.alias);
    }

    return aliases.map(a => a.alias);
  }

  // ==================== 消歧处理 ====================

  /**
   * 处理 AI 提取结果中的 uncertain 项
   */
  processUncertainItems(
    uncertainItems: UncertainItem[]
  ): { results: DisambiguationResult[]; warnings: string[] } {
    const results: DisambiguationResult[] = [];
    const warnings: string[] = [];

    for (const item of uncertainItems) {
      const result = this.processUncertain(
        item.mention,
        item.candidates,
        item.suggested,
        item.confidence,
        item.context
      );

      results.push(result);

      if (result.warning) {
        warnings.push(`${result.mention} → ${result.entityId}: ${result.warning}`);
      }
    }

    return { results, warnings };
  }

  private processUncertain(
    mention: string,
    candidates: string[],
    suggested?: string,
    _confidence = 0,
    _context?: string
  ): DisambiguationResult {
    // 1. 首先检查别名表
    const aliasMatch = this.lookupAlias(mention);
    if (aliasMatch) {
      return {
        mention,
        entityId: aliasMatch,
        confidence: 1.0,
        candidates: [aliasMatch],
        adopted: true,
      };
    }

    // 2. 检查建议的实体
    if (suggested && suggested !== 'NEW') {
      const entity = this.indexManager.getEntityById(suggested);
      if (entity) {
        // 检查建议是否合理
        const isReasonable = this.isSuggestionReasonable(mention, entity.canonical_name);

        return {
          mention,
          entityId: suggested,
          confidence: isReasonable ? 0.8 : 0.5,
          candidates: [suggested],
          adopted: isReasonable,
          warning: isReasonable ? undefined : `建议的实体 "${entity.canonical_name}" 与提及 "${mention}" 相似度较低`,
        };
      }
    }

    // 3. 在候选中查找
    const matchedCandidates: string[] = [];
    for (const candidate of candidates) {
      const entity = this.indexManager.getEntityById(candidate);
      if (entity) {
        matchedCandidates.push(candidate);
      }
    }

    if (matchedCandidates.length === 1) {
      return {
        mention,
        entityId: matchedCandidates[0],
        confidence: 0.7,
        candidates: matchedCandidates,
        adopted: true,
      };
    }

    if (matchedCandidates.length > 1) {
      return {
        mention,
        entityId: null,
        confidence: 0.3,
        candidates: matchedCandidates,
        adopted: false,
        warning: `多个候选实体: ${matchedCandidates.join(', ')}`,
      };
    }

    // 4. 无匹配，可能是新实体
    return {
      mention,
      entityId: null,
      confidence: 0,
      candidates: [],
      adopted: false,
      warning: '未找到匹配的实体，可能是新实体',
    };
  }

  private isSuggestionReasonable(mention: string, canonicalName: string): boolean {
    // 简单的相似度检查
    const mentionLower = mention.toLowerCase();
    const nameLower = canonicalName.toLowerCase();

    // 完全匹配
    if (mentionLower === nameLower) {
      return true;
    }

    // 包含关系
    if (mentionLower.includes(nameLower) || nameLower.includes(mentionLower)) {
      return true;
    }

    // 首字符相同（中文名）
    if (mention[0] === canonicalName[0]) {
      return true;
    }

    // 编辑距离检查（简化版）
    const distance = this.levenshteinDistance(mentionLower, nameLower);
    const maxLen = Math.max(mention.length, canonicalName.length);
    return distance / maxLen < 0.5; // 相似度 > 50%
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  // ==================== 新实体注册 ====================

  /**
   * 注册新实体的别名
   */
  registerNewEntities(newEntities: NewEntity[]): string[] {
    const registered: string[] = [];

    for (const entity of newEntities) {
      const entityId = entity.suggested_id ?? entity.id;

      if (!entityId || entityId === 'NEW') {
        continue;
      }

      // 注册主名称作为别名
      this.registerAlias(entityId, entity.name, entity.type);

      // 注册额外别名
      if (entity.aliases) {
        for (const alias of entity.aliases) {
          this.registerAlias(entityId, alias, entity.type);
        }
      }

      registered.push(entityId);
    }

    return registered;
  }
}
