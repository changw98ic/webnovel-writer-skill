/**
 * Status command - 生成健康报告
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { StatusReporter } from '../utils/status-reporter.js';

export const statusCommand = new Command('status')
  .description('生成项目健康报告')
  .option('-f, --focus <type>', '报告焦点 (characters|foreshadowing|pacing|all)', 'all')
  .option('-o, --output <file>', '输出文件路径')
  .option('--json', 'JSON 格式输出')
  .action(async (options) => {
    try {
      const projectRoot = resolveProjectRoot(process.cwd());

      console.log(`📊 生成健康报告...`);
      console.log(`   项目路径: ${projectRoot}`);

      const reporter = new StatusReporter(projectRoot);
      const report = reporter.generateHealthReport({
        focus: options.focus as 'characters' | 'foreshadowing' | 'pacing' | 'all',
      });

      if (options.json) {
        const output = JSON.stringify(report, null, 2);
        if (options.output) {
          const { writeFileSync } = await import('fs');
          writeFileSync(options.output, output, 'utf-8');
          console.log(`\n✅ 报告已保存: ${options.output}`);
        } else {
          console.log(output);
        }
      } else {
        const markdown = reporter.formatAsMarkdown(report);
        if (options.output) {
          const { writeFileSync } = await import('fs');
          writeFileSync(options.output, markdown, 'utf-8');
          console.log(`\n✅ 报告已保存: ${options.output}`);
        } else {
          console.log('\n' + markdown);
        }
      }
    } catch (error) {
      console.error('❌ 生成报告失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
