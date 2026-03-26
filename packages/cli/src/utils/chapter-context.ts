/**
 * 章节上下文提取器
 *
 * 迁移自 Python extract_chapter_context.py
 * 提取章节写作所需的上下文：大纲片段、前情摘要、角色状态、伏笔关联
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { IndexManager } from '@webnovel-skill/data';
import { readJsonSafe } from './security.js';

// ============================================================================
// Types
// ============================================================================

export interface EntityContext {
  id: string;
  name: string;
  type: string;
  tier: string;
  currentState?: Record<string, unknown>;
  lastAppearance?: number;
  desc?: string;
}

export interface ForeshadowingContext {
  id: string;
  content: string;
  plantedChapter: number;
  status: 'pending' | 'resolved' | 'abandoned';
  importance: 'core' | 'subplot' | 'decorative';
  relatedEntities: string[];
}

export interface StyleReference {
  sceneType: string;
  content: string;
  score: number;
}

export interface ChapterContext {
  chapter: number;
  outline?: string;
  previousSummaries: string[];
  characters: EntityContext[];
  locations: EntityContext[];
  foreshadowing: ForeshadowingContext[];
  styleReferences: StyleReference[];
  genreProfile?: Record<string, unknown>;
  writingGuidance?: string;
}

// ============================================================================
// Chapter Context Extractor
// ============================================================================

export class ChapterContextExtractor {
  private projectRoot: string;
  private indexManager: IndexManager;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.indexManager = new IndexManager({ projectRoot });
  }

  /**
   * 提取章节上下文
   */
  extract(chapter: number): ChapterContext {
    return {
      chapter,
      outline: this.extractChapterOutline(chapter),
      previousSummaries: this.getPreviousSummaries(chapter, 3),
      characters: this.getRelevantCharacters(chapter),
      locations: this.getRelevantLocations(chapter),
      foreshadowing: this.getPendingForeshadowing(chapter),
      styleReferences: [],
      genreProfile: this.getGenreProfile(),
      writingGuidance: this.getWritingGuidance(),
    };
  }

  /**
   * 提取章节大纲片段
   */
  extractChapterOutline(chapter: number): string | undefined {
    // 尝试从卷大纲中提取
    const outlineDir = join(this.projectRoot, '大纲');
    if (!existsSync(outlineDir)) {
      return undefined;
    }

    // 查找包含该章节的卷大纲
    const volumeFiles = readdirSync(outlineDir).filter(f =>
      f.startsWith('vol') || f.startsWith('卷')
    );

    for (const volFile of volumeFiles) {
      const volPath = join(outlineDir, volFile);
      try {
        const content = readFileSync(volPath, 'utf-8');
        // 查找章节标题
        const chapterPattern = new RegExp(
          `#+\\s*第${chapter}章[\\s\\S]*?(?=#+\\s*第${chapter + 1}章|$)`,
          'g'
        );
        const match = content.match(chapterPattern);
        if (match) {
          // 提取前 1500 字符
          return match[0].slice(0, 1500);
        }
      } catch {
        continue;
      }
    }

    return undefined;
  }

  /**
   * 获取前 N 章摘要
   */
  getPreviousSummaries(chapter: number, count = 3): string[] {
    const summaries: string[] = [];

    for (let i = chapter - 1; i >= Math.max(1, chapter - count); i--) {
      const summary = this.loadChapterSummary(i);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries;
  }

  private loadChapterSummary(chapter: number): string | undefined {
    // 优先从 .webnovel/summaries/chNNNN.md 读取
    const summaryPath = join(
      this.projectRoot,
      '.webnovel',
      'summaries',
      `ch${String(chapter).padStart(4, '0')}.md`
    );

    if (existsSync(summaryPath)) {
      try {
        const content = readFileSync(summaryPath, 'utf-8');
        const match = content.match(/##\s*剧情摘要\s*\n([\s\S]+?)(?=\n##|$)/);
        if (match) {
          return match[1].trim();
        }
      } catch {
        // Fall through
      }
    }

    // 回退到章节文件
    const chapterFile = this.findChapterFile(chapter);
    if (chapterFile) {
      try {
        const content = readFileSync(chapterFile, 'utf-8');
        const match = content.match(/##\s*本章摘要\s*\n([\s\S]+?)(?=\n##|$)/);
        if (match) {
          return match[1].trim();
        }
      } catch {
        // Fall through
      }
    }

    return undefined;
  }

  private findChapterFile(chapter: number): string | undefined {
    const bodyDir = join(this.projectRoot, '正文');
    if (!existsSync(bodyDir)) {
      return undefined;
    }

    const pattern = new RegExp(`第${chapter}章`);
    const files = readdirSync(bodyDir);

    for (const file of files) {
      if (pattern.test(file)) {
        return join(bodyDir, file);
      }
    }

    return undefined;
  }

  /**
   * 获取相关角色
   */
  getRelevantCharacters(chapter: number): EntityContext[] {
    const entities = this.indexManager.getEntities({ type: '角色' });
    const characters: EntityContext[] = [];

    for (const entity of entities) {
      // 获取最近出现的角色（前后 20 章内）
      const lastAppearance = entity.last_appearance ?? 0;
      if (Math.abs(lastAppearance - chapter) <= 20 || entity.is_protagonist) {
        characters.push({
          id: entity.id,
          name: entity.canonical_name,
          type: entity.type,
          tier: entity.tier,
          currentState: entity.current,
          lastAppearance: entity.last_appearance,
          desc: entity.desc,
        });
      }
    }

    // 按重要度和最近出现排序
    return characters.sort((a, b) => {
      // 主角优先
      if (a.tier === '核心' && b.tier !== '核心') return -1;
      if (a.tier !== '核心' && b.tier === '核心') return 1;
      // 最近出现优先
      return (b.lastAppearance ?? 0) - (a.lastAppearance ?? 0);
    }).slice(0, 20);
  }

  /**
   * 获取相关地点
   */
  getRelevantLocations(chapter: number): EntityContext[] {
    const entities = this.indexManager.getEntities({ type: '地点' });
    const locations: EntityContext[] = [];

    for (const entity of entities) {
      const lastAppearance = entity.last_appearance ?? 0;
      if (Math.abs(lastAppearance - chapter) <= 30) {
        locations.push({
          id: entity.id,
          name: entity.canonical_name,
          type: entity.type,
          tier: entity.tier,
          currentState: entity.current,
          lastAppearance: entity.last_appearance,
          desc: entity.desc,
        });
      }
    }

    return locations.slice(0, 10);
  }

  /**
   * 获取待回收伏笔
   */
  getPendingForeshadowing(chapter: number): ForeshadowingContext[] {
    const statePath = join(this.projectRoot, '.webnovel', 'state.json');
    const state = readJsonSafe<{
      foreshadowing?: Array<{
        id: string;
        content: string;
        planted_chapter: number;
        status: string;
        importance: string;
        related_entities?: string[];
      }>;
    }>(statePath, {});

    if (!state.foreshadowing) {
      return [];
    }

    // 筛选待回收且已埋设的伏笔
    return state.foreshadowing
      .filter(f => f.status === 'pending' && f.planted_chapter < chapter)
      .map(f => ({
        id: f.id,
        content: f.content,
        plantedChapter: f.planted_chapter,
        status: f.status as 'pending',
        importance: f.importance as 'core' | 'subplot' | 'decorative',
        relatedEntities: f.related_entities ?? [],
      }))
      .sort((a, b) => {
        // 核心优先
        if (a.importance === 'core' && b.importance !== 'core') return -1;
        if (a.importance !== 'core' && b.importance === 'core') return 1;
        // 早埋设的优先
        return a.plantedChapter - b.plantedChapter;
      })
      .slice(0, 10);
  }

  /**
   * 获取题材配置
   */
  private getGenreProfile(): Record<string, unknown> | undefined {
    const statePath = join(this.projectRoot, '.webnovel', 'state.json');
    const state = readJsonSafe<{
      genre_profile?: Record<string, unknown>;
    }>(statePath, {});

    return state.genre_profile;
  }

  /**
   * 获取写作指导
   */
  private getWritingGuidance(): string | undefined {
    const statePath = join(this.projectRoot, '.webnovel', 'state.json');
    const state = readJsonSafe<{
      writing_guidance?: string;
    }>(statePath, {});

    return state.writing_guidance;
  }

  /**
   * 格式化为 Markdown
   */
  formatAsMarkdown(context: ChapterContext): string {
    const lines: string[] = [];

    lines.push(`# 第 ${context.chapter} 章上下文`);
    lines.push('');

    // 大纲
    if (context.outline) {
      lines.push('## 📋 章节大纲');
      lines.push(context.outline);
      lines.push('');
    }

    // 前情摘要
    if (context.previousSummaries.length > 0) {
      lines.push('## 📖 前情摘要');
      context.previousSummaries.forEach((summary, i) => {
        lines.push(`### 第 ${context.chapter - context.previousSummaries.length + i} 章`);
        lines.push(summary);
        lines.push('');
      });
    }

    // 角色
    if (context.characters.length > 0) {
      lines.push('## 👥 相关角色');
      context.characters.forEach(c => {
        lines.push(`- **${c.name}** (${c.tier})${c.desc ? `: ${c.desc.slice(0, 100)}...` : ''}`);
      });
      lines.push('');
    }

    // 地点
    if (context.locations.length > 0) {
      lines.push('## 📍 相关地点');
      context.locations.forEach(l => {
        lines.push(`- **${l.name}**${l.desc ? `: ${l.desc.slice(0, 50)}...` : ''}`);
      });
      lines.push('');
    }

    // 伏笔
    if (context.foreshadowing.length > 0) {
      lines.push('## 🔮 待回收伏笔');
      context.foreshadowing.forEach(f => {
        lines.push(`- **[${f.importance}]** 第${f.plantedChapter}章: ${f.content.slice(0, 100)}...`);
      });
      lines.push('');
    }

    // 写作指导
    if (context.writingGuidance) {
      lines.push('## ✍️ 写作指导');
      lines.push(context.writingGuidance);
      lines.push('');
    }

    return lines.join('\n');
  }
}
