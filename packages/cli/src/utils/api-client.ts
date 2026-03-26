/**
 * API 客户端 - Embedding 和 Rerank 服务封装
 *
 * 迁移自 Python api_client.py，支持两种 API 类型：
 * 1. openai: OpenAI 兼容接口 (/v1/embeddings, /v1/rerank)
 * 2. modal: Modal 自定义接口
 */
import type { ApiType, EmbeddingConfig, RerankConfig, ApiStats, RerankResult, UnifiedApiConfig } from './api-client.types.js';

// Re-export types
export type { ApiType, EmbeddingConfig, RerankConfig, ApiStats, RerankResult, UnifiedApiConfig };

// ============================================================================
// Utility Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Embedding Client
// ============================================================================

export class EmbeddingClient {
  private config: Required<EmbeddingConfig>;
  private stats: ApiStats = { totalCalls: 0, totalTime: 0, errors: 0 };
  private warmedUp = false;
  private lastErrorStatus?: number;
  private lastErrorMessage = '';

  constructor(config: EmbeddingConfig) {
    this.config = {
      apiType: config.apiType ?? 'openai',
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: config.apiKey ?? '',
      timeout: config.timeout ?? 30000,
      coldStartTimeout: config.coldStartTimeout ?? 60000,
      batchSize: config.batchSize ?? 32,
      concurrency: config.concurrency ?? 10,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
    };
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  private buildUrl(): string {
    let baseUrl = this.config.baseUrl.replace(/\/+$/, '');
    if (this.config.apiType === 'openai') {
      if (!baseUrl.endsWith('/embeddings')) {
        if (baseUrl.endsWith('/v1')) {
          return `${baseUrl}/embeddings`;
        }
        return `${baseUrl}/v1/embeddings`;
      }
    }
    return baseUrl;
  }

  private buildPayload(texts: string[]): Record<string, unknown> {
    if (this.config.apiType === 'openai') {
      return {
        input: texts,
        model: this.config.model,
        encoding_format: 'float',
      };
    }
    return {
      input: texts,
      model: this.config.model,
    };
  }

  private parseResponse(data: { data?: Array<{ embedding?: number[]; index?: number }> }): number[][] | null {
    if (!data.data) return null;

    if (this.config.apiType === 'openai') {
      // 按 index 排序确保顺序正确
      const sorted = [...data.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      return sorted.map(item => item.embedding).filter((e): e is number[] => e !== undefined);
    }

    return data.data.map(item => item.embedding).filter((e): e is number[] => e !== undefined);
  }

  async embed(texts: string[]): Promise<number[][] | null> {
    if (texts.length === 0) return [];

    const timeout = this.warmedUp ? this.config.timeout : this.config.coldStartTimeout;
    const startTime = Date.now();

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const url = this.buildUrl();
        const headers = this.buildHeaders();
        const payload = JSON.stringify(this.buildPayload(texts));

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: payload,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 200) {
          const data = await response.json() as { data?: Array<{ embedding?: number[]; index?: number }> };
          const embeddings = this.parseResponse(data);

          if (embeddings && embeddings.length > 0) {
            this.stats.totalCalls++;
            this.stats.totalTime += (Date.now() - startTime) / 1000;
            this.warmedUp = true;
            this.lastErrorStatus = undefined;
            this.lastErrorMessage = '';
            return embeddings;
          }
        }

        // 可重试的状态码
        if ([429, 500, 502, 503, 504].includes(response.status) && attempt < this.config.maxRetries - 1) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          console.warn(`[WARN] Embed ${response.status}, retrying in ${delay}ms (${attempt + 1}/${this.config.maxRetries})`);
          await sleep(delay);
          continue;
        }

        this.stats.errors++;
        const errorBody = await response.text();
        this.lastErrorStatus = response.status;
        this.lastErrorMessage = errorBody.slice(0, 200);
        console.error(`[ERR] Embed ${response.status}: ${errorBody.slice(0, 200)}`);
        return null;

      } catch (error) {
        if (attempt < this.config.maxRetries - 1) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          const isTimeout = error instanceof Error && error.name === 'AbortError';
          console.warn(`[WARN] Embed ${isTimeout ? 'timeout' : 'error'}: ${error}, retrying in ${delay}ms (${attempt + 1}/${this.config.maxRetries})`);
          await sleep(delay);
          continue;
        }

