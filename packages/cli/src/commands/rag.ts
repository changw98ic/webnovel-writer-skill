/**
 * RAG command - 向量检索管理
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { RAGManager } from '@webnovel-skill/data';

export const ragCommand = new Command('rag')
  .description('向量检索管理');

// Stats subcommand
ragCommand
  .command('stats')
  .description('显示 RAG 统计')
  .option('-p, --project-root <path>', '项目根目录')
  .option('--json', 'JSON 格式输出')
  .action(async (options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const manager = new RAGManager({ projectRoot });
      const stats = manager.getStats();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log('📊 RAG 统计:\n');
        console.log(`   总向量数: ${stats.totalVectors}`);
        console.log(`   已索引章节: ${stats.indexedChapters.join(', ') || '无'}`);
        console.log(`   嵌入模型: ${stats.embedModel || '未配置'}`);
        console.log(`   最后更新: ${stats.lastUpdated || '从未'}`);
      }

      manager.close();
    } catch (error) {
      console.error('❌ 获取统计失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Index chapter subcommand
ragCommand
  .command('index-chapter <chapter>')
  .description('索引章节向量')
  .option('-p, --project-root <path>', '项目根目录')
  .option('--force', '强制重新索引')
  .action(async (chapterStr: string, options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const chapter = parseInt(chapterStr, 10);

      if (isNaN(chapter) || chapter < 1) {
        console.error('❌ 章节号必须是正整数');
        process.exit(1);
      }

      console.log(`🔍 索引第 ${chapter} 章向量...`);
      console.log(`   项目路径: ${projectRoot}`);

      const manager = new RAGManager({ projectRoot });
      await manager.indexChapter(chapter, options.force ?? false);

      manager.close();
      console.log('\n✅ 索引完成');
    } catch (error) {
      console.error('❌ 索引失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Search subcommand
ragCommand
  .command('search <query>')
  .description('语义搜索')
  .option('-p, --project-root <path>', '项目根目录')
  .option('-k, --top-k <number>', '返回结果数', (value) => parseInt(value, 10), 5)
  .option('--chapter <number>', '限定章节范围', (value) => parseInt(value, 10))
  .action(async (query: string, options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());

      console.log(`🔍 搜索: "${query}"`);
      console.log(`   项目路径: ${projectRoot}`);

      const manager = new RAGManager({ projectRoot });
      const results = await manager.search(query, {
        topK: options.topK,
        chapterFilter: options.chapter,
      });

      manager.close();

      if (results.length === 0) {
        console.log('\n   未找到匹配结果');
        return;
      }

      console.log(`\n   找到 ${results.length} 个结果:\n`);
      for (const result of results) {
        console.log(`   [${result.chunkId}] (score: ${result.score.toFixed(3)})`);
        console.log(`   ${result.content.slice(0, 100)}...`);
        console.log();
      }
    } catch (error) {
      console.error('❌ 搜索失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
