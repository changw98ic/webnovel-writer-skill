/**
 * Extract-context command - 提取章节上下文
 *
 * 注意：ContextExtractor 尚未在 @changw98ic/data 中实现
 * 当前使用 StateManager 和 IndexManager 提供简化实现
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { StateManager, IndexManager } from '@changw98ic/data';
import { writeFileSync } from 'fs';

export const extractContextCommand = new Command('extract-context')
  .description('提取章节上下文')
  .argument('<chapter>', '章节号', (value) => parseInt(value, 10))
  .option('-p, --project-root <path>', '项目根目录')
  .option('-o, --output <file>', '输出文件路径')
  .option('--format <format>', '输出格式 (text|json|markdown)', 'text')
  .option('--include-entities', '包含实体详情')
  .option('--include-foreshadowing', '包含伏笔信息')
  .option('--max-chars <number>', '最大字符数', (value) => parseInt(value, 10))
  .action(async (chapter: number, options) => {
    try {
      if (isNaN(chapter) || chapter < 1) {
        console.error('❌ 章节号必须是正整数');
        process.exit(1);
      }

      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());

      console.log(`📖 提取第 ${chapter} 章上下文...`);
      console.log(`   项目路径: ${projectRoot}`);

      // 使用 StateManager 和 IndexManager 构建上下文
      const stateManager = new StateManager({ projectRoot });
      const indexManager = new IndexManager({ projectRoot });

      const state = await stateManager.loadState();
      const coreEntities = options.includeEntities
        ? indexManager.getCoreEntities()
        : [];
      const recentAppearances = indexManager.getRecentAppearances(10);

      indexManager.close();

      const context: Record<string, unknown> = {
        chapter,
        progress: state.progress,
        characters: coreEntities.map(e => ({
          id: e.id,
          name: e.canonical_name,
          type: e.type,
          tier: e.tier,
        })),
        recentEntities: recentAppearances,
      };

      if (options.includeForeshadowing) {
        context.activeForeshadowing = state.plot_threads?.foreshadowing ?? [];
      }

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

      // 如果有 maxChars 限制，截断输出
      if (options.maxChars && output.length > options.maxChars) {
        output = output.slice(0, options.maxChars) + '\n... (已截断)';
      }

      if (options.output) {
        writeFileSync(options.output, output, 'utf-8');
        console.log(`\n✅ 已保存到: ${options.output}`);
      } else {
        console.log('\n' + output);
      }
    } catch (error) {
      console.error('❌ 提取失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

function formatAsText(context: Record<string, unknown>): string {
  const lines: string[] = [];

  lines.push('=== 章节上下文 ===\n');

  if (context.chapter) {
    lines.push(`章节: ${context.chapter}`);
  }

  if (context.characters && Array.isArray(context.characters) && context.characters.length > 0) {
    lines.push('\n[核心实体]');
    for (const char of context.characters as Array<Record<string, unknown>>) {
      lines.push(`- [${char.type}] ${char.name} (${char.tier})`);
    }
  }

  if (context.recentEntities && Array.isArray(context.recentEntities) && context.recentEntities.length > 0) {
    lines.push('\n[最近出场]');
    for (const entity of context.recentEntities as Array<{ entity_id: string; last_appearance: number }>) {
      lines.push(`- ${entity.entity_id} (第 ${entity.last_appearance} 章)`);
    }
  }

  if (context.activeForeshadowing && Array.isArray(context.activeForeshadowing) && context.activeForeshadowing.length > 0) {
    lines.push('\n[活跃伏笔]');
    for (const fs of context.activeForeshadowing as Array<Record<string, unknown>>) {
      lines.push(`- ${fs.name || fs.id}: ${fs.description || ''}`);
    }
  }

  return lines.join('\n');
}

function formatAsMarkdown(context: Record<string, unknown>): string {
  const lines: string[] = [];

  lines.push('# 章节上下文\n');

  if (context.chapter) {
    lines.push(`**章节**: ${context.chapter}\n`);
  }

  if (context.characters && Array.isArray(context.characters) && context.characters.length > 0) {
    lines.push('## 核心实体\n');
    for (const char of context.characters as Array<Record<string, unknown>>) {
      lines.push(`- **${char.name}** [${char.type}] (${char.tier})`);
    }
    lines.push('');
  }

  if (context.recentEntities && Array.isArray(context.recentEntities) && context.recentEntities.length > 0) {
    lines.push('## 最近出场\n');
    for (const entity of context.recentEntities as Array<{ entity_id: string; last_appearance: number }>) {
      lines.push(`- ${entity.entity_id} (第 ${entity.last_appearance} 章)`);
    }
    lines.push('');
  }

  if (context.activeForeshadowing && Array.isArray(context.activeForeshadowing) && context.activeForeshadowing.length > 0) {
    lines.push('## 活跃伏笔\n');
    for (const fs of context.activeForeshadowing as Array<Record<string, unknown>>) {
      lines.push(`- **${fs.name || fs.id}**: ${fs.description || ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
