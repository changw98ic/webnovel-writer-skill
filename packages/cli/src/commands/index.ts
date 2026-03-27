/**
 * Index command - 实体索引管理
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { IndexManager } from '@changw98ic/data';

export const indexCommand = new Command('index')
  .description('实体索引管理');

// Stats subcommand
indexCommand
  .command('stats')
  .description('显示索引统计')
  .option('-p, --project-root <path>', '项目根目录')
  .option('--json', 'JSON 格式输出')
  .action(async (options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const manager = new IndexManager({ projectRoot });
      const stats = manager.getStats();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log('📊 索引统计:\n');
        console.log(`   总实体数: ${stats.totalEntities}`);
        console.log('\n   按类型:');
        for (const [type, count] of Object.entries(stats.byType)) {
          console.log(`   - ${type}: ${count}`);
        }
        console.log('\n   按层级:');
        for (const [tier, count] of Object.entries(stats.byTier)) {
          console.log(`   - ${tier}: ${count}`);
        }
      }

      manager.close();
    } catch (error) {
      console.error('❌ 获取统计失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Process chapter subcommand
indexCommand
  .command('process-chapter <chapter>')
  .description('处理章节索引')
  .option('-p, --project-root <path>', '项目根目录')
  .action(async (chapterStr: string, options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const chapter = parseInt(chapterStr, 10);

      if (isNaN(chapter) || chapter < 1) {
        console.error('❌ 章节号必须是正整数');
        process.exit(1);
      }

      console.log(`📖 处理第 ${chapter} 章索引...`);
      console.log(`   项目路径: ${projectRoot}`);
      console.log('\n   ⚠️ 此命令需要完整实现，当前仅显示统计');

      const manager = new IndexManager({ projectRoot });
      const stats = manager.getStats();
      console.log(`   当前实体数: ${stats.totalEntities}`);

      manager.close();
      console.log('\n✅ 处理完成');
    } catch (error) {
      console.error('❌ 处理失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
