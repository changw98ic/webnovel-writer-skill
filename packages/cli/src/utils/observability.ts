/**
 * 可观测性工具
 *
 * 迁移自 Python observability.py
 * 提供工具调用日志、 性能计时追踪功能
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

export interface ToolCallLog {
  timestamp: string;
  toolName: string;
  success: boolean;
  retryCount: number;
  errorCode?: string;
  errorMessage?: string;
  chapter?: number;
}

export interface PerfTimingLog {
  timestamp: string;
  toolName: string;
  success: boolean;
  elapsedMs: number;
  chapter?: number;
  errorCode?: string;
  errorMessage?: string;
  meta?: Record<string, unknown>;
}

export interface ToolLogger {
  logToolCall(
    toolName: string,
    success: boolean,
    options?: {
      retryCount?: number;
      errorCode?: string;
      errorMessage?: string;
      chapter?: number;
    }
  ): void;
}

// ============================================================================
// File-Based Tool Logger
// ============================================================================

/**
 * 文件工具日志记录器
 *
 * 将工具调用日志写入 JSONL 文件， 用于后续分析
 */
export class FileToolLogger implements ToolLogger {
  private logPath: string;

  constructor(projectRoot: string) {
    const obsDir = join(projectRoot, '.webnovel', 'observability');
    if (!existsSync(obsDir)) {
      mkdirSync(obsDir, { recursive: true });
    }
    this.logPath = join(obsDir, 'tool_calls.jsonl');
  }

  logToolCall(
    toolName: string,
    success: boolean,
    options?: {
      retryCount?: number;
      errorCode?: string;
      errorMessage?: string;
      chapter?: number;
    }
  ): void {
    const entry: ToolCallLog = {
      timestamp: new Date().toISOString(),
      toolName,
      success,
      retryCount: options?.retryCount ?? 0,
      errorCode: options?.errorCode,
      errorMessage: options?.errorMessage,
      chapter: options?.chapter,
    };

    try {
      appendFileSync(this.logPath, JSON.stringify(entry, null, 2) + '\n', 'utf-8');
    } catch {
      // Silently ignore logging errors
    }
  }
}

// ============================================================================
// Observability Manager
// ============================================================================

/**
 * 可观测性管理器
 *
 * 提供统一的工具调用日志和 性能计时功能
 */
export class ObservabilityManager {
  private projectRoot: string;
  private toolLogger: ToolLogger;
  private timingLogPath: string;

  constructor(projectRoot: string, toolLogger?: ToolLogger) {
    this.projectRoot = projectRoot;
    this.toolLogger = toolLogger ?? new FileToolLogger(projectRoot);

    const obsDir = join(projectRoot, '.webnovel', 'observability');
    if (!existsSync(obsDir)) {
      mkdirSync(obsDir, { recursive: true });
    }
    this.timingLogPath = join(obsDir, 'data_agent_timing.jsonl');
  }

  // ==================== Tool Call Logging ====================

  /**
   * 安全记录工具调用
   */
  safeLogToolCall(
    toolName: string,
    success: boolean,
    options?: {
      retryCount?: number;
      errorCode?: string;
      errorMessage?: string;
      chapter?: number;
    }
  ): void {
    try {
      this.toolLogger.logToolCall(toolName, success, options);
    } catch (e) {
      // Silently ignore logging errors
      console.warn(`工具调用日志记录失败: ${toolName} - ${e}`);
    }
  }

  // ==================== Performance Timing ====================

  /**
   * 记录性能计时
   */
  appendPerfTiming(params: {
    toolName: string;
    success: boolean;
    elapsedMs: number;
    chapter?: number;
    errorCode?: string;
    errorMessage?: string;
    meta?: Record<string, unknown>;
  }): void {
    const entry: PerfTimingLog = {
      timestamp: new Date().toISOString(),
      toolName: params.toolName,
      success: params.success,
      elapsedMs: params.elapsedMs,
      chapter: params.chapter,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      meta: params.meta,
    };

    try {
      appendFileSync(this.timingLogPath, JSON.stringify(entry, null, 2) + '\n', 'utf-8');
    } catch {
      // Silently ignore logging errors
    }
  }

  /**
   * 测量异步操作执行时间
   */
  async measureAsync<T>(
    toolName: string,
    fn: () => Promise<T>,
    options?: {
      chapter?: number;
      meta?: Record<string, unknown>;
    }
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;

    try {
      const result = await fn();
      success = true;
      return result;
    } catch (e) {
      errorCode = e instanceof Error ? e.name : 'UnknownError';
      errorMessage = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      const elapsedMs = Date.now() - startTime;
      this.appendPerfTiming({
        toolName,
        success,
        elapsedMs,
        chapter: options?.chapter,
        errorCode,
        errorMessage,
        meta: options?.meta,
      });
    }
  }

  /**
   * 测量同步操作执行时间
   */
  measureSync<T>(
    toolName: string,
    fn: () => T,
    options?: {
      chapter?: number;
      meta?: Record<string, unknown>;
    }
  ): T {
    const startTime = Date.now();
    let success = false;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;

    try {
      const result = fn();
      success = true;
      return result;
    } catch (e) {
      errorCode = e instanceof Error ? e.name : 'UnknownError';
      errorMessage = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      const elapsedMs = Date.now() - startTime;
      this.appendPerfTiming({
        toolName,
        success,
        elapsedMs,
        chapter: options?.chapter,
        errorCode,
        errorMessage,
        meta: options?.meta,
      });
    }
  }

