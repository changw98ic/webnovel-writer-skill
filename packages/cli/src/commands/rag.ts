/**
 * RAG command - 向量检索管理
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { RAGAdapter, StateManager } from '@changw98ic/data';

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
      const adapter = new RAGAdapter({ projectRoot });
      const ragStats = adapter.getStats();

      const stateManager = new StateManager({ projectRoot });
      let currentChapter = 1;
      try {
        const state = await stateManager.loadState();
        currentChapter = state.progress?.current_chapter ?? 1;
      } catch {
        // state.json 可能不存在
      }

      const stats = {
        totalVectors: ragStats.totalChunks,
        byType: ragStats.byType,
        indexedChapters: Object.keys(ragStats.byType).length > 0 ? `最多到第 ${currentChapter} 章` : '无',
        embedModel: process.env.EMBED_MODEL || '未配置',
        lastUpdated: new Date().toISOString(),
      };

      adapter.close();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log('📊 RAG 统计:\n');
        console.log(`   总向量块数: ${stats.totalVectors}`);
        console.log(`   已索引章节: ${stats.indexedChapters}`);
        console.log(`   嵌入模型: ${stats.embedModel}`);
      }
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
      console.log('\n   ⚠️ 完整索引需要读取章节文件和场景切分');
      console.log('   当前仅支持手动提供摘要和场景');

      // 注意：RAGAdapter.indexChapter 需要 summary 和 scenes 参数
      // 完整实现需要读取章节文件并提取场景
      console.log('\n✅ 命令已接收，请使用 API 或等待完整实现');
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
  .option('--chapter <number>', '限定章节范围（当前未实现）', (value) => parseInt(value, 10))
  .action(async (query: string, options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());

      console.log(`🔍 搜索: "${query}"`);
      console.log(`   项目路径: ${projectRoot}`);

      const adapter = new RAGAdapter({ projectRoot });
      const results = await adapter.search(query, options.topK);

      adapter.close();

      if (results.length === 0) {
        console.log('\n   未找到匹配结果');
        return;
      }

      console.log(`\n   找到 ${results.length} 个结果:\n`);
      for (const result of results) {
        console.log(`   [${result.id}] (score: ${result.score.toFixed(3)}, source: ${result.source})`);
        console.log(`   ${result.content.slice(0, 100)}${result.content.length > 100 ? '...' : ''}`);
        if (result.chapter) {
          console.log(`   章节: ${result.chapter}`);
        }
        console.log();
      }
    } catch (error) {
      console.error('❌ 搜索失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
