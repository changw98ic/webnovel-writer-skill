/**
 * Context command - 上下文管理
 *
 * 注意：ContextExtractor 尚未在 @changw98ic/data 中实现
 * 当前为占位实现
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { StateManager, IndexManager } from '@changw98ic/data';

export const contextCommand = new Command('context')
  .description('上下文管理');

// Build subcommand
contextCommand
  .command('build <chapter>')
  .description('构建章节上下文')
  .option('-p, --project-root <path>', '项目根目录')
  .option('-o, --output <file>', '输出文件路径')
  .option('--format <format>', '输出格式 (text|json|markdown)', 'text')
  .action(async (chapterStr: string, options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const chapter = parseInt(chapterStr, 10);

      if (isNaN(chapter) || chapter < 1) {
        console.error('❌ 章节号必须是正整数');
        process.exit(1);
      }

      console.log(`🔨 构建第 ${chapter} 章上下文...`);
      console.log(`   项目路径: ${projectRoot}`);

      // 使用现有的 StateManager 和 IndexManager 构建简化上下文
      const stateManager = new StateManager({ projectRoot });
      const indexManager = new IndexManager({ projectRoot });

      const state = await stateManager.loadState();
      const entities = indexManager.getCoreEntities();

      const context = {
        chapter,
        progress: state.progress,
        coreEntities: entities.map(e => ({
          id: e.id,
          name: e.canonical_name,
          type: e.type,
          tier: e.tier,
        })),
        activeForeshadowing: state.plot_threads?.foreshadowing ?? [],
      };

      indexManager.close();

      let output: string;
      switch (options.format) {
        case 'json':
          output = JSON.stringify(context, null, 2);
          break;
        case 'markdown':
          output = formatAsMarkdown(context);
          break;
        default:
          output = formatAsText(context);
      }

      if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, output, 'utf-8');
        console.log(`\n✅ 已保存到: ${options.output}`);
      } else {
        console.log('\n' + output);
      }
    } catch (error) {
      console.error('❌ 构建失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Stats subcommand
contextCommand
  .command('stats')
  .description('显示上下文统计')
  .option('-p, --project-root <path>', '项目根目录')
  .option('--json', 'JSON 格式输出')
  .action(async (options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const stateManager = new StateManager({ projectRoot });
      const indexManager = new IndexManager({ projectRoot });

      const state = await stateManager.loadState();
      const entityStats = indexManager.getStats();

      const stats = {
        currentChapter: state.progress?.current_chapter ?? 1,
        totalEntities: entityStats.totalEntities,
        entityByType: entityStats.byType,
        foreshadowingCount: state.plot_threads?.foreshadowing?.length ?? 0,
      };

      indexManager.close();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log('📊 上下文统计:\n');
        console.log(`   当前章节: ${stats.currentChapter}`);
        console.log(`   实体总数: ${stats.totalEntities}`);
        console.log(`   活跃伏笔: ${stats.foreshadowingCount}`);
      }
    } catch (error) {
      console.error('❌ 获取统计失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Extract subcommand (alias for build)
contextCommand
  .command('extract <chapter>')
  .description('提取章节上下文（build 的别名）')
  .option('-p, --project-root <path>', '项目根目录')
  .option('-o, --output <file>', '输出文件路径')
  .option('--format <format>', '输出格式 (text|json|markdown)', 'text')
  .action(async (chapterStr: string, options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const chapter = parseInt(chapterStr, 10);

      if (isNaN(chapter) || chapter < 1) {
        console.error('❌ 章节号必须是正整数');
        process.exit(1);
      }

      const stateManager = new StateManager({ projectRoot });
      const indexManager = new IndexManager({ projectRoot });

      const state = await stateManager.loadState();
      const entities = indexManager.getCoreEntities();

      const context = {
        chapter,
        progress: state.progress,
        coreEntities: entities.map(e => ({
          id: e.id,
          name: e.canonical_name,
          type: e.type,
          tier: e.tier,
        })),
        activeForeshadowing: state.plot_threads?.foreshadowing ?? [],
      };

      indexManager.close();

      let output: string;
      switch (options.format) {
        case 'json':
          output = JSON.stringify(context, null, 2);
          break;
        case 'markdown':
          output = formatAsMarkdown(context);
          break;
        default:
          output = formatAsText(context);
      }

      if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, output, 'utf-8');
        console.log(`✅ 已保存到: ${options.output}`);
      } else {
        console.log(output);
      }
    } catch (error) {
      console.error('❌ 提取失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Helper functions
function formatAsText(context: Record<string, unknown>): string {
  const lines: string[] = [];

  if (context.coreEntities) {
    lines.push('【核心实体】');
    for (const entity of context.coreEntities as Array<Record<string, unknown>>) {
      lines.push(`- [${entity.type}] ${entity.name} (${entity.tier})`);
    }
    lines.push('');
  }

  if (context.activeForeshadowing) {
    const foreshadowing = context.activeForeshadowing as Array<Record<string, unknown>>;
    if (foreshadowing.length > 0) {
      lines.push('【活跃伏笔】');
      for (const fs of foreshadowing) {
        lines.push(`- ${fs.name || fs.id}: ${fs.description || ''}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function formatAsMarkdown(context: Record<string, unknown>): string {
  const lines: string[] = ['# 章节上下文'];

  if (context.coreEntities) {
    lines.push('\n## 核心实体');
    for (const entity of context.coreEntities as Array<Record<string, unknown>>) {
      lines.push(`- **${entity.name}** [${entity.type}] (${entity.tier})`);
    }
  }

  if (context.activeForeshadowing) {
    const foreshadowing = context.activeForeshadowing as Array<Record<string, unknown>>;
    if (foreshadowing.length > 0) {
      lines.push('\n## 活跃伏笔');
      for (const fs of foreshadowing) {
        lines.push(`- **${fs.name || fs.id}**: ${fs.description || ''}`);
      }
    }
  }

  return lines.join('\n');
}
