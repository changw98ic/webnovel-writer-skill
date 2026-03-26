/**
 * Workflow command - 工作流管理
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { StateManager, IndexManager } from '@webnovel-skill/data';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

export const workflowCommand = new Command('workflow')
  .description('工作流管理');

// Health check subcommand
workflowCommand
  .command('health-check')
  .description('检查项目健康状态')
  .option('-p, --project-root <path>', '项目根目录')
  .option('--json', 'JSON 格式输出')
  .action(async (options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());

      console.log('🏥 项目健康检查...\n');
      console.log(`   项目路径: ${projectRoot}\n`);

      const checks: Array<{ name: string; status: string; detail: string }> = [];

      // Check 1: .webnovel directory
      const webnovelDir = join(projectRoot, '.webnovel');
      if (existsSync(webnovelDir) && statSync(webnovelDir).isDirectory()) {
        checks.push({ name: '数据目录', status: '✅', detail: '.webnovel 存在' });
      } else {
        checks.push({ name: '数据目录', status: '❌', detail: '.webnovel 不存在' });
      }

      // Check 2: state.json
      const statePath = join(webnovelDir, 'state.json');
      if (existsSync(statePath)) {
        try {
          const stateManager = new StateManager({ projectRoot });
          const state = stateManager.getState();
          checks.push({ name: '状态文件', status: '✅', detail: `第 ${state.progress?.current_chapter ?? 0} 章` });
        } catch (e) {
          checks.push({ name: '状态文件', status: '⚠️', detail: `解析失败: ${e instanceof Error ? e.message : e}` });
        }
      } else {
        checks.push({ name: '状态文件', status: '❌', detail: 'state.json 不存在' });
      }

      // Check 3: index.db
      const indexPath = join(webnovelDir, 'index.db');
      if (existsSync(indexPath)) {
        try {
          const indexManager = new IndexManager({ projectRoot });
          const stats = indexManager.getStats();
          indexManager.close();
          checks.push({ name: '实体索引', status: '✅', detail: `${stats.totalEntities} 个实体` });
        } catch (e) {
          checks.push({ name: '实体索引', status: '⚠️', detail: `读取失败: ${e instanceof Error ? e.message : e}` });
        }
      } else {
        checks.push({ name: '实体索引', status: '⚠️', detail: 'index.db 不存在' });
      }

      // Check 4: directories structure
      const bodyDir = join(projectRoot, '正文');
      const outlineDir = join(projectRoot, '大纲');
      const settingsDir = join(projectRoot, '设定集');

      if (existsSync(bodyDir)) {
        checks.push({ name: '正文目录', status: '✅', detail: '存在' });
      } else {
        checks.push({ name: '正文目录', status: '⚠️', detail: '不存在（需要创建）' });
      }

      if (existsSync(outlineDir)) {
        checks.push({ name: '大纲目录', status: '✅', detail: '存在' });
      } else {
        checks.push({ name: '大纲目录', status: '⚠️', detail: '不存在（需要创建）' });
      }

      if (existsSync(settingsDir)) {
        checks.push({ name: '设定集目录', status: '✅', detail: '存在' });
      } else {
        checks.push({ name: '设定集目录', status: '⚠️', detail: '不存在（需要创建）' });
      }

      // Output results
      if (options.json) {
        console.log(JSON.stringify({
          projectRoot,
          checks: checks.map(c => ({
            name: c.name,
            status: c.status === '✅' ? 'ok' : c.status === '⚠️' ? 'warning' : 'error',
            detail: c.detail
          }))
        }, null, 2));
      } else {
        console.log('检查结果:\n');
        for (const check of checks) {
          console.log(`   ${check.status} ${check.name}: ${check.detail}`);
        }

        const errors = checks.filter(c => c.status === '❌').length;
        const warnings = checks.filter(c => c.status === '⚠️').length;

        console.log(`\n汇总: ${errors} 个错误, ${warnings} 个警告`);

        if (errors > 0) {
          process.exit(1);
        }
      }
    } catch (error) {
      console.error('❌ 检查失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Validate subcommand
workflowCommand
  .command('validate')
  .description('验证项目结构完整性')
  .option('-p, --project-root <path>', '项目根目录')
  .action(async (options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());

      console.log('🔍 验证项目结构...\n');

      const stateManager = new StateManager({ projectRoot });
      const indexManager = new IndexManager({ projectRoot });

      // Validate state consistency
      const state = stateManager.getState();
      const indexStats = indexManager.getStats();

      const issues: string[] = [];

      // Check chapter progress vs indexed entities
      const currentChapter = state.progress?.current_chapter ?? 1;
      if (indexStats.totalEntities === 0 && currentChapter > 1) {
        issues.push(`已写 ${currentChapter} 章但实体索引为空`);
      }

      // Check foreshadowing threads
      const foreshadowing = state.plot_threads?.foreshadowing ?? [];
      const resolvedThreads = state.plot_threads?.resolved ?? [];
      if (foreshadowing.length > 10) {
        issues.push(`活跃伏笔过多 (${foreshadowing.length} 个)，建议处理部分`);
      }

      indexManager.close();

      if (issues.length === 0) {
        console.log('✅ 项目结构验证通过');
      } else {
        console.log('⚠️ 发现以下问题:\n');
        for (const issue of issues) {
          console.log(`   - ${issue}`);
        }
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ 验证失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
