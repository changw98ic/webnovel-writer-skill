/**
 * Entity Routes - 实体管理 API
 */
import type { FastifyPluginAsync } from 'fastify';
import { IndexManager } from '@webnovel-skill/data';

interface EntityRoutesOptions {
  projectRoot: string;
}

interface EntityQuery {
  type?: string;
  tier?: string;
  search?: string;
  limit?: number;
}

export const entityRoutes: FastifyPluginAsync<EntityRoutesOptions> = async (fastify, options) => {
  const { projectRoot } = options;

  // 获取实体列表
  fastify.get('/', async (request, _reply) => {
    const query = request.query as EntityQuery;
    const indexManager = new IndexManager({ projectRoot });

    const entities = indexManager.getEntities({
      type: query.type as any,
      tier: query.tier as any,
      limit: query.limit || 50,
    });

    return {
      entities: entities.map(e => ({
        id: e.id,
        name: e.canonical_name,
        type: e.type,
        tier: e.tier,
        first_appearance: e.first_appearance,
        last_appearance: e.last_appearance,
        is_protagonist: e.is_protagonist,
      })),
      total: entities.length,
    };
  });

  // 获取核心实体
  fastify.get('/core', async (_request, _reply) => {
    const indexManager = new IndexManager({ projectRoot });

    const entities = indexManager.getCoreEntities();

    return {
      entities: entities.map(e => ({
        id: e.id,
        name: e.canonical_name,
        type: e.type,
        tier: e.tier,
        current: e.current,
        last_appearance: e.last_appearance,
      })),
      total: entities.length,
    };
  });

  // 搜索实体
  fastify.get('/search', async (request, reply) => {
    const query = request.query as { q: string; limit?: number };

    if (!query.q) {
      return reply.code(400).send({ error: 'Missing search query' });
    }

    const indexManager = new IndexManager({ projectRoot });
    const entities = indexManager.searchEntities(query.q, query.limit || 20);

    return {
      query: query.q,
      entities: entities.map(e => ({
        id: e.id,
        name: e.canonical_name,
        type: e.type,
        tier: e.tier,
        last_appearance: e.last_appearance,
      })),
      total: entities.length,
    };
  });

  // 获取单个实体详情
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const indexManager = new IndexManager({ projectRoot });

    const entity = indexManager.getEntityById(id);

    if (!entity) {
      return reply.code(404).send({ error: 'Entity not found' });
    }

    // 获取别名
    const aliases = indexManager.getAliasesForEntity(id);

    // 获取状态变化历史
    const stateChanges = indexManager.getStateChanges(id, 20);

    // 获取关系
    const relationships = indexManager.getRelationships(id, 20);

    return {
      ...entity,
      aliases,
      state_changes: stateChanges,
      relationships,
    };
  });

  // 获取实体关系图谱
  fastify.get('/graph', async (_request, _reply) => {
    const indexManager = new IndexManager({ projectRoot });

    const entities = indexManager.getEntities({ limit: 100 });
    const nodes = entities.map(e => ({
      id: e.id,
      label: e.canonical_name,
      type: e.type,
      tier: e.tier,
    }));

    // 获取所有关系
    const edges: Array<{ source: string; target: string; type: string }> = [];
    for (const entity of entities.slice(0, 50)) {
      const rels = indexManager.getRelationships(entity.id, 10);
      for (const rel of rels) {
        edges.push({
          source: rel.from_entity,
          target: rel.to_entity,
          type: rel.type,
        });
      }
    }

    return { nodes, edges };
  });

  // 获取最近出场记录
  fastify.get('/recent', async (request, _reply) => {
    const query = request.query as { limit?: number };
    const indexManager = new IndexManager({ projectRoot });

    const recent = indexManager.getRecentAppearances(query.limit || 20);

    return {
      entities: recent,
    };
  });
};
