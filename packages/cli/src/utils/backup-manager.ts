/**
 * Git 备份管理器
 *
 * 迁移自 Python backup_manager.py
 * 使用 Git 进行版本控制：自动提交、原子回滚、版本历史
 */
import { spawnSync } from 'child_process';
import { sanitizeCommitMessage, isGitAvailable, isGitRepo } from './security.js';

// ============================================================================
// Types
// ============================================================================

export interface BackupInfo {
  commitHash: string;
  tag?: string;
  chapter?: number;
  message: string;
  timestamp: string;
  author: string;
}

export interface DiffResult {
  fromChapter: number;
  toChapter: number;
  files: Array<{
    path: string;
    additions: number;
    deletions: number;
  }>;
  summary: string;
}

// ============================================================================
// Backup Manager
// ============================================================================

export class BackupManager {
  private projectRoot: string;
  private gitAvailable: boolean;
  private isGitRepository: boolean;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.gitAvailable = isGitAvailable();
    this.isGitRepository = isGitRepo(projectRoot);

    if (!this.gitAvailable) {
      console.log('⚠️  Git 不可用，将使用本地备份模式');
      console.log('💡 如需启用 Git 版本控制，请安装 Git: https://git-scm.com/');
    }
  }

  // ==================== Git Operations ====================

  /**
   * 检查 Git 是否可用
   */
  isAvailable(): boolean {
    return this.gitAvailable && this.isGitRepository;
  }

  /**
   * 初始化 Git 仓库（如果不存在）
   */
  initRepo(): boolean {
    if (!this.gitAvailable) return false;
    if (this.isGitRepository) return true;

    const result = spawnSync('git', ['init'], {
      cwd: this.projectRoot,
      encoding: 'utf-8',
      windowsHide: true,
    });

    if (result.status === 0) {
      this.isGitRepository = true;
      console.log('✅ Git 仓库已初始化');
      return true;
    }

    console.error(`❌ Git init 失败: ${result.stderr}`);
    return false;
  }

  /**
   * 创建备份（git commit）
   */
  createBackup(chapter: number, message?: string): boolean {
    if (!this.isAvailable()) {
      console.log('⚠️ Git 不可用，跳过备份');
      return false;
    }

    const safeMessage = sanitizeCommitMessage(message ?? `Chapter ${chapter}`);
    const fullMessage = `Chapter ${chapter}: ${safeMessage}`;

    // Git add all
    const addResult = spawnSync('git', ['add', '.'], {
      cwd: this.projectRoot,
      encoding: 'utf-8',
      windowsHide: true,
    });

    if (addResult.status !== 0) {
      console.error(`❌ Git add 失败: ${addResult.stderr}`);
      return false;
    }

    // Git commit
    const commitResult = spawnSync('git', ['commit', '-m', fullMessage], {
      cwd: this.projectRoot,
      encoding: 'utf-8',
      windowsHide: true,
    });

    // "nothing to commit" is not an error
    if (commitResult.status !== 0 && !commitResult.stdout.includes('nothing to commit')) {
      console.error(`❌ Git commit 失败: ${commitResult.stderr}`);
      return false;
    }

    // Create tag
    const tagName = `ch${String(chapter).padStart(4, '0')}`;
    const tagResult = spawnSync('git', ['tag', '-a', tagName, '-m', `Chapter ${chapter} checkpoint`], {
      cwd: this.projectRoot,
      encoding: 'utf-8',
      windowsHide: true,
    });

    if (tagResult.status === 0 || tagResult.stderr?.includes('already exists')) {
      console.log(`✅ 备份已创建: ${tagName}`);
      return true;
    }

    console.warn(`⚠️ Tag 创建失败（备份仍有效）: ${tagResult.stderr}`);
    return true;
  }

  /**
   * 回滚到指定章节
   */
  rollback(chapter: number): boolean {
    if (!this.isAvailable()) {
      console.log('⚠️ Git 不可用，无法回滚');
      return false;
    }

    const tagName = `ch${String(chapter).padStart(4, '0')}`;

    // Check if tag exists
    const checkTag = spawnSync('git', ['tag', '-l', tagName], {
      cwd: this.projectRoot,
      encoding: 'utf-8',
      windowsHide: true,
    });

    if (!checkTag.stdout.trim()) {
      console.error(`❌ Tag ${tagName} 不存在`);
      return false;
    }

    // Reset to tag
    const result = spawnSync('git', ['reset', '--hard', tagName], {
      cwd: this.projectRoot,
      encoding: 'utf-8',
      windowsHide: true,
    });

    if (result.status === 0) {
      console.log(`✅ 已回滚到第 ${chapter} 章`);
      return true;
    }

    console.error(`❌ 回滚失败: ${result.stderr}`);
    return false;
  }

  /**
   * 查看差异
   */
  diff(fromChapter: number, toChapter: number): DiffResult | null {
    if (!this.isAvailable()) {
      console.log('⚠️ Git 不可用，无法对比');
      return null;
    }

    const fromTag = `ch${String(fromChapter).padStart(4, '0')}`;
    const toTag = `ch${String(toChapter).padStart(4, '0')}`;

    const result = spawnSync('git', ['diff', '--stat', fromTag, toTag], {
      cwd: this.projectRoot,
      encoding: 'utf-8',
      windowsHide: true,
    });

    if (result.status !== 0) {
      console.error(`❌ Diff 失败: ${result.stderr}`);
      return null;
    }

    return {
      fromChapter,
      toChapter,
      files: [], // Parse the stat output if needed
      summary: result.stdout,
    };
  }

  /**
   * 创建分支
   */
  createBranch(chapter: number, branchName: string): boolean {
    if (!this.isAvailable()) {
      console.log('⚠️ Git 不可用，无法创建分支');
      return false;
    }

    const tagName = `ch${String(chapter).padStart(4, '0')}`;

    const result = spawnSync('git', ['checkout', '-b', branchName, tagName], {
      cwd: this.projectRoot,
      encoding: 'utf-8',
      windowsHide: true,
    });

    if (result.status === 0) {
      console.log(`✅ 分支已创建: ${branchName} (基于 ${tagName})`);
      return true;
    }

    console.error(`❌ 分支创建失败: ${result.stderr}`);
    return false;
  }

  /**
   * 列出备份
   */
  listBackups(): BackupInfo[] {
    if (!this.isAvailable()) {
      return [];
    }

    // Get all chapter tags
    const tagResult = spawnSync('git', ['tag', '-l', 'ch*', '--sort=-creatordate'], {
      cwd: this.projectRoot,
      encoding: 'utf-8',
      windowsHide: true,
    });

    if (tagResult.status !== 0) {
      return [];
    }

    const tags = tagResult.stdout.trim().split('\n').filter(Boolean);
    const backups: BackupInfo[] = [];

    for (const tag of tags) {
      const chapter = parseInt(tag.replace('ch', ''), 10);

      // Get commit info for this tag
      const logResult = spawnSync('git', ['log', '-1', '--format=%H|%ci|%an|%s', tag], {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        windowsHide: true,
      });

      if (logResult.status === 0 && logResult.stdout.trim()) {
        const [hash, timestamp, author, message] = logResult.stdout.trim().split('|');
        backups.push({
          commitHash: hash,
          tag,
          chapter,
          message,
          timestamp,
          author,
        });
      }
    }

    return backups;
  }

  /**
   * 获取当前版本
   */
  getCurrentVersion(): string | null {
    if (!this.isAvailable()) {
      return null;
    }

    const result = spawnSync('git', ['describe', '--tags', '--abbrev=0'], {
      cwd: this.projectRoot,
      encoding: 'utf-8',
      windowsHide: true,
    });

    if (result.status === 0) {
      return result.stdout.trim();
    }

    return null;
  }

  /**
   * 获取当前分支
   */
  getCurrentBranch(): string | null {
    if (!this.isAvailable()) {
      return null;
    }

    const result = spawnSync('git', ['branch', '--show-current'], {
      cwd: this.projectRoot,
      encoding: 'utf-8',
      windowsHide: true,
    });

    if (result.status === 0) {
      return result.stdout.trim() || 'HEAD';
    }

    return null;
  }

  /**
   * 检查是否有未提交的更改
   */
  hasUncommittedChanges(): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    const result = spawnSync('git', ['status', '--porcelain'], {
      cwd: this.projectRoot,
      encoding: 'utf-8',
      windowsHide: true,
    });

    return result.status === 0 && result.stdout.trim().length > 0;
  }
}
