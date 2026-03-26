/**
 * Extract-context command - 提取章节上下文
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { ContextExtractor } from '@webnovel-skill/data';
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

      const extractor = new ContextExtractor({ projectRoot });

      const extractOptions = {
        includeEntities: options.includeEntities ?? false,
        includeForeshadowing: options.includeForeshadowing ?? false,
        maxChars: options.maxChars,
      };

      const context = await extractor.buildContext(chapter, extractOptions);

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
    lines.push('\n[登场角色]');
    for (const char of context.characters as Array<Record<string, unknown>>) {
      lines.push(`- ${char.name}${char.role ? ` (${char.role})` : ''}`);
    }
  }

  if (context.locations && Array.isArray(context.locations) && context.locations.length > 0) {
    lines.push('\n[场景地点]');
    for (const loc of context.locations as string[]) {
      lines.push(`- ${loc}`);
    }
  }

  if (context.previousEvents) {
    lines.push('\n[前情提要]');
    lines.push(String(context.previousEvents));
  }

  if (context.activeForeshadowing && Array.isArray(context.activeForeshadowing) && context.activeForeshadowing.length > 0) {
    lines.push('\n[活跃伏笔]');
    for (const fs of context.activeForeshadowing as Array<Record<string, unknown>>) {
      lines.push(`- ${fs.name}: ${fs.description}`);
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
    lines.push('## 登场角色\n');
    for (const char of context.characters as Array<Record<string, unknown>>) {
      lines.push(`- **${char.name}**${char.role ? ` (${char.role})` : ''}`);
    }
    lines.push('');
  }

  if (context.locations && Array.isArray(context.locations) && context.locations.length > 0) {
    lines.push('## 场景地点\n');
    for (const loc of context.locations as string[]) {
      lines.push(`- ${loc}`);
    }
    lines.push('');
  }

  if (context.previousEvents) {
    lines.push('## 前情提要\n');
    lines.push(String(context.previousEvents));
    lines.push('');
  }

  if (context.activeForeshadowing && Array.isArray(context.activeForeshadowing) && context.activeForeshadowing.length > 0) {
    lines.push('## 活跃伏笔\n');
    for (const fs of context.activeForeshadowing as Array<Record<string, unknown>>) {
      lines.push(`- **${fs.name}**: ${fs.description}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
