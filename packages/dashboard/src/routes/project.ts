/**
 * Project Routes - 项目信息 API
 */
import type { FastifyPluginAsync } from 'fastify';
import { StateManager } from '@changw98ic/data';

interface ProjectRoutesOptions {
  projectRoot: string;
}

export const projectRoutes: FastifyPluginAsync<ProjectRoutesOptions> = async (fastify, options) => {
  const { projectRoot } = options;

  // 获取项目信息
  fastify.get('/info', async (_request, reply) => {
    const stateManager = new StateManager({ projectRoot });

    if (!stateManager.exists()) {
      return reply.code(404).send({ error: 'Project not initialized' });
    }

    const state = await stateManager.loadState();

    return {
      title: state.project_info.title,
      genre: state.project_info.genre,
      target_words: state.project_info.target_words,
      target_chapters: state.project_info.target_chapters,
      current_chapter: state.progress.current_chapter,
      total_words: state.progress.total_words,
      created_at: state.project_info.created_at,
    };
  });

  // 获取进度信息
  fastify.get('/progress', async (_request, reply) => {
    const stateManager = new StateManager({ projectRoot });

    if (!stateManager.exists()) {
      return reply.code(404).send({ error: 'Project not initialized' });
    }

    const state = await stateManager.loadState();

    return {
      current_chapter: state.progress.current_chapter,
      total_words: state.progress.total_words,
      completed_chapters: state.progress.completed_chapters || 0,
      progress_percent: state.project_info.target_chapters
        ? Math.round((state.progress.current_chapter / state.project_info.target_chapters) * 100)
        : 0,
    };
  });

  // 获取主角状态
  fastify.get('/protagonist', async (_request, reply) => {
    const stateManager = new StateManager({ projectRoot });

    if (!stateManager.exists()) {
      return reply.code(404).send({ error: 'Project not initialized' });
    }

    const state = await stateManager.loadState();

    return state.protagonist_state || {};
  });

  // 获取伏笔
  fastify.get('/foreshadowing', async (_request, reply) => {
    const stateManager = new StateManager({ projectRoot });

    if (!stateManager.exists()) {
      return reply.code(404).send({ error: 'Project not initialized' });
    }

    const state = await stateManager.loadState();
    const foreshadowing = state.plot_threads?.foreshadowing || [];

    return {
      active: foreshadowing.filter((f) => f.status === 'active'),
      resolved: foreshadowing.filter((f) => f.status === 'resolved'),
      total: foreshadowing.length,
    };
  });

  // 获取 Strand Tracker
  fastify.get('/strands', async (_request, reply) => {
    const stateManager = new StateManager({ projectRoot });

    if (!stateManager.exists()) {
      return reply.code(404).send({ error: 'Project not initialized' });
    }

    const state = await stateManager.loadState();

    return {
      entries: state.strand_tracker?.entries || [],
      quest_consecutive: state.strand_tracker?.quest_consecutive || 0,
      fire_gap: state.strand_tracker?.fire_gap || 0,
      constellation_gap: state.strand_tracker?.constellation_gap || 0,
    };
  });
};
