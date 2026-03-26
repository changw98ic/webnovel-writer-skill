/**
 * RAG Adapter - 向量检索适配器
 *
 * 与 Python 版本保持 API 兼容
 */
import { request } from 'undici';
import { join } from 'path';
import Database from 'better-sqlite3';
import { IndexManager } from '../index-manager/manager.js';

export interface EmbedConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface RerankConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface RagOptions {
  projectRoot: string;
  storagePath?: string;
  embed?: EmbedConfig;
  rerank?: RerankConfig;
}

export interface RerankResult {
  index: number;
  relevance_score: number;
}

export interface VectorSearchResult {
  id: string;
  chunkType: string;
  content: string;
  score: number;
  source: string;
  chapter?: number;
  metadata?: Record<string, unknown>;
}

export interface SceneChunk {
  summary: string;
  startLine: number;
  endLine: number;
  sceneIndex: number;
}

export class RAGAdapter {
  private embedConfig: EmbedConfig;
  private rerankConfig: RerankConfig;
  private dbPath: string;
  private db: Database.Database;
  private indexManager: IndexManager;

  constructor(options: RagOptions) {
    const webnovelDir = join(options.projectRoot, options.storagePath || '.webnovel');
    this.dbPath = join(webnovelDir, 'vectors.db');

    // 默认配置（从环境变量读取）
    this.embedConfig = options.embed || {
      baseUrl: process.env.EMBED_BASE_URL || 'https://api-inference.modelscope.cn/v1',
      model: process.env.EMBED_MODEL || 'Qwen/Qwen3-Embedding-8B',
      apiKey: process.env.EMBED_API_KEY || '',
    };

    this.rerankConfig = options.rerank || {
      baseUrl: process.env.RERANK_BASE_URL || 'https://api.jina.ai/v1',
      model: process.env.RERANK_MODEL || 'jina-reranker-v3',
      apiKey: process.env.RERANK_API_KEY || '',
    };

    this.db = new Database(this.dbPath);
    this.indexManager = new IndexManager({
      projectRoot: options.projectRoot,
      storagePath: options.storagePath,
    });
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vectors (
        id TEXT PRIMARY KEY,
        chunk_type TEXT NOT NULL,
        chunk_id TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB,
        source_file TEXT,
        chapter INTEGER,
        scene_index INTEGER DEFAULT 0,
        parent_chunk_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        metadata TEXT DEFAULT '{}'
      )
    `);

    // 创建索引
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_vectors_chapter ON vectors(chapter)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_vectors_chunk_type ON vectors(chunk_type)`);
  }

  private formatChapter(chapter: number): string {
    return String(chapter).padStart(4, '0');
  }

  // ===========================================================================
  // Embedding
  // ===========================================================================

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.embedConfig.apiKey) {
      throw new Error('EMBED_API_KEY not configured');
    }

    const response = await request(this.embedConfig.baseUrl + '/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.embedConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.embedConfig.model,
        input: texts,
      }),
    });

    const data = await response.body.json() as { data: Array<{ embedding: number[] }> };
    return data.data.map((d) => d.embedding);
  }

  // ===========================================================================
  // Reranking
  // ===========================================================================

  async rerank(query: string, documents: string[]): Promise<RerankResult[]> {
    if (!this.rerankConfig.apiKey) {
      // 无 rerank 配置时， 返回默认排序
      return documents.map((_, index) => ({ index, relevance_score: 0.5 }));
    }

    const response = await request(this.rerankConfig.baseUrl + '/rerank', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.rerankConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.rerankConfig.model,
        query,
        documents,
      }),
    });

    const data = await response.body.json() as { results: RerankResult[] };
    return data.results;
  }

  // ===========================================================================
  // Indexing
  // ===========================================================================

  async indexChapter(
    chapter: number,
    summary: string,
    scenes: SceneChunk[]
  ): Promise<void> {
    const chapterId = this.formatChapter(chapter);
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO vectors
      (id, chunk_type, chunk_id, content, embedding, source_file, chapter, scene_index, parent_chunk_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 索引摘要
    const summaryEmbedding = this.embedConfig.apiKey
      ? Buffer.from(new Float64Array((await this.embed([summary]))[0]).buffer)
      : null;

    insertStmt.run(
      `ch${chapterId}_summary`,
      'summary',
      `ch${chapterId}_summary`,
      summary,
      summaryEmbedding,
      `summaries/ch${chapterId}.md`,
      chapter,
      0,
      null,
      JSON.stringify({ wordCount: summary.length })
    );

    // 索引场景
    for (const scene of scenes) {
      const sceneEmbedding = this.embedConfig.apiKey
        ? Buffer.from(new Float64Array((await this.embed([scene.summary]))[0]).buffer)
        : null;

      insertStmt.run(
        `ch${chapterId}_s${scene.sceneIndex}`,
        'scene',
        `ch${chapterId}_s${scene.sceneIndex}`,
        scene.summary,
        sceneEmbedding,
        `正文/第${chapterId}章.md#scene_${scene.sceneIndex}`,
        chapter,
        scene.sceneIndex,
        `ch${chapterId}_summary`,
        JSON.stringify({ startLine: scene.startLine, endLine: scene.endLine })
      );
    }
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  async search(query: string, topK = 10): Promise<VectorSearchResult[]> {
    const startedAt = Date.now();
    // BM25 简化实现（全文搜索）
    const bm25Results = this.db.prepare(`
      SELECT id, chunk_type, content, chapter, metadata
      FROM vectors
      WHERE content LIKE ?
      ORDER BY chapter DESC
      LIMIT ?
    `).all(`%${query}%`, topK * 2) as Array<{
      id: string;
      chunk_type: string;
      content: string;
      chapter: number;
      metadata: string;
    }>;

    // 如果启用了向量检索
    if (this.embedConfig.apiKey) {
      try {
        const queryEmbedding = await this.embed([query]);
        const vectorResults = await this.vectorSearch(queryEmbedding[0], topK);

        // 合并结果
        const allResults = [...bm25Results.map(r => ({
          id: r.id,
          chunkType: r.chunk_type,
          content: r.content,
          score: 0.5,
          source: 'bm25' as const,
          chapter: r.chapter,
          metadata: JSON.parse(r.metadata || '{}'),
        })), ...vectorResults];

        // Rerank（可选）
        if (this.rerankConfig.apiKey && allResults.length > 1) {
          const documents = allResults.map(r => r.content);
          const rerankResults = await this.rerank(query, documents);

          // 按 rerank 分数排序
          const merged: VectorSearchResult[] = [];
          const usedIds = new Set<string>();

          for (const r of rerankResults) {
            const result = allResults[r.index];
            if (result && !usedIds.has(result.id)) {
              merged.push({
                ...result,
                score: r.relevance_score,
                source: 'rerank',
              });
              usedIds.add(result.id);
            }
          }

          const finalResults = merged.slice(0, topK);
          this.logSearch(query, 'rerank', finalResults, Date.now() - startedAt);
          return finalResults;
        }

        const finalResults = allResults.slice(0, topK);
        this.logSearch(query, 'hybrid', finalResults, Date.now() - startedAt);
        return finalResults;
      } catch (error) {
        // 向量检索失败，降级到 BM25
        console.error('Vector search failed, falling back to BM25:', error);
      }
    }

    // 仅 BM25
    const finalResults = bm25Results.slice(0, topK).map(r => ({
      id: r.id,
      chunkType: r.chunk_type,
      content: r.content,
      score: 0.5,
      source: 'bm25' as const,
      chapter: r.chapter,
      metadata: JSON.parse(r.metadata || '{}'),
    }));
    this.logSearch(query, 'bm25', finalResults, Date.now() - startedAt);
    return finalResults;
  }

  private logSearch(
    query: string,
    queryType: string,
    results: VectorSearchResult[],
    latencyMs: number,
  ): void {
    try {
      this.indexManager.logRagQuery({
        query,
        queryType,
        resultsCount: results.length,
        hitSources: Array.from(new Set(results.map((result) => result.source))),
        latencyMs,
        chapter: null,
      });
    } catch (error) {
      console.warn('Failed to log rag query:', error);
    }
  }

  private async vectorSearch(queryEmbedding: number[], topK: number): Promise<VectorSearchResult[]> {
    const rows = this.db.prepare(`
      SELECT id, chunk_type, content, embedding, chapter, metadata
      FROM vectors
      WHERE embedding IS NOT NULL
      ORDER BY chapter DESC
      LIMIT ?
    `).all(topK * 3) as Array<{
      id: string;
      chunk_type: string;
      content: string;
      embedding: Buffer;
      chapter: number;
      metadata: string;
    }>;

    // 计算余弦相似度
    const results: Array<{ row: typeof rows[0]; similarity: number }> = [];

    for (const row of rows) {
      if (row.embedding) {
        const embedding = Array.from(new Float64Array(row.embedding));
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);
        results.push({ row, similarity });
      }
    }

    // 排序并返回 topK
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, topK).map(({ row, similarity }) => ({
      id: row.id,
      chunkType: row.chunk_type,
      content: row.content,
      score: similarity,
      source: 'vector' as const,
      chapter: row.chapter,
      metadata: JSON.parse(row.metadata || '{}'),
    }));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getStats(): { totalChunks: number; byType: Record<string, number> } {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM vectors').get() as { count: number };

    const byType = this.db.prepare(`
      SELECT chunk_type, COUNT(*) as count
      FROM vectors
      GROUP BY chunk_type
    `).all() as Array<{ chunk_type: string; count: number }>;

    return {
      totalChunks: total.count,
      byType: Object.fromEntries(byType.map(r => [r.chunk_type, r.count])),
    };
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  close(): void {
    this.db.close();
    this.indexManager.close();
  }
}

export default RAGAdapter;
