/**
 * 归档管理器
 *
 * 迁移自 Python archive_manager.py
 * 防止 state.json 无限增长，确保 200 万字长跑稳定运行
 *
 * 归档策略：
 * - 角色：超过 50 章未出场的次要角色 → archive/characters.json
 * - 伏笔：status="已回收" 且超过 20 章的伏笔 → archive/plot_threads.json
 * - 审查报告：超过 50 章的旧报告 → archive/reviews.json
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { IndexManager } from '@changw98ic/data';
import { readJsonSafe, writeJsonAtomic } from './security.js';

// ============================================================================
// Types
// ============================================================================

export interface ArchiveConfig {
  characterInactiveThreshold: number;  // 角色超过 N 章未出场视为不活跃
  plotResolvedThreshold: number;       // 已回收伏笔超过 N 章后归档
  reviewOldThreshold: number;          // 审查报告超过 N 章后归档
  fileSizeTriggerMb: number;           // state.json 超过 N MB 触发强制归档
  chapterTrigger: number;              // 每 N 章检查一次
}

export interface TriggerResult {
  shouldArchive: boolean;
  fileSizeMb: number;
  currentChapter: number;
  sizeTrigger: boolean;
  chapterTrigger: boolean;
}

export interface InactiveCharacter {
  character: Record<string, unknown>;
  inactiveChapters: number;
  lastAppearance: number;
}

export interface ResolvedThread {
  thread: Record<string, unknown>;
  chaptersSinceResolved: number;
  resolvedChapter: number;
}

export interface OldReview {
  review: Record<string, unknown>;
  chaptersSinceReview: number;
  reviewChapter: number;
}

export interface ArchiveResult {
  charactersArchived: number;
  threadsArchived: number;
  reviewsArchived: number;
  savedMb: number;
}

export interface ArchiveStats {
  charactersCount: number;
  threadsCount: number;
  reviewsCount: number;
  archiveSizeKb: number;
  stateSizeMb: number;
}

// ============================================================================
// Archive Manager
// ============================================================================

export class ArchiveManager {
  private _projectRoot: string;
  private indexManager: IndexManager;
  private statePath: string;
  private archiveDir: string;
  private charactersArchivePath: string;
  private plotThreadsArchivePath: string;
  private reviewsArchivePath: string;

  private config: ArchiveConfig = {
    characterInactiveThreshold: 50,
    plotResolvedThreshold: 20,
    reviewOldThreshold: 50,
    fileSizeTriggerMb: 1.0,
    chapterTrigger: 10,
  };

  /** Get the project root directory */
  get projectRoot(): string {
    return this._projectRoot;
  }

  constructor(projectRoot: string) {
    this._projectRoot = projectRoot;
    this.indexManager = new IndexManager({ projectRoot });
    this.statePath = join(projectRoot, '.webnovel', 'state.json');
    this.archiveDir = join(projectRoot, '.webnovel', 'archive');

    // Ensure archive directory exists
    if (!existsSync(this.archiveDir)) {
      mkdirSync(this.archiveDir, { recursive: true });
    }

    this.charactersArchivePath = join(this.archiveDir, 'characters.json');
    this.plotThreadsArchivePath = join(this.archiveDir, 'plot_threads.json');
    this.reviewsArchivePath = join(this.archiveDir, 'reviews.json');
  }

  // ==================== State Operations ====================

  private loadState(): Record<string, unknown> {
    return readJsonSafe<Record<string, unknown>>(this.statePath, {});
  }

  private saveState(state: Record<string, unknown>): void {
    writeJsonAtomic(this.statePath, state);
    console.log('✅ state.json 已原子化更新');
  }

  private loadArchive<T>(archivePath: string): T[] {
    if (!existsSync(archivePath)) {
      return [];
    }
    return readJsonSafe<T[]>(archivePath, []);
  }

  private saveArchive<T>(archivePath: string, data: T[]): void {
    writeFileSync(archivePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // ==================== Trigger Detection ====================

  checkTriggerConditions(state: Record<string, unknown>): TriggerResult {
    const progress = state.progress as Record<string, unknown> | undefined;
    const currentChapter = (progress?.current_chapter as number) ?? 0;

    // Condition 1: File size exceeds threshold
    let fileSizeMb = 0;
    if (existsSync(this.statePath)) {
      const stats = statSync(this.statePath);
      fileSizeMb = stats.size / (1024 * 1024);
    }
    const sizeTrigger = fileSizeMb >= this.config.fileSizeTriggerMb;

    // Condition 2: Chapter count is multiple of trigger interval
    const chapterTrigger =
      currentChapter > 0 &&
      currentChapter % this.config.chapterTrigger === 0;

    return {
      shouldArchive: sizeTrigger || chapterTrigger,
      fileSizeMb,
      currentChapter,
      sizeTrigger,
      chapterTrigger,
    };
  }

  // ==================== Identification ====================

  identifyInactiveCharacters(state: Record<string, unknown>): InactiveCharacter[] {
    const progress = state.progress as Record<string, unknown> | undefined;
    const currentChapter = (progress?.current_chapter as number) ?? 0;
    const threshold = this.config.characterInactiveThreshold;

    // Get all characters from IndexManager
    const characters = this.indexManager.getEntities({ type: '角色' });

    const inactive: InactiveCharacter[] = [];

    for (const char of characters) {
      // Only archive non-core characters (tier="装饰" or tier="支线")
      const tier = String(char.tier ?? '').trim();
      if (tier === '核心') continue;

      // Check last appearance chapter
      const lastAppearance = (char.last_appearance as number) ?? 0;
      if (lastAppearance <= 0) continue;

      const inactiveChapters = currentChapter - lastAppearance;

      if (inactiveChapters >= threshold) {
        // Build character data without duplicate keys
        const charData: Record<string, unknown> = {
          name: char.canonical_name ?? char.id,
          last_appearance_chapter: lastAppearance,
        };
        // Copy other properties from char, avoiding duplicates
        for (const [key, value] of Object.entries(char)) {
          if (!(key in charData)) {
            charData[key] = value;
          }
        }
        charData.id = char.id;
        charData.tier = tier;

        inactive.push({
          character: charData,
          inactiveChapters,
          lastAppearance,
        });
      }
    }

    return inactive;
  }

  identifyResolvedPlotThreads(state: Record<string, unknown>): ResolvedThread[] {
    const progress = state.progress as Record<string, unknown> | undefined;
    const currentChapter = (progress?.current_chapter as number) ?? 0;
    const plotThreads = (state.plot_threads as Record<string, unknown>) ?? {};
    const foreshadowing = (plotThreads.foreshadowing as Array<Record<string, unknown>>) ?? [];
    const resolvedLegacy = (plotThreads.resolved as Array<Record<string, unknown>>) ?? [];
    const threshold = this.config.plotResolvedThreshold;

    const archivable: ResolvedThread[] = [];

    // New format: plot_threads.foreshadowing (with status field)
    for (const item of foreshadowing) {
      const status = String(item.status ?? '').trim();
      if (!['已回收', 'resolved'].includes(status)) continue;

      const resolvedChapter = (item.resolved_chapter as number) ?? 0;
      if (resolvedChapter <= 0) continue;

      const chaptersSinceResolved = currentChapter - resolvedChapter;
      if (chaptersSinceResolved >= threshold) {
        archivable.push({
          thread: item,
          chaptersSinceResolved,
          resolvedChapter,
        });
      }
    }

    // Legacy format: plot_threads.resolved (direct list)
    for (const item of resolvedLegacy) {
      const resolvedChapter = (item.resolved_chapter as number) ?? 0;
      if (resolvedChapter <= 0) continue;

      const chaptersSinceResolved = currentChapter - resolvedChapter;
      if (chaptersSinceResolved >= threshold) {
        archivable.push({
          thread: item,
          chaptersSinceResolved,
          resolvedChapter,
        });
      }
    }

    return archivable;
  }

  identifyOldReviews(state: Record<string, unknown>): OldReview[] {
    const progress = state.progress as Record<string, unknown> | undefined;
    const currentChapter = (progress?.current_chapter as number) ?? 0;
    const reviews = (state.review_checkpoints as Array<Record<string, unknown>>) ?? [];
    const threshold = this.config.reviewOldThreshold;

    const parseEndChapter = (review: Record<string, unknown>): number => {
      // New format: {"chapters":"5-6","report":"...","reviewed_at":"..."}
      const chapters = review.chapters as string | undefined;
      if (chapters) {
        const parts = chapters.replace(/—/g, '-').split('-').map(p => p.trim()).filter(Boolean);
        if (parts.length > 0) {
          const last = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(last)) return last;
        }
      }

      // Legacy format: {"chapter_range":[5,6], "date":"..."}
      const cr = review.chapter_range as Array<number> | undefined;
      if (cr && cr.length >= 2) {
        const last = cr[1];
        if (!isNaN(last)) return last;
      }

      // Fallback: extract from report filename
      const report = review.report as string | undefined;
      if (report) {
        // Try "Ch5-6" pattern
        let m = report.match(/Ch(\d+)[-–—](\d+)/);
        if (m) {
          const last = parseInt(m[2], 10);
          if (!isNaN(last)) return last;
        }
        // Try "第5-6章" pattern
        m = report.match(/第(\d+)[-–—](\d+)章/);
        if (m) {
          const last = parseInt(m[2], 10);
          if (!isNaN(last)) return last;
        }
      }

      return 0;
    };

    const oldReviews: OldReview[] = [];

    for (const review of reviews) {
      const reviewChapter = parseEndChapter(review);
      const chaptersSinceReview = currentChapter - reviewChapter;

      if (chaptersSinceReview >= threshold) {
        oldReviews.push({
          review,
          chaptersSinceReview,
          reviewChapter,
        });
      }
    }

    return oldReviews;
  }

  // ==================== Archive Operations ====================

  archiveCharacters(inactiveList: InactiveCharacter[], dryRun = false): number {
    if (inactiveList.length === 0) return 0;

    const archived = this.loadArchive<Record<string, unknown>>(this.charactersArchivePath);

    const timestamp = new Date().toISOString();
    for (const item of inactiveList) {
      item.character.archived_at = timestamp;
      archived.push(item.character);
    }

    if (!dryRun) {
      this.saveArchive(this.charactersArchivePath, archived);
    }

    return inactiveList.length;
  }

  archivePlotThreads(resolvedList: ResolvedThread[], dryRun = false): number {
    if (resolvedList.length === 0) return 0;

    const archived = this.loadArchive<Record<string, unknown>>(this.plotThreadsArchivePath);

    const timestamp = new Date().toISOString();
    for (const item of resolvedList) {
      item.thread.archived_at = timestamp;
      archived.push(item.thread);
    }

    if (!dryRun) {
      this.saveArchive(this.plotThreadsArchivePath, archived);
    }

    return resolvedList.length;
  }

  archiveReviews(oldReviewsList: OldReview[], dryRun = false): number {
    if (oldReviewsList.length === 0) return 0;

    const archived = this.loadArchive<Record<string, unknown>>(this.reviewsArchivePath);

    const timestamp = new Date().toISOString();
    for (const item of oldReviewsList) {
      item.review.archived_at = timestamp;
      archived.push(item.review);
    }

    if (!dryRun) {
      this.saveArchive(this.reviewsArchivePath, archived);
    }

    return oldReviewsList.length;
  }

  private removeFromState(
    state: Record<string, unknown>,
    _inactiveChars: InactiveCharacter[], // Note: Character archiving is handled via IndexManager's is_archived flag
    resolvedThreads: ResolvedThread[],
    oldReviews: OldReview[]
  ): Record<string, unknown> {
    // Note: Characters are archived in SQLite via IndexManager's is_archived flag
    // They are NOT removed from state.json

    // Remove archived plot threads
    if (resolvedThreads.length > 0) {
      const threadIds = new Set<string>();
      for (const item of resolvedThreads) {
        const content = (item.thread.content as string) ?? (item.thread.description as string);
        if (content && content.trim()) {
          threadIds.add(content.trim());
        }
      }

      const plotThreads = (state.plot_threads as Record<string, unknown>) ?? {};

      if (Array.isArray(plotThreads.foreshadowing)) {
        plotThreads.foreshadowing = (plotThreads.foreshadowing as Array<Record<string, unknown>>).filter(t => {
          const content = (t.content as string) ?? (t.description as string);
          return !content || !threadIds.has(content.trim());
        });
      }

      if (Array.isArray(plotThreads.resolved)) {
        plotThreads.resolved = (plotThreads.resolved as Array<Record<string, unknown>>).filter(t => {
          const content = (t.content as string) ?? (t.description as string);
          return !content || !threadIds.has(content.trim());
        });
      }

      state.plot_threads = plotThreads;
    }

    // Remove old reviews
    if (oldReviews.length > 0) {
      const reviewKeys = new Set<string>();
      for (const item of oldReviews) {
        const key = (item.review.report as string) ??
                    (item.review.reviewed_at as string) ??
                    (item.review.date as string);
        if (key && key.trim()) {
          reviewKeys.add(key.trim());
        }
      }

      state.review_checkpoints = ((state.review_checkpoints as Array<Record<string, unknown>>) ?? []).filter(review => {
        const key = (review.report as string) ??
                    (review.reviewed_at as string) ??
                    (review.date as string);
        return !key || !reviewKeys.has(key.trim());
      });
    }

    return state;
  }

  // ==================== Main Operations ====================

  runAutoCheck(force = false, dryRun = false): ArchiveResult | null {
    const state = this.loadState();

    // Check trigger conditions
    const trigger = this.checkTriggerConditions(state);

    if (!force && !trigger.shouldArchive) {
      console.log('✅ 无需归档（触发条件未满足）');
      console.log(`   文件大小: ${trigger.fileSizeMb.toFixed(2)} MB (阈值: ${this.config.fileSizeTriggerMb} MB)`);
      console.log(`   当前章节: ${trigger.currentChapter} (每 ${this.config.chapterTrigger} 章触发)`);
      return null;
    }

    console.log('🔍 开始归档检查...');
    console.log(`   文件大小: ${trigger.fileSizeMb.toFixed(2)} MB`);
    console.log(`   当前章节: ${trigger.currentChapter}`);

    // Identify archivable data
    const inactiveChars = this.identifyInactiveCharacters(state);
    const resolvedThreads = this.identifyResolvedPlotThreads(state);
    const oldReviews = this.identifyOldReviews(state);

    // Output stats
    console.log('\n📊 归档统计:');
    console.log(`   不活跃角色: ${inactiveChars.length}`);
    console.log(`   已回收伏笔: ${resolvedThreads.length}`);
    console.log(`   旧审查报告: ${oldReviews.length}`);

    if (inactiveChars.length === 0 && resolvedThreads.length === 0 && oldReviews.length === 0) {
      console.log('\n✅ 无需归档（无符合条件的数据）');
      return null;
    }

    // Dry-run mode
    if (dryRun) {
      console.log('\n🔍 [Dry-run] 将被归档的数据:');
      if (inactiveChars.length > 0) {
        console.log('\n   不活跃角色:');
        for (const item of inactiveChars.slice(0, 5)) {
          const name = (item.character.name as string) ?? '未知';
          console.log(`   - ${name} (超过 ${item.inactiveChapters} 章未出场)`);
        }
      }
      if (resolvedThreads.length > 0) {
        console.log('\n   已回收伏笔:');
        for (const item of resolvedThreads.slice(0, 5)) {
          const desc = ((item.thread.content as string) ?? (item.thread.description as string) ?? '').slice(0, 30);
          console.log(`   - ${desc}... (已回收 ${item.chaptersSinceResolved} 章)`);
        }
      }
      if (oldReviews.length > 0) {
        console.log('\n   旧审查报告:');
        for (const item of oldReviews.slice(0, 5)) {
          console.log(`   - Ch${item.reviewChapter} (${item.chaptersSinceReview} 章前)`);
        }
      }
      return null;
    }

    // Execute archive
    const charsArchived = this.archiveCharacters(inactiveChars, dryRun);
    const threadsArchived = this.archivePlotThreads(resolvedThreads, dryRun);
    const reviewsArchived = this.archiveReviews(oldReviews, dryRun);

    // Remove from state.json
    const newState = this.removeFromState(state, inactiveChars, resolvedThreads, oldReviews);
    this.saveState(newState);

    // Calculate saved space
    let newFileSizeMb = 0;
    if (existsSync(this.statePath)) {
      const stats = statSync(this.statePath);
      newFileSizeMb = stats.size / (1024 * 1024);
    }
    const savedMb = trigger.fileSizeMb - newFileSizeMb;

    // Final stats
    console.log('\n✅ 归档完成:');
    console.log(`   角色归档: ${charsArchived} → characters.json`);
    console.log(`   伏笔归档: ${threadsArchived} → plot_threads.json`);
    console.log(`   报告归档: ${reviewsArchived} → reviews.json`);
    console.log(`\n💾 文件大小: ${trigger.fileSizeMb.toFixed(2)} MB → ${newFileSizeMb.toFixed(2)} MB (节省 ${savedMb.toFixed(2)} MB)`);

    return {
      charactersArchived: charsArchived,
      threadsArchived: threadsArchived,
      reviewsArchived: reviewsArchived,
      savedMb,
    };
  }

  restoreCharacter(name: string): boolean {
    const archived = this.loadArchive<Record<string, unknown>>(this.charactersArchivePath);

    // Find character
    const charToRestore = archived.find(char => char.name === name);
    if (!charToRestore) {
      console.log(`❌ 归档中未找到角色: ${name}`);
      return false;
    }

    // Remove archived_at field
    delete charToRestore.archived_at;

    // Remove from archive
    const newArchived = archived.filter(char => char.name !== name);
    this.saveArchive(this.charactersArchivePath, newArchived);

    console.log(`✅ 角色已恢复: ${name}`);
    return true;
  }

  getStats(): ArchiveStats {
    const chars = this.loadArchive(this.charactersArchivePath);
    const threads = this.loadArchive(this.plotThreadsArchivePath);
    const reviews = this.loadArchive(this.reviewsArchivePath);

    // Calculate archive file size
    let totalSize = 0;
    for (const path of [this.charactersArchivePath, this.plotThreadsArchivePath, this.reviewsArchivePath]) {
      if (existsSync(path)) {
        totalSize += statSync(path).size;
      }
    }

    // Get state.json size
    let stateSizeMb = 0;
    if (existsSync(this.statePath)) {
      stateSizeMb = statSync(this.statePath).size / (1024 * 1024);
    }

    return {
      charactersCount: chars.length,
      threadsCount: threads.length,
      reviewsCount: reviews.length,
      archiveSizeKb: totalSize / 1024,
      stateSizeMb,
    };
  }

  showStats(): void {
    const stats = this.getStats();

    console.log('📊 归档统计:');
    console.log(`   角色归档: ${stats.charactersCount}`);
    console.log(`   伏笔归档: ${stats.threadsCount}`);
    console.log(`   报告归档: ${stats.reviewsCount}`);
    console.log(`   归档大小: ${stats.archiveSizeKb.toFixed(2)} KB`);
    console.log(`\n💾 state.json 当前大小: ${stats.stateSizeMb.toFixed(2)} MB`);
  }
}
