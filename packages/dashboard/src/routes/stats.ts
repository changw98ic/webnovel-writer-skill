/**
 * Stats Routes - 统计信息 API
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { StateManager, IndexManager, RAGAdapter } from '@changw98ic/data';

interface StatsRoutesOptions {
  projectRoot: string;
}

export const statsRoutes: FastifyPluginAsync<StatsRoutesOptions> = async (fastify, options) => {
  const { projectRoot } = options;

  // 获取项目概览统计
  fastify.get('/overview', async (_request, reply: FastifyReply) => {
    const stateManager = new StateManager({ projectRoot });
    const indexManager = new IndexManager({ projectRoot });

    if (!stateManager.exists()) {
      return reply.code(404).send({ error: 'Project not initialized' });
    }

    const state = await stateManager.loadState();
    const entityStats = indexManager.getStats();

    return {
      project: {
        title: state.project_info.title,
        genre: state.project_info.genre,
        target_words: state.project_info.target_words,
        target_chapters: state.project_info.target_chapters,
      },
      progress: {
        current_chapter: state.progress.current_chapter,
        total_words: state.progress.total_words,
        completed_chapters: state.progress.completed_chapters || 0,
        progress_percent: state.project_info.target_chapters
          ? Math.round((state.progress.current_chapter / state.project_info.target_chapters) * 100)
          : 0,
      },
      entities: {
        total: entityStats.totalEntities,
        by_type: entityStats.byType,
        by_tier: entityStats.byTier,
      },
      plot_threads: {
        foreshadowing: state.plot_threads?.foreshadowing?.length || 0,
        active_foreshadowing: state.plot_threads?.foreshadowing?.filter((f: any) => f.status === 'active').length || 0,
        active_conflicts: state.plot_threads?.active_conflicts?.length || 0,
        unresolved_questions: state.plot_threads?.unresolved_questions?.length || 0,
      },
      strand_tracker: {
        quest_consecutive: state.strand_tracker?.quest_consecutive || 0,
        fire_gap: state.strand_tracker?.fire_gap || 0,
        constellation_gap: state.strand_tracker?.constellation_gap || 0,
      },
    };
  });

  // 获取实体统计
  fastify.get('/entities', async (_request, _reply) => {
    const indexManager = new IndexManager({ projectRoot });
    const stats = indexManager.getStats();

    return {
      total: stats.totalEntities,
      by_type: stats.byType,
      by_tier: stats.byTier,
    };
  });

  // 获取 RAG 索引统计
  fastify.get('/rag', async (_request, _reply) => {
    try {
      const ragAdapter = new RAGAdapter({ projectRoot });
      const indexManager = new IndexManager({ projectRoot });
      const stats = ragAdapter.getStats();
      const queryMetrics = indexManager.getRagQuerySummary(5);
      ragAdapter.close();
      indexManager.close();

      return {
        indexed: true,
        ...stats,
        query_metrics: queryMetrics,
      };
    } catch (error) {
      return {
        indexed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // 获取章节统计
  fastify.get('/chapters', async (_request, reply: FastifyReply) => {
    const stateManager = new StateManager({ projectRoot });

    if (!stateManager.exists()) {
      return reply.code(404).send({ error: 'Project not initialized' });
    }

    const state = await stateManager.loadState();
    const chapterMetas = Object.entries(state.chapter_meta || {});

    const stats = {
      total: chapterMetas.length,
      total_words: 0,
      avg_words: 0,
      by_location: {} as Record<string, number>,
    };

    for (const [, meta] of chapterMetas) {
      const m = meta as { word_count?: number; location?: string };
      stats.total_words += m.word_count || 0;
      if (m.location) {
        const loc = m.location.split('/')[0];
        stats.by_location[loc] = (stats.by_location[loc] || 0) + 1;
      }
    }

    stats.avg_words = stats.total > 0 ? Math.round(stats.total_words / stats.total) : 0;

    return stats;
  });

  // 获取审查指标
  fastify.get('/review', async (_request, reply: FastifyReply) => {
    const stateManager = new StateManager({ projectRoot });

    if (!stateManager.exists()) {
      return reply.code(404).send({ error: 'Project not initialized' });
    }

    const state = await stateManager.loadState();

    // 汇总所有章节的审查指标
    const metrics = {
      high_point_avg: 0,
      consistency_score: 0,
      pacing_score: 0,
      reader_pull_avg: 0,
      chapters_reviewed: 0,
    };

    const chapterMetas = Object.values(state.chapter_meta || {});
    let totalHighPoint = 0;
    let totalPacing = 0;
    let totalReaderPull = 0;
    let reviewedCount = 0;

    for (const meta of chapterMetas) {
      const m = meta as { review_metrics?: { high_point?: number; pacing?: number; reader_pull?: number } };
      if (m.review_metrics) {
        reviewedCount++;
        totalHighPoint += m.review_metrics.high_point || 0;
        totalPacing += m.review_metrics.pacing || 0;
        totalReaderPull += m.review_metrics.reader_pull || 0;
      }
    }

    if (reviewedCount > 0) {
      metrics.high_point_avg = Math.round((totalHighPoint / reviewedCount) * 10) / 10;
      metrics.pacing_score = Math.round((totalPacing / reviewedCount) * 10) / 10;
      metrics.reader_pull_avg = Math.round((totalReaderPull / reviewedCount) * 10) / 10;
      metrics.chapters_reviewed = reviewedCount;
    }

    return metrics;
  });
};