        this.stats.errors++;
        this.lastErrorStatus = undefined;
        this.lastErrorMessage = String(error);
        console.error(`[ERR] Embed: ${error}`);
        return null;
      }
    }

    return null;
  }

  async embedBatch(texts: string[], skipFailures = true): Promise<(number[] | null)[]> {
    if (texts.length === 0) return [];

    const results: (number[] | null)[] = [];
    const batchSize = this.config.batchSize;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const embeddings = await this.embed(batch);

      if (embeddings && embeddings.length === batch.length) {
        results.push(...embeddings);
      } else {
        if (!skipFailures) {
          console.warn(`[WARN] Embed batch ${Math.floor(i / batchSize)} failed, aborting all`);
          return [];
        }
        console.warn(`[WARN] Embed batch ${Math.floor(i / batchSize)} failed, marking ${batch.length} items as null`);
        results.push(...new Array(batch.length).fill(null));
      }
    }

    return results.slice(0, texts.length);
  }

  async warmup(): Promise<void> {
    await this.embed(['test']);
    this.warmedUp = true;
  }

  getStats(): ApiStats {
    return { ...this.stats };
  }

  getLastError(): { status?: number; message: string } {
    return { status: this.lastErrorStatus, message: this.lastErrorMessage };
  }
}

// ============================================================================
// Rerank Client
// ============================================================================

export class RerankClient {
  private config: Required<RerankConfig>;
  private stats: ApiStats = { totalCalls: 0, totalTime: 0, errors: 0 };
  private warmedUp = false;

  constructor(config: RerankConfig) {
    this.config = {
      apiType: config.apiType ?? 'openai',
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: config.apiKey ?? '',
      timeout: config.timeout ?? 30000,
      coldStartTimeout: config.coldStartTimeout ?? 60000,
      concurrency: config.concurrency ?? 10,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
    };
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  private buildUrl(): string {
    let baseUrl = this.config.baseUrl.replace(/\/+$/, '');
    if (this.config.apiType === 'openai') {
      if (!baseUrl.endsWith('/rerank')) {
        if (baseUrl.endsWith('/v1')) {
          return `${baseUrl}/rerank`;
        }
        return `${baseUrl}/v1/rerank`;
      }
    }
    return baseUrl;
  }

  private buildPayload(query: string, documents: string[], topN?: number): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      query,
      documents,
      model: this.config.model,
    };
    if (topN !== undefined) {
      payload.top_n = topN;
    }
    return payload;
  }

  async rerank(query: string, documents: string[], topN?: number): Promise<RerankResult[] | null> {
    if (documents.length === 0) return [];

    const timeout = this.warmedUp ? this.config.timeout : this.config.coldStartTimeout;
    const startTime = Date.now();

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const url = this.buildUrl();
        const headers = this.buildHeaders();
        const payload = JSON.stringify(this.buildPayload(query, documents, topN));

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: payload,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 200) {
          const data = await response.json() as { results?: RerankResult[] };

          this.stats.totalCalls++;
          this.stats.totalTime += (Date.now() - startTime) / 1000;
          this.warmedUp = true;

          return data.results ?? [];
        }

        // 可重试的状态码
        if ([429, 500, 502, 503, 504].includes(response.status) && attempt < this.config.maxRetries - 1) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          console.warn(`[WARN] Rerank ${response.status}, retrying in ${delay}ms (${attempt + 1}/${this.config.maxRetries})`);
          await sleep(delay);
          continue;
        }

        this.stats.errors++;
        const errorBody = await response.text();
        console.error(`[ERR] Rerank ${response.status}: ${errorBody.slice(0, 200)}`);
        return null;

      } catch (error) {
        if (attempt < this.config.maxRetries - 1) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          const isTimeout = error instanceof Error && error.name === 'AbortError';
          console.warn(`[WARN] Rerank ${isTimeout ? 'timeout' : 'error'}: ${error}, retrying in ${delay}ms (${attempt + 1}/${this.config.maxRetries})`);
          await sleep(delay);
          continue;
        }

        this.stats.errors++;
        console.error(`[ERR] Rerank: ${error}`);
        return null;
      }
    }

    return null;
  }

  async warmup(): Promise<void> {
    await this.rerank('test', ['doc1', 'doc2']);
    this.warmedUp = true;
  }

  getStats(): ApiStats {
    return { ...this.stats };
  }
}

