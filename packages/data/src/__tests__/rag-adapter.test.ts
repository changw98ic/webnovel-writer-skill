import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { RAGAdapter } from '../rag/adapter.js';
import { IndexManager } from '../index-manager/manager.js';

describe('RAGAdapter', () => {
  let tempDir: string;
  let adapter: RAGAdapter;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'webnovel-rag-'));
    mkdirSync(join(tempDir, '.webnovel'), { recursive: true });
    adapter = new RAGAdapter({ projectRoot: tempDir });
  });

  afterEach(() => {
    adapter.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('indexes summary and scenes without embedding config', async () => {
    await adapter.indexChapter(1, '章节摘要', [
      { summary: '第一场景：萧炎拜师。', startLine: 1, endLine: 10, sceneIndex: 1 },
      { summary: '第二场景：萧炎立下三年之约。', startLine: 11, endLine: 20, sceneIndex: 2 },
    ]);

    expect(adapter.getStats()).toEqual({
      totalChunks: 3,
      byType: {
        scene: 2,
        summary: 1,
      },
    });

    const db = new Database(join(tempDir, '.webnovel', 'vectors.db'), { readonly: true });
    const rows = db
      .prepare('SELECT id, chunk_type, source_file, metadata FROM vectors ORDER BY id')
      .all() as Array<{ id: string; chunk_type: string; source_file: string; metadata: string }>;
    db.close();

    expect(rows.map((row) => row.id)).toEqual(['ch0001_s1', 'ch0001_s2', 'ch0001_summary']);
    expect(rows.map((row) => row.source_file)).toEqual([
      '正文/第0001章.md#scene_1',
      '正文/第0001章.md#scene_2',
      'summaries/ch0001.md',
    ]);
    expect(JSON.parse(rows.find((row) => row.id === 'ch0001_summary')!.metadata)).toEqual({
      wordCount: 4,
    });
  });

  it('searches via bm25 when embeddings are disabled', async () => {
    await adapter.indexChapter(1, '章节摘要', [
      { summary: '第一场景：萧炎拜师。', startLine: 1, endLine: 10, sceneIndex: 1 },
      { summary: '第二场景：萧炎立下三年之约。', startLine: 11, endLine: 20, sceneIndex: 2 },
    ]);

    const results = await adapter.search('三年之约', 2);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'ch0001_s2',
      chunkType: 'scene',
      source: 'bm25',
    });
  });

  it('logs rag queries into index.db with latency and sources', async () => {
    await adapter.indexChapter(1, '章节摘要', [
      { summary: '第一场景：萧炎拜师。', startLine: 1, endLine: 10, sceneIndex: 1 },
      { summary: '第二场景：萧炎立下三年之约。', startLine: 11, endLine: 20, sceneIndex: 2 },
    ]);

    await adapter.search('三年之约', 2);

    const indexManager = new IndexManager({ projectRoot: tempDir });
    const summary = indexManager.getRagQuerySummary(5);
    indexManager.close();

    expect(summary.totalQueries).toBe(1);
    expect(summary.byType).toEqual({ bm25: 1 });
    expect(summary.avgLatencyMs).not.toBeNull();
    expect(summary.recentQueries).toHaveLength(1);
    expect(summary.recentQueries[0]).toMatchObject({
      query: '三年之约',
      queryType: 'bm25',
      resultsCount: 1,
      hitSources: ['bm25'],
      chapter: null,
    });
    expect(summary.recentQueries[0].latencyMs).not.toBeNull();
    expect(summary.recentQueries[0].latencyMs!).toBeGreaterThanOrEqual(0);
  });
});
