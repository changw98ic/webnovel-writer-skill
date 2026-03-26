/**
 * State command - 状态管理
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { StateManager } from '@webnovel-skill/data';

export const stateCommand = new Command('state')
  .description('状态管理');

// Stats subcommand
stateCommand
  .command('stats')
  .description('显示状态统计')
  .option('-p, --project-root <path>', '项目根目录')
  .option('--json', 'JSON 格式输出')
  .action(async (options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const manager = new StateManager({ projectRoot });
      const state = manager.getState();

      const stats = {
        progress: state.progress,
        targetWords: state.target_words,
        genreProfile: state.genre_profile ? Object.keys(state.genre_profile).length : 0,
        foreshadowingCount: state.plot_threads?.foreshadowing?.length ?? 0,
        reviewCheckpoints: state.review_checkpoints?.length ?? 0,
      };

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log('📊 状态统计:\n');
        console.log(`   当前进度: 第 ${stats.progress?.current_chapter ?? 0} 章`);
        console.log(`   目标字数: ${stats.targetWords?.toLocaleString() ?? '未设置'}`);
        console.log(`   题材配置项: ${stats.genreProfile}`);
        console.log(`   伏笔数: ${stats.foreshadowingCount}`);
        console.log(`   审查检查点: ${stats.reviewCheckpoints}`);
      }
    } catch (error) {
      console.error('❌ 获取统计失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Process chapter subcommand
stateCommand
  .command('process-chapter')
  .description('处理章节状态更新')
  .requiredOption('-c, --chapter <number>', '章节号', (value) => parseInt(value, 10))
  .option('-p, --project-root <path>', '项目根目录')
  .option('--data <json>', 'JSON 数据（或使用 @file 读取文件）')
  .action(async (options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      console.log(`📝 处理第 ${options.chapter} 章状态更新...`);
      console.log(`   项目路径: ${projectRoot}`);
      console.log('\n   ⚠️ 此命令需要完整实现 Data Agent 集成');

      console.log('\n✅ 处理完成');
    } catch (error) {
      console.error('❌ 处理失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
