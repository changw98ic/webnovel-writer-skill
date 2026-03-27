/**
 * 状态报告器
 *
 * 迁移自 Python status_reporter.py
 * 生成健康报告：角色活跃度、伏笔状态、爽点节奏
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { IndexManager } from '@changw98ic/data';
import { readJsonSafe } from './security.js';

// ============================================================================
// Types
// ============================================================================

export interface CharacterActivityResult {
  name: string;
  tier: string;
  lastAppearance: number;
  chaptersSinceLastAppearance: number;
  status: 'healthy' | 'warning' | 'critical';
}

export interface ForeshadowingResult {
  id: string;
  content: string;
  tier: string;
  plantedChapter: number | null;
  targetChapter: number | null;
  elapsedChapters: number | null;
  remainingChapters: number | null;
  status: 'healthy' | 'warning' | 'overtime';
  urgency: number;
}

export interface PacingResult {
  chapterRange: string;
  coolPointCount: number;
  avgWordsPerCoolPoint: number;
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface BasicStats {
  totalChapters: number;
  totalWords: number;
  avgWordsPerChapter: number;
  progress: number;
  targetWords: number;
}

export interface HealthReport {
  generatedAt: string;
  basicStats: BasicStats;
  characterActivity: CharacterActivityResult[];
  foreshadowing: ForeshadowingResult[];
  pacing: PacingResult[];
}

// ============================================================================
// Status Reporter
// ============================================================================

export class StatusReporter {
  private _projectRoot: string;
  private indexManager: IndexManager;
  private statePath: string;
  private bodyDir: string;

  /** Get the project root directory */
  get projectRoot(): string {
    return this._projectRoot;
  }

  constructor(projectRoot: string) {
    this._projectRoot = projectRoot;
    this.indexManager = new IndexManager({ projectRoot });
    this.statePath = join(projectRoot, '.webnovel', 'state.json');
    this.bodyDir = join(projectRoot, '正文');
  }

  // ==================== Main Report ====================

  /**
   * 生成健康报告
   */
  generateHealthReport(options?: {
    focus?: 'characters' | 'foreshadowing' | 'pacing' | 'all';
  }): HealthReport {
    const focus = options?.focus ?? 'all';

    return {
      generatedAt: new Date().toISOString(),
      basicStats: this.getBasicStats(),
      characterActivity: focus === 'all' || focus === 'characters'
        ? this.analyzeCharacterActivity()
        : [],
      foreshadowing: focus === 'all' || focus === 'foreshadowing'
        ? this.analyzeForeshadowing()
        : [],
      pacing: focus === 'all' || focus === 'pacing'
        ? this.analyzePacing()
        : [],
    };
  }

  // ==================== Basic Stats ====================

  getBasicStats(): BasicStats {
    const state = readJsonSafe<{
      progress?: { current_chapter?: number };
      target_words?: number;
    }>(this.statePath, {});

    // Count chapters
    let totalChapters = 0;
    let totalWords = 0;

    if (existsSync(this.bodyDir)) {
      const files = readdirSync(this.bodyDir).filter(f => f.endsWith('.md'));
      totalChapters = files.length;

      for (const file of files) {
        const filePath = join(this.bodyDir, file);
        try {
          const content = readFileSync(filePath, 'utf-8');
          // Count Chinese characters
          const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
          totalWords += chineseChars;
        } catch {
          continue;
        }
      }
    }

    const avgWordsPerChapter = totalChapters > 0
      ? Math.round(totalWords / totalChapters)
      : 0;

    const targetWords = state.target_words ?? 2000000;
    const progress = targetWords > 0
      ? Math.min(100, (totalWords / targetWords) * 100)
      : 0;

    return {
      totalChapters,
      totalWords,
      avgWordsPerChapter,
      progress: Math.round(progress * 10) / 10,
      targetWords,
    };
  }

  // ==================== Character Activity ====================

  analyzeCharacterActivity(): CharacterActivityResult[] {
    const state = readJsonSafe<{
      progress?: { current_chapter?: number };
    }>(this.statePath, {});

    const currentChapter = state.progress?.current_chapter ?? 0;
    const entities = this.indexManager.getEntities({ type: '角色' });

    const results: CharacterActivityResult[] = [];

    for (const entity of entities) {
      // Skip decorative characters
      if (entity.tier === '装饰') continue;

      const lastAppearance = entity.last_appearance ?? 0;
      const chaptersSince = currentChapter - lastAppearance;

      let status: 'healthy' | 'warning' | 'critical';
      if (entity.is_protagonist) {
        status = chaptersSince > 5 ? 'warning' : 'healthy';
      } else if (entity.tier === '核心') {
        status = chaptersSince > 30 ? 'critical' : chaptersSince > 15 ? 'warning' : 'healthy';
      } else {
        status = chaptersSince > 50 ? 'critical' : chaptersSince > 30 ? 'warning' : 'healthy';
      }

      results.push({
        name: entity.canonical_name,
        tier: entity.tier,
        lastAppearance,
        chaptersSinceLastAppearance: chaptersSince,
        status,
      });
    }

    // Sort: critical first, then warning, then healthy
    return results.sort((a, b) => {
      const order = { critical: 0, warning: 1, healthy: 2 };
      return order[a.status] - order[b.status];
    });
  }

  // ==================== Foreshadowing ====================

  analyzeForeshadowing(): ForeshadowingResult[] {
    const state = readJsonSafe<{
      progress?: { current_chapter?: number };
      plot_threads?: {
        foreshadowing?: Array<{
          id?: string;
          content?: string;
          tier?: string;
          status?: string;
          planted_chapter?: number;
          target_chapter?: number;
        }>;
      };
    }>(this.statePath, {});

    const currentChapter = state.progress?.current_chapter ?? 0;
    const foreshadowing = state.plot_threads?.foreshadowing ?? [];

    const results: ForeshadowingResult[] = [];

    for (const item of foreshadowing) {
      // Skip resolved items
      if (item.status === 'resolved' || item.status === '已回收') continue;

      const plantedChapter = item.planted_chapter ?? null;
      const targetChapter = item.target_chapter ?? null;

      const elapsedChapters = plantedChapter
        ? currentChapter - plantedChapter
        : null;

      const remainingChapters = targetChapter
        ? targetChapter - currentChapter
        : null;

      let status: 'healthy' | 'warning' | 'overtime';
      if (remainingChapters !== null && remainingChapters < 0) {
        status = 'overtime';
      } else if (elapsedChapters !== null && elapsedChapters > 100) {
        status = 'warning';
      } else {
        status = 'healthy';
      }

      // Calculate urgency
      let urgency = 0;
      const tier = item.tier ?? '支线';
      const tierWeight = tier === '核心' ? 3 : tier === '支线' ? 2 : 1;

      if (elapsedChapters !== null) {
        urgency = tierWeight * (elapsedChapters / 50);
      }
      if (remainingChapters !== null && remainingChapters < 20) {
        urgency += (20 - remainingChapters) * tierWeight;
      }

      results.push({
        id: item.id ?? '',
        content: item.content ?? '[未命名伏笔]',
        tier,
        plantedChapter,
        targetChapter,
        elapsedChapters,
        remainingChapters,
        status,
        urgency: Math.round(urgency * 10) / 10,
      });
    }

    // Sort by urgency descending
    return results.sort((a, b) => b.urgency - a.urgency);
  }

  // ==================== Pacing ====================

  analyzePacing(): PacingResult[] {
    if (!existsSync(this.bodyDir)) {
      return [];
    }

    const files = readdirSync(this.bodyDir)
      .filter(f => f.endsWith('.md'))
      .sort();

    const results: PacingResult[] = [];
    const batchSize = 50;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      let totalWords = 0;
      let coolPointCount = 0;

      for (const file of batch) {
        const filePath = join(this.bodyDir, file);
        try {
          const content = readFileSync(filePath, 'utf-8');
          const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
          totalWords += chineseChars;

          // Count cool points (爽点标记)
          const coolMatches = content.match(/爽点[：:]/g) || [];
          coolPointCount += coolMatches.length;
        } catch {
          continue;
        }
      }

      const avgWordsPerCoolPoint = coolPointCount > 0
        ? Math.round(totalWords / coolPointCount)
        : totalWords;

      let rating: 'excellent' | 'good' | 'fair' | 'poor';
      if (avgWordsPerCoolPoint <= 1200) {
        rating = 'excellent';
      } else if (avgWordsPerCoolPoint <= 1800) {
        rating = 'good';
      } else if (avgWordsPerCoolPoint <= 2500) {
        rating = 'fair';
      } else {
        rating = 'poor';
      }

      const startChapter = i + 1;
      const endChapter = Math.min(i + batchSize, files.length);

      results.push({
        chapterRange: `第 ${startChapter}-${endChapter} 章`,
        coolPointCount,
        avgWordsPerCoolPoint,
        rating,
      });
    }

    return results;
  }

  // ==================== Output ====================

  /**
   * 格式化为 Markdown
   */
  formatAsMarkdown(report: HealthReport): string {
    const lines: string[] = [];

    lines.push('# 📊 全书健康报告');
    lines.push('');
    lines.push(`生成时间: ${report.generatedAt}`);
    lines.push('');

    // 基本统计
    lines.push('## 📈 基本数据');
    lines.push('');
    const stats = report.basicStats;
    lines.push(`- **总章节数**: ${stats.totalChapters} 章`);
    lines.push(`- **总字数**: ${stats.totalWords.toLocaleString()} 字`);
    lines.push(`- **平均章节字数**: ${stats.avgWordsPerChapter.toLocaleString()} 字`);
    lines.push(`- **创作进度**: ${stats.progress}%（目标 ${stats.targetWords.toLocaleString()} 字）`);
    lines.push('');

    // 角色活跃度
    if (report.characterActivity.length > 0) {
      const dropped = report.characterActivity.filter(c => c.status !== 'healthy');
      if (dropped.length > 0) {
        lines.push(`## ⚠️ 角色掉线（${dropped.length}人）`);
        lines.push('');
        lines.push('| 角色 | 层级 | 最后出场 | 缺席章节 | 状态 |');
        lines.push('|------|------|---------|---------|------|');
        for (const c of dropped) {
          const statusIcon = c.status === 'critical' ? '🔴' : '🟡';
          const statusText = c.status === 'critical' ? '严重掉线' : '轻度掉线';
          lines.push(`| ${c.name} | ${c.tier} | 第 ${c.lastAppearance} 章 | ${c.chaptersSinceLastAppearance} 章 | ${statusIcon} ${statusText} |`);
        }
        lines.push('');
      }
    }

    // 伏笔状态
    if (report.foreshadowing.length > 0) {
      const overtime = report.foreshadowing.filter(f => f.status === 'overtime');
      if (overtime.length > 0) {
        lines.push(`## ⚠️ 伏笔超时（${overtime.length}条）`);
        lines.push('');
        lines.push('| 伏笔内容 | 埋设章节 | 已过章节 | 状态 |');
        lines.push('|---------|---------|---------|------|');
        for (const f of overtime) {
          lines.push(`| ${f.content.slice(0, 30)}... | 第 ${f.plantedChapter} 章 | ${f.elapsedChapters} 章 | 🔴 严重超时 |`);
        }
        lines.push('');
      }
    }

    // 爽点节奏
    if (report.pacing.length > 0) {
      lines.push('## 📈 爽点节奏分布');
      lines.push('');
      lines.push('```');
      for (const p of report.pacing) {
        const barLength = Math.round((3000 - p.avgWordsPerCoolPoint) / 150);
        const bar = '█'.repeat(Math.max(1, barLength));
        const ratingText = {
          excellent: '优秀',
          good: '良好',
          fair: '良好',
          poor: '偏低 ⚠️',
        }[p.rating];
        lines.push(`${p.chapterRange.padEnd(12)} ${bar} ${ratingText}（${p.avgWordsPerCoolPoint}字/爽点）`);
      }
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 保存报告到文件
   */
  saveReport(report: HealthReport, outputPath: string): void {
    const markdown = this.formatAsMarkdown(report);
    writeFileSync(outputPath, markdown, 'utf-8');
    console.log(`✅ 报告已保存: ${outputPath}`);
  }
}
