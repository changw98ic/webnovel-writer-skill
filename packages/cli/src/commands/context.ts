/**
 * Context command - 上下文管理
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { ContextExtractor } from '@webnovel-skill/data';

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

      const extractor = new ContextExtractor({ projectRoot });
      const context = await extractor.buildContext(chapter);

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
      const extractor = new ContextExtractor({ projectRoot });
      const stats = extractor.getStats();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log('📊 上下文统计:\n');
        console.log(`   当前章节: ${stats.currentChapter}`);
        console.log(`   已构建上下文: ${stats.builtContexts} 个`);
        console.log(`   缓存大小: ${stats.cacheSize}`);
        console.log(`   平均构建时间: ${stats.avgBuildTime}ms`);
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

      const extractor = new ContextExtractor({ projectRoot });
      const context = await extractor.buildContext(chapter);

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

  if (context.characters) {
    lines.push('【登场角色】');
    for (const char of context.characters as Array<Record<string, unknown>>) {
      lines.push(`- ${char.name}${char.role ? ` (${char.role})` : ''}`);
    }
    lines.push('');
  }

  if (context.locations) {
    lines.push('【场景地点】');
    for (const loc of context.locations as Array<Record<string, unknown>>) {
      lines.push(`- ${loc.name}`);
    }
    lines.push('');
  }

  if (context.previousEvents) {
    lines.push('【前情提要】');
    lines.push(context.previousEvents as string);
    lines.push('');
  }

  if (context.activeForeshadowing) {
    lines.push('【活跃伏笔】');
    for (const fs of context.activeForeshadowing as Array<Record<string, unknown>>) {
      lines.push(`- ${fs.name}: ${fs.description}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatAsMarkdown(context: Record<string, unknown>): string {
  const lines: string[] = ['# 章节上下文'];

  if (context.characters) {
    lines.push('\n## 登场角色');
    for (const char of context.characters as Array<Record<string, unknown>>) {
      lines.push(`- **${char.name}**${char.role ? ` (${char.role})` : ''}`);
    }
  }

  if (context.locations) {
    lines.push('\n## 场景地点');
    for (const loc of context.locations as Array<Record<string, unknown>>) {
      lines.push(`- ${loc.name}`);
    }
  }

  if (context.previousEvents) {
    lines.push('\n## 前情提要');
    lines.push(context.previousEvents as string);
  }

  if (context.activeForeshadowing) {
    lines.push('\n## 活跃伏笔');
    for (const fs of context.activeForeshadowing as Array<Record<string, unknown>>) {
      lines.push(`- **${fs.name}**: ${fs.description}`);
    }
  }

  return lines.join('\n');
}