  // ==================== Statistics ====================

  /**
   * 获取性能统计
   */
  getPerfStats(options?: {
    toolName?: string;
    since?: Date;
    limit?: number;
  }): PerfTimingLog[] {
    if (!existsSync(this.timingLogPath)) {
      return [];
    }

    const content = readFileSync(this.timingLogPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    let logs = lines.map(line => {
      try {
        return JSON.parse(line) as PerfTimingLog;
      } catch {
        return null;
      }
    }).filter((log): log is PerfTimingLog => log !== null);

    // Filter by tool name
    if (options?.toolName) {
      logs = logs.filter(log => log.toolName === options.toolName);
    }

    // Filter by date
    if (options?.since) {
      const sinceTime = options.since.getTime();
      logs = logs.filter(log => new Date(log.timestamp).getTime() >= sinceTime);
    }

    // Apply limit
    if (options?.limit && options.limit > 0) {
      logs = logs.slice(0, options.limit);
    }

    return logs;
  }

  /**
   * 获取工具调用统计
   */
  getToolCallStats(options?: {
    toolName?: string;
    since?: Date;
    limit?: number;
  }): ToolCallLog[] {
    const toolCallsPath = join(this.projectRoot, '.webnovel', 'observability', 'tool_calls.jsonl');

    if (!existsSync(toolCallsPath)) {
      return [];
    }

    const content = readFileSync(toolCallsPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    let logs = lines.map(line => {
      try {
        return JSON.parse(line) as ToolCallLog;
      } catch {
        return null;
      }
    }).filter((log): log is ToolCallLog => log !== null);

    // Filter by tool name
    if (options?.toolName) {
      logs = logs.filter(log => log.toolName === options.toolName);
    }

    // Filter by date
    if (options?.since) {
      const sinceTime = options.since.getTime();
      logs = logs.filter(log => new Date(log.timestamp).getTime() >= sinceTime);
    }

    // Apply limit
    if (options?.limit && options.limit > 0) {
      logs = logs.slice(0, options.limit);
    }

    return logs;
  }

  /**
   * 生成可观测性摘要报告
   */
  generateSummary(): {
    totalToolCalls: number;
    successfulCalls: number;
    failedCalls: number;
    avgElapsedMs: number | null;
    slowestTools: Array<{ toolName: string; avgMs: number; count: number }>;
    recentErrors: Array<{ toolName: string; errorMessage: string; timestamp: string }>;
  } {
    const toolCalls = this.getToolCallStats({ limit: 100 });
    const perfLogs = this.getPerfStats({ limit: 100 });

    // Calculate tool call stats
    const successfulCalls = toolCalls.filter(log => log.success).length;
    const failedCalls = toolCalls.length - successfulCalls;

    // Calculate performance stats
    const toolPerf = new Map<string, { total: number; count: number; ms: number }>();
    for (const log of perfLogs) {
      const existing = toolPerf.get(log.toolName) ?? { total: 0, count: 0, ms: 0 };
      existing.total += 1;
      existing.count++;
      existing.ms += log.elapsedMs;
      toolPerf.set(log.toolName, existing);
    }

    // Find slowest tools
    const slowestTools = Array.from(toolPerf.entries())
      .map(([toolName, data]) => ({
        toolName,
        avgMs: Math.round(data.ms / data.count),
        count: data.count,
      }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 5);

    // Find recent errors
    const recentErrors = toolCalls
      .filter(log => !log.success)
      .slice(0, 5)
      .map(log => ({
        toolName: log.toolName,
        errorMessage: log.errorMessage ?? 'Unknown error',
        timestamp: log.timestamp,
      }));

    return {
      totalToolCalls: toolCalls.length,
      successfulCalls,
      failedCalls,
      avgElapsedMs: perfLogs.length > 0
        ? Math.round(perfLogs.reduce((sum, log) => sum + log.elapsedMs, 0) / perfLogs.length)
        : null,
      slowestTools,
      recentErrors,
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * 安全记录工具调用（独立函数）
 */
export function safeLogToolCall(
  projectRoot: string,
  toolName: string,
  success: boolean,
  options?: {
    retryCount?: number;
    errorCode?: string;
    errorMessage?: string;
    chapter?: number;
  }
): void {
  const logger = new FileToolLogger(projectRoot);
  try {
    logger.logToolCall(toolName, success, options);
  } catch {
    // Silently ignore
  }
}

/**
 * 安全追加性能计时（独立函数）
 */
export function safeAppendPerfTiming(
  projectRoot: string,
  params: {
    toolName: string;
    success: boolean;
    elapsedMs: number;
    chapter?: number;
    errorCode?: string;
    errorMessage?: string;
    meta?: Record<string, unknown>;
  }
): void {
  const manager = new ObservabilityManager(projectRoot);
  manager.appendPerfTiming(params);
}
