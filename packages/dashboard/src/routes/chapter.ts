/**
 * Chapter Routes - 章节管理 API
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { StateManager, IndexManager } from '@webnovel-skill/data';
import { readFile } from 'fs/promises';
import { join } from 'path';

interface ChapterRoutesOptions {
  projectRoot: string;
}

interface ChapterMeta {
  title?: string;
  location?: string;
  word_count?: number;
  summary?: string;
}

export const chapterRoutes: FastifyPluginAsync<ChapterRoutesOptions> = async (fastify, options) => {
  const { projectRoot } = options;

  // 获取章节列表
  fastify.get('/', async (_request, reply: FastifyReply) => {
    const stateManager = new StateManager({ projectRoot });

    if (!stateManager.exists()) {
      return reply.code(404).send({ error: 'Project not initialized' });
    }

    const state = await stateManager.loadState();
    const chapterMetas = Object.entries(state.chapter_meta || {}).map(([num, meta]) => {
      const m = meta as ChapterMeta;
      return {
        chapter: parseInt(num),
        title: m.title,
        word_count: m.word_count,
        location: m.location,
        summary: m.summary,
      };
    });

    return {
      chapters: chapterMetas.sort((a, b) => a.chapter - b.chapter),
      total: chapterMetas.length,
    };
  });

  // 获取单个章节详情
  fastify.get('/:chapter', async (request, reply: FastifyReply) => {
    const { chapter } = request.params as { chapter: string };
    const chapterNum = parseInt(chapter);

    const stateManager = new StateManager({ projectRoot });
    const indexManager = new IndexManager({ projectRoot });

    if (!stateManager.exists()) {
      return reply.code(404).send({ error: 'Project not initialized' });
    }

    const state = await stateManager.loadState();
    const meta = state.chapter_meta?.[chapterNum.toString()] as ChapterMeta | undefined;

    if (!meta) {
      return reply.code(404).send({ error: 'Chapter not found' });
    }

    // 获取章节的场景
    const scenes = indexManager.getScenes(chapterNum);

    return {
      chapter: chapterNum,
      title: meta.title,
      word_count: meta.word_count,
      location: meta.location,
      summary: meta.summary,
      scenes,
    };
  });

  // 获取章节正文
  fastify.get('/:chapter/content', async (request, reply: FastifyReply) => {
    const { chapter } = request.params as { chapter: string };
    const chapterNum = parseInt(chapter);

    const stateManager = new StateManager({ projectRoot });

    if (!stateManager.exists()) {
      return reply.code(404).send({ error: 'Project not initialized' });
    }

    const state = await stateManager.loadState();
    const meta = state.chapter_meta?.[chapterNum.toString()] as ChapterMeta | undefined;

    if (!meta || !meta.location) {
      return reply.code(404).send({ error: 'Chapter content not found' });
    }

    try {
      const contentPath = join(projectRoot, meta.location);
      const content = await readFile(contentPath, 'utf-8');

      return {
        chapter: chapterNum,
        title: meta.title,
        content,
        word_count: content.length,
      };
    } catch {
      return reply.code(404).send({ error: 'Chapter file not found' });
    }
  });
};