// ============================================================================
// Unified API Client
// ============================================================================

export class UnifiedApiClient {
  private embedClient?: EmbeddingClient;
  private rerankClient?: RerankClient;
  private warmedUp = { embed: false, rerank: false };

  constructor(config: UnifiedApiConfig) {
    if (config.embed) {
      this.embedClient = new EmbeddingClient(config.embed);
    }
    if (config.rerank) {
      this.rerankClient = new RerankClient(config.rerank);
    }
  }

  // ==================== Embedding ====================

  async embed(texts: string[]): Promise<number[][] | null> {
    if (!this.embedClient) {
      throw new Error('Embedding client not configured');
    }
    return this.embedClient.embed(texts);
  }

  async embedBatch(texts: string[], skipFailures = true): Promise<(number[] | null)[]> {
    if (!this.embedClient) {
      throw new Error('Embedding client not configured');
    }
    return this.embedClient.embedBatch(texts, skipFailures);
  }

  // ==================== Rerank ====================

  async rerank(query: string, documents: string[], topN?: number): Promise<RerankResult[] | null> {
    if (!this.rerankClient) {
      throw new Error('Rerank client not configured');
    }
    return this.rerankClient.rerank(query, documents, topN);
  }

  // ==================== Warmup ====================

  async warmup(): Promise<void> {
    console.log('[WARMUP] Warming up Embed + Rerank...');
    const startTime = Date.now();

    const tasks: Promise<void>[] = [];

    if (this.embedClient) {
      tasks.push(this.warmupEmbed());
    }
    if (this.rerankClient) {
      tasks.push(this.warmupRerank());
    }

    const results = await Promise.allSettled(tasks);

    const names = [
      this.embedClient ? 'Embed' : null,
      this.rerankClient ? 'Rerank' : null,
    ].filter((n): n is string => n !== null);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const name = names[i];
      if (result.status === 'rejected') {
        console.warn(`  [FAIL] ${name}: ${result.reason}`);
      } else {
        console.log(`  [OK] ${name} ready`);
      }
    }

    console.log(`[WARMUP] Done in ${(Date.now() - startTime) / 1000}s`);
  }

  private async warmupEmbed(): Promise<void> {
    if (this.embedClient) {
      await this.embedClient.warmup();
      this.warmedUp.embed = true;
    }
  }

  private async warmupRerank(): Promise<void> {
    if (this.rerankClient) {
      await this.rerankClient.warmup();
      this.warmedUp.rerank = true;
    }
  }

  // ==================== Stats ====================

  getStats(): { embed?: ApiStats; rerank?: ApiStats } {
    return {
      embed: this.embedClient?.getStats(),
      rerank: this.rerankClient?.getStats(),
    };
  }

  printStats(): void {
    console.log('\n[API STATS]');
    const stats = this.getStats();

    if (stats.embed && stats.embed.totalCalls > 0) {
      const avgTime = stats.embed.totalTime / stats.embed.totalCalls;
      console.log(`  EMBED: ${stats.embed.totalCalls} calls, ${stats.embed.totalTime.toFixed(1)}s total, ${avgTime.toFixed(2)}s avg, ${stats.embed.errors} errors`);
    }

    if (stats.rerank && stats.rerank.totalCalls > 0) {
      const avgTime = stats.rerank.totalTime / stats.rerank.totalCalls;
      console.log(`  RERANK: ${stats.rerank.totalCalls} calls, ${stats.rerank.totalTime.toFixed(1)}s total, ${avgTime.toFixed(2)}s avg, ${stats.rerank.errors} errors`);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let globalClient: UnifiedApiClient | null = null;

export function getApiClient(config?: UnifiedApiConfig): UnifiedApiClient {
  if (!globalClient || config) {
    globalClient = new UnifiedApiClient(config ?? {});
  }
  return globalClient;
}

export function resetApiClient(): void {
  globalClient = null;
}
