/**
 * API 客户端类型定义
 */

export type ApiType = 'openai' | 'modal';

export interface EmbeddingConfig {
  apiType?: ApiType;
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeout?: number;
  coldStartTimeout?: number;
  batchSize?: number;
  concurrency?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface RerankConfig {
  apiType?: ApiType;
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeout?: number;
  coldStartTimeout?: number;
  concurrency?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ApiStats {
  totalCalls: number;
  totalTime: number;
  errors: number;
}

export interface RerankResult {
  index: number;
  relevance_score: number;
  document?: string;
}

export interface UnifiedApiConfig {
  embed?: EmbeddingConfig;
  rerank?: RerankConfig;
}
