/**
 * @changw98ic/dashboard
 *
 * 可视化面板 - Fastify 后端
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { projectRoutes } from './routes/project.js';
import { chapterRoutes } from './routes/chapter.js';
import { entityRoutes } from './routes/entity.js';
import { statsRoutes } from './routes/stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveStaticDir(staticDir?: string): string | null {
  const candidates = [
    staticDir,
    join(__dirname, '../frontend/dist'),
    join(__dirname, '../../../webnovel-writer/dashboard/frontend/dist'),
  ];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export interface DashboardOptions {
  port?: number;
  host?: string;
  projectRoot: string;
  staticDir?: string;
}

export async function createDashboard(options: DashboardOptions) {
  const { port = 3000, host = 'localhost', projectRoot, staticDir } = options;
  const resolvedStaticDir = resolveStaticDir(staticDir);

  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  // 注册 CORS
  await fastify.register(cors, {
    origin: true,
  });

  // 注册静态文件服务
  if (resolvedStaticDir) {
    await fastify.register(staticPlugin, {
      root: resolvedStaticDir,
      prefix: '/assets/',
    });
  }

  // 注册路由
  await fastify.register(projectRoutes, { prefix: '/api/project', projectRoot });
  await fastify.register(chapterRoutes, { prefix: '/api/chapters', projectRoot });
  await fastify.register(entityRoutes, { prefix: '/api/entities', projectRoot });
  await fastify.register(statsRoutes, { prefix: '/api/stats', projectRoot });

  // 健康检查
  fastify.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // SPA fallback
  fastify.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      reply.code(404).send({ error: 'Not found' });
    } else {
      if (resolvedStaticDir) {
        reply.sendFile('index.html');
        return;
      }

      reply.type('text/html').send(`
        <!doctype html>
        <html lang="zh-CN">
          <head>
            <meta charset="utf-8" />
            <title>Webnovel Dashboard</title>
          </head>
          <body>
            <h1>Webnovel Dashboard API 已启动</h1>
            <p>未找到前端静态资源目录，请先构建或提供 staticDir。</p>
          </body>
        </html>
      `);
    }
  });

  return {
    fastify,
    start: async () => {
      await fastify.listen({ port, host });
      console.log(`Dashboard running at http://${host}:${port}`);
      if (resolvedStaticDir) {
        console.log(`Dashboard static assets: ${resolvedStaticDir}`);
      } else {
        console.warn('Dashboard static assets not found; API-only mode enabled.');
      }
      return fastify;
    },
    stop: async () => {
      await fastify.close();
    },
  };
}

export { projectRoutes } from './routes/project.js';
export { chapterRoutes } from './routes/chapter.js';
export { entityRoutes } from './routes/entity.js';
export { statsRoutes } from './routes/stats.js';

export default createDashboard;
