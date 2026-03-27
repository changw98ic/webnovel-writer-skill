/**
 * Backup command - Git 版本控制
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { BackupManager } from '../utils/backup-manager.js';

export const backupCommand = new Command('backup')
  .description('Git 版本控制操作')
  .option('-p, --project-root <path>', '项目根目录');

backupCommand
  .command('create <chapter>')
  .description('创建章节备份')
  .option('-m, --message <message>', '备份消息')
  .action(async (chapterStr: string, options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const chapter = parseInt(chapterStr, 10);

      if (isNaN(chapter) || chapter < 1) {
        console.error('❌ 章节号必须是正整数');
        process.exit(1);
      }

      const manager = new BackupManager(projectRoot);

      if (!manager.isAvailable()) {
        console.error('❌ Git 不可用，请确保已安装 Git 且项目已初始化');
        process.exit(1);
      }

      console.log(`📦 创建备份: 第 ${chapter} 章...`);
      const success = manager.createBackup(chapter, options.message);

      if (success) {
        console.log(`✅ 备份已创建`);
      } else {
        console.log(`⚠️ 备份创建失败`);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ 创建备份失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List backups subcommand
backupCommand
  .command('list')
  .description('列出所有备份')
  .option('-p, --project-root <path>', '项目根目录')
  .option('-l, --limit <number>', '限制数量', '20')
  .action(async (options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const limit = parseInt(options.limit, 10) || 20;

      const manager = new BackupManager(projectRoot);

      if (!manager.isAvailable()) {
        console.error('❌ Git 不可用');
        process.exit(1);
      }

      const backups = manager.listBackups().slice(0, limit);

      if (backups.length === 0) {
        console.log('📭 暂无备份');
        return;
      }

      console.log(`📋 备份列表 (共 ${backups.length} 个):\n`);

      for (const backup of backups) {
        const chapter = backup.chapter ?? '?';
        const date = new Date(backup.timestamp).toLocaleString('zh-CN');
        console.log(`  第 ${chapter} 章 | ${backup.tag} | ${date}`);
        console.log(`    ${backup.message}`);
        console.log('');
      }

      const current = manager.getCurrentVersion();
      if (current) {
        console.log(`📌 当前版本: ${current}`);
      }
    } catch (error) {
      console.error('❌ 列出备份失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Rollback subcommand
backupCommand
  .command('rollback <chapter>')
  .description('回滚到指定章节')
  .option('-p, --project-root <path>', '项目根目录')
  .option('--force', '强制回滚（丢弃未提交的更改）')
  .action(async (chapterStr: string, options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const chapter = parseInt(chapterStr, 10);

      if (isNaN(chapter) || chapter < 1) {
        console.error('❌ 章节号必须是正整数');
        process.exit(1);
      }

      const manager = new BackupManager(projectRoot);

      if (!manager.isAvailable()) {
        console.error('❌ Git 不可用');
        process.exit(1);
      }

      // Check for uncommitted changes
      if (manager.hasUncommittedChanges() && !options.force) {
        console.error('⚠️ 存在未提交的更改，请先提交或使用 --force 强制回滚');
        process.exit(1);
      }

      console.log(`⏪ 回滚到第 ${chapter} 章...`);
      const success = manager.rollback(chapter);

      if (success) {
        console.log(`✅ 已回滚到第 ${chapter} 章`);
      } else {
        console.log(`❌ 回滚失败`);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ 回滚失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Diff subcommand
backupCommand
  .command('diff <from> <to>')
  .description('比较两个版本之间的差异')
  .option('-p, --project-root <path>', '项目根目录')
  .action(async (fromStr: string, toStr: string, options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const fromChapter = parseInt(fromStr, 10);
      const toChapter = parseInt(toStr, 10);

      if (isNaN(fromChapter) || isNaN(toChapter)) {
        console.error('❌ 章节号必须是整数');
        process.exit(1);
      }

      const manager = new BackupManager(projectRoot);

      if (!manager.isAvailable()) {
        console.error('❌ Git 不可用');
        process.exit(1);
      }

      console.log(`🔍 比较第 ${fromChapter} 章与第 ${toChapter} 章...\n`);

      const result = manager.diff(fromChapter, toChapter);

      if (result) {
        console.log(result.summary);
      } else {
        console.log('❌ 无法获取差异');
      }
    } catch (error) {
      console.error('❌ 获取差异失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
