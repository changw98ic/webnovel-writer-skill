/**
 * Style command - 风格采样管理
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { StyleSampler } from '@webnovel-skill/data';

export const styleCommand = new Command('style')
  .description('风格采样管理');

// Sample subcommand
styleCommand
  .command('sample')
  .description('生成风格样本')
  .option('-p, --project-root <path>', '项目根目录')
  .option('-c, --chapter <number>', '源章节', (value) => parseInt(value, 10))
  .option('-o, --output <file>', '输出文件路径')
  .option('--json', 'JSON 格式输出')
  .action(async (options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());

      console.log(`🎨 生成风格样本...`);
      console.log(`   项目路径: ${projectRoot}`);

      const sampler = new StyleSampler({ projectRoot });
      const sample = await sampler.generateSample(options.chapter);

      if (options.json) {
        const output = JSON.stringify(sample, null, 2);
        if (options.output) {
          const fs = await import('fs/promises');
          await fs.writeFile(options.output, output, 'utf-8');
          console.log(`\n✅ 已保存到: ${options.output}`);
        } else {
          console.log(output);
        }
      } else {
        console.log('\n📝 风格样本:\n');
        console.log(`   对话风格: ${sample.dialogueStyle}`);
        console.log(`   描写密度: ${sample.descriptionDensity}`);
        console.log(`   节奏感: ${sample.pacing}`);
        console.log(`   常用词汇: ${sample.commonWords.slice(0, 10).join(', ')}`);
        console.log(`   句子长度分布: ${sample.sentenceLengthDist}`);

        if (options.output) {
          const fs = await import('fs/promises');
          await fs.writeFile(options.output, JSON.stringify(sample, null, 2), 'utf-8');
          console.log(`\n✅ 已保存到: ${options.output}`);
        }
      }
    } catch (error) {
      console.error('❌ 生成失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Analyze subcommand
styleCommand
  .command('analyze <chapter>')
  .description('分析章节风格')
  .option('-p, --project-root <path>', '项目根目录')
  .option('--json', 'JSON 格式输出')
  .action(async (chapterStr: string, options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const chapter = parseInt(chapterStr, 10);

      if (isNaN(chapter) || chapter < 1) {
        console.error('❌ 章节号必须是正整数');
        process.exit(1);
      }

      console.log(`🔍 分析第 ${chapter} 章风格...`);
      console.log(`   项目路径: ${projectRoot}`);

      const sampler = new StyleSampler({ projectRoot });
      const analysis = await sampler.analyzeChapter(chapter);

      if (options.json) {
        console.log(JSON.stringify(analysis, null, 2));
      } else {
        console.log('\n📊 风格分析:\n');
        console.log(`   平均句子长度: ${analysis.avgSentenceLength} 字`);
        console.log(`   对话占比: ${(analysis.dialogueRatio * 100).toFixed(1)}%`);
        console.log(`   描写占比: ${(analysis.descriptionRatio * 100).toFixed(1)}%`);
        console.log(`   情感倾向: ${analysis.emotionalTone}`);
        console.log(`   节奏评分: ${analysis.pacingScore}/10`);
      }
    } catch (error) {
      console.error('❌ 分析失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
