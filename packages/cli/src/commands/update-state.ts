/**
 * Update-state command - 更新项目状态
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { StateManager } from '@changw98ic/data';
import { readFileSync } from 'fs';

export const updateStateCommand = new Command('update-state')
  .description('更新项目状态')
  .option('-p, --project-root <path>', '项目根目录')
  .option('--chapter <number>', '更新当前进度到指定章节', (value) => parseInt(value, 10))
  .option('--target-words <number>', '设置目标字数', (value) => parseInt(value, 10))
  .option('--set <json>', '直接设置状态字段 (JSON 格式)')
  .option('--set-file <path>', '从 JSON 文件设置状态')
  .option('--dry-run', '仅显示将执行的操作')
  .action(async (options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());

      console.log('📝 更新项目状态...');
      console.log(`   项目路径: ${projectRoot}`);

      const manager = new StateManager({ projectRoot });
      const state = await manager.loadState();

      const updates: Record<string, unknown> = {};

      // Handle chapter update
      if (options.chapter !== undefined) {
        if (options.chapter < 1) {
          console.error('❌ 章节号必须是正整数');
          process.exit(1);
        }
        updates.progress = {
          ...state.progress,
          current_chapter: options.chapter,
        };
        console.log(`   更新进度: 第 ${options.chapter} 章`);
      }

      // Handle target words update
      if (options.targetWords !== undefined) {
        if (options.targetWords < 1000) {
          console.error('❌ 目标字数不能少于 1000');
          process.exit(1);
        }
        updates.target_words = options.targetWords;
        console.log(`   目标字数: ${options.targetWords.toLocaleString()}`);
      }

      // Handle direct JSON set
      if (options.set) {
        try {
          const setData = JSON.parse(options.set);
          Object.assign(updates, setData);
          console.log(`   直接设置: ${options.set}`);
        } catch {
          console.error('❌ 无效的 JSON 格式');
          process.exit(1);
        }
      }

      // Handle file-based set
      if (options.setFile) {
        try {
          const content = readFileSync(options.setFile, 'utf-8');
          const setData = JSON.parse(content);
          Object.assign(updates, setData);
          console.log(`   从文件设置: ${options.setFile}`);
        } catch (e) {
          console.error('❌ 读取文件失败:', e instanceof Error ? e.message : e);
          process.exit(1);
        }
      }

      if (Object.keys(updates).length === 0) {
        console.log('\n⚠️ 没有指定任何更新');
        process.exit(0);
      }

      if (options.dryRun) {
        console.log('\n📋 将执行以下更新:');
        console.log(JSON.stringify(updates, null, 2));
        process.exit(0);
      }

      // Apply updates using updateState with updater function
      await manager.updateState((currentState) => ({
        ...currentState,
        ...updates,
        progress: updates.progress ? { ...currentState.progress, ...(updates.progress as object) } : currentState.progress,
      }));

      console.log('\n✅ 状态已更新');
    } catch (error) {
      console.error('❌ 更新失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
