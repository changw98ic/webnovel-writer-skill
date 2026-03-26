/**
 * Archive command - 数据归档管理
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { ArchiveManager } from '../utils/archive-manager.js';

export const archiveCommand = new Command('archive')
  .description('数据归档管理')
  .option('-p, --project-root <path>', '项目根目录');

// Auto-check subcommand
archiveCommand
  .command('auto')
  .description('自动归档检查')
  .option('-p, --project-root <path>', '项目根目录')
  .option('--force', '强制归档（忽略触发条件）')
  .option('--dry-run', '仅显示将被归档的数据')
  .action(async (options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());

      console.log(`🔍 归档检查...`);
      console.log(`   项目路径: ${projectRoot}\n`);

      const manager = new ArchiveManager(projectRoot);
      manager.runAutoCheck(options.force ?? false, options.dryRun ?? false);
    } catch (error) {
      console.error('❌ 归档失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Stats subcommand
archiveCommand
  .command('stats')
  .description('显示归档统计')
  .option('-p, --project-root <path>', '项目根目录')
  .action(async (options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());

      const manager = new ArchiveManager(projectRoot);
      manager.showStats();
    } catch (error) {
      console.error('❌ 获取统计失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Restore subcommand
archiveCommand
  .command('restore <name>')
  .description('恢复归档的角色')
  .option('-p, --project-root <path>', '项目根目录')
  .action(async (name: string, options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());

      console.log(`📤 恢复角色: ${name}...`);

      const manager = new ArchiveManager(projectRoot);
      const success = manager.restoreCharacter(name);

      if (!success) {
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ 恢复失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
