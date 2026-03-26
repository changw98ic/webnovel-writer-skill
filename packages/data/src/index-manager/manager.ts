/**
 * Index Manager - 实体索引管理器
 *
 * 与 Python 版本保持兼容，操作 index.db
 */
import Database from 'better-sqlite3';
import { join } from 'path';
import {
  Entity,
  EntityType,
  EntityTier,
  Alias,
  StateChange,
  Relationship,
} from '@webnovel-skill/core';

export interface IndexManagerOptions {
  projectRoot: string;
  storagePath?: string;
  indexDb?: string;
}

export interface RagQueryLogEntry {
  id: number;
  query: string;
  queryType: string;
  resultsCount: number;
  hitSources: string[];
  latencyMs: number | null;
  chapter: number | null;
  createdAt: string;
}

export interface RagQuerySummary {
  totalQueries: number;
  avgLatencyMs: number | null;
  byType: Record<string, number>;
  recentQueries: RagQueryLogEntry[];
}

export class IndexManager {
  private db: Database.Database;
  private dbPath: string;

  constructor(options: IndexManagerOptions) {
    const webnovelDir = join(options.projectRoot, options.storagePath || '.webnovel');
    this.dbPath = join(webnovelDir, options.indexDb || 'index.db');
    this.db = new Database(this.dbPath);
    this.initializeTables();
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  private initializeTables(): void {
    // entities 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        canonical_name TEXT NOT NULL,
        tier TEXT DEFAULT '装饰',
        current TEXT DEFAULT '{}',
        first_appearance INTEGER DEFAULT 0,
        last_appearance INTEGER DEFAULT 0,
        is_protagonist INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        desc TEXT
      )
    `);

    // aliases 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS aliases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alias TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        UNIQUE(alias)
      )
    `);

    // state_changes 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS state_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id TEXT NOT NULL,
        field TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        reason TEXT,
        chapter INTEGER NOT NULL
      )
    `);

    // relationships 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_entity TEXT NOT NULL,
        to_entity TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        chapter INTEGER NOT NULL
      )
    `);

    // relationship_events 表 (v5.5+)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relationship_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_entity TEXT NOT NULL,
        to_entity TEXT NOT NULL,
        type TEXT NOT NULL,
        chapter INTEGER NOT NULL,
        action TEXT DEFAULT 'update',
        polarity INTEGER DEFAULT 0,
        strength REAL DEFAULT 0.5,
        description TEXT,
        scene_index INTEGER DEFAULT 0,
        evidence TEXT,
        confidence REAL DEFAULT 1.0
      )
    `);

    // chapters 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chapters (
        chapter INTEGER PRIMARY KEY,
        title TEXT,
        location TEXT,
        word_count INTEGER DEFAULT 0,
        characters TEXT DEFAULT '[]',
        summary TEXT
      )
    `);

    // scenes 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scenes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chapter INTEGER NOT NULL,
        scene_index INTEGER NOT NULL,
        start_line INTEGER,
        end_line INTEGER,
        location TEXT,
        summary TEXT,
        characters TEXT DEFAULT '[]',
        UNIQUE(chapter, scene_index)
      )
    `);

    // rag_query_log 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rag_query_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT,
        query_type TEXT,
        results_count INTEGER,
        hit_sources TEXT,
        latency_ms INTEGER,
        chapter INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // tool_call_stats 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tool_call_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT,
        success INTEGER,
        retry_count INTEGER DEFAULT 0,
        error_code TEXT,
        error_message TEXT,
        chapter INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_tier ON entities(tier);
      CREATE INDEX IF NOT EXISTS idx_entities_last_appearance ON entities(last_appearance DESC);
      CREATE INDEX IF NOT EXISTS idx_aliases_entity_id ON aliases(entity_id);
      CREATE INDEX IF NOT EXISTS idx_state_changes_entity ON state_changes(entity_id);
      CREATE INDEX IF NOT EXISTS idx_state_changes_chapter ON state_changes(chapter);
      CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_entity);
      CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_entity);
      CREATE INDEX IF NOT EXISTS idx_rag_query_type ON rag_query_log(query_type);
      CREATE INDEX IF NOT EXISTS idx_rag_query_chapter ON rag_query_log(chapter);
      CREATE INDEX IF NOT EXISTS idx_tool_stats_name ON tool_call_stats(tool_name);
    `);
  }

  // ===========================================================================
  // Entity Operations
  // ===========================================================================

  /**
   * 插入或更新实体
   */
  upsertEntity(entity: Partial<Entity> & { id: string }): void {
    const stmt = this.db.prepare(`
      INSERT INTO entities (id, type, canonical_name, tier, current, first_appearance, last_appearance, is_protagonist, is_archived, desc)
      VALUES (@id, @type, @canonical_name, @tier, @current, @first_appearance, @last_appearance, @is_protagonist, @is_archived, @desc)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        canonical_name = excluded.canonical_name,
        tier = excluded.tier,
        current = excluded.current,
        last_appearance = excluded.last_appearance,
        is_protagonist = excluded.is_protagonist,
        is_archived = excluded.is_archived,
        desc = excluded.desc
    `);

    stmt.run({
      id: entity.id,
      type: entity.type || '角色',
      canonical_name: entity.canonical_name || entity.id,
      tier: entity.tier || '装饰',
      current: JSON.stringify(entity.current || {}),
      first_appearance: entity.first_appearance || 0,
      last_appearance: entity.last_appearance || 0,
      is_protagonist: entity.is_protagonist ? 1 : 0,
      is_archived: entity.is_archived ? 1 : 0,
      desc: entity.desc || null,
    });
  }

  /**
   * 获取所有实体
   */
  getEntities(options?: {
    type?: EntityType;
    tier?: EntityTier;
    includeArchived?: boolean;
    limit?: number;
  }): Entity[] {
    let sql = 'SELECT * FROM entities WHERE 1=1';
    const params: (string | number)[] = [];

    if (options?.type) {
      sql += ' AND type = ?';
      params.push(options.type);
    }
    if (options?.tier) {
      sql += ' AND tier = ?';
      params.push(options.tier);
    }
    if (!options?.includeArchived) {
      sql += ' AND is_archived = 0';
    }

    sql += ' ORDER BY last_appearance DESC';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.rowToEntity);
  }

  /**
   * 根据 ID 获取实体
   */
  getEntityById(id: string): Entity | null {
    const row = this.db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as any;
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * 获取核心实体（主角 + 重要角色）
   */
  getCoreEntities(): Entity[] {
    const rows = this.db.prepare(`
      SELECT * FROM entities
      WHERE tier IN ('核心', '重要') AND is_archived = 0
      ORDER BY is_protagonist DESC, last_appearance DESC
    `).all() as any[];
    return rows.map(this.rowToEntity);
  }

  private rowToEntity(row: any): Entity {
    return {
      id: row.id,
      type: row.type,
      canonical_name: row.canonical_name,
      tier: row.tier,
      current: JSON.parse(row.current || '{}'),
      first_appearance: row.first_appearance,
      last_appearance: row.last_appearance,
      is_protagonist: Boolean(row.is_protagonist),
      is_archived: Boolean(row.is_archived),
      desc: row.desc,
    };
  }

  // ===========================================================================
  // Alias Operations
  // ===========================================================================

  /**
   * 注册别名
   */
  registerAlias(alias: string, entityId: string, entityType: EntityType): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO aliases (alias, entity_id, entity_type)
      VALUES (?, ?, ?)
    `);
    stmt.run(alias, entityId, entityType);
  }

  /**
   * 根据别名查找实体
   */
  getEntityByAlias(alias: string): Entity | null {
    const row = this.db.prepare(`
      SELECT e.* FROM entities e
      JOIN aliases a ON e.id = a.entity_id
      WHERE a.alias = ?
    `).get(alias) as any;
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * 获取实体的所有别名
   */
  getAliasesForEntity(entityId: string): Alias[] {
    return this.db.prepare('SELECT * FROM aliases WHERE entity_id = ?').all(entityId) as Alias[];
  }

  // ===========================================================================
  // State Change Operations
  // ===========================================================================

  /**
   * 记录状态变化
   */
  recordStateChange(change: Omit<StateChange, 'id'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO state_changes (entity_id, field, old_value, new_value, reason, chapter)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      change.entity_id,
      change.field,
      change.old_value ?? null,
      change.new_value ?? null,
      change.reason ?? null,
      change.chapter
    );
  }

  /**
   * 获取实体的状态变化历史
   */
  getStateChanges(entityId: string, limit = 50): StateChange[] {
    return this.db.prepare(`
      SELECT * FROM state_changes
      WHERE entity_id = ?
      ORDER BY chapter DESC
      LIMIT ?
    `).all(entityId, limit) as StateChange[];
  }

  // ===========================================================================
  // Relationship Operations
  // ===========================================================================

  /**
   * 添加或更新关系
   */
  upsertRelationship(rel: Omit<Relationship, 'id'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO relationships (from_entity, to_entity, type, description, chapter)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(rel.from_entity, rel.to_entity, rel.type, rel.description ?? null, rel.chapter);
  }

  /**
   * 获取实体的关系
   */
  getRelationships(entityId: string, limit = 100): Relationship[] {
    return this.db.prepare(`
      SELECT * FROM relationships
      WHERE from_entity = ? OR to_entity = ?
      ORDER BY chapter DESC
      LIMIT ?
    `).all(entityId, entityId, limit) as Relationship[];
  }

  // ===========================================================================
  // Query Operations
  // ===========================================================================

  /**
   * 最近出场记录
   */
  getRecentAppearances(limit = 20): { entity_id: string; last_appearance: number }[] {
    return this.db.prepare(`
      SELECT id as entity_id, last_appearance
      FROM entities
      WHERE is_archived = 0
      ORDER BY last_appearance DESC
      LIMIT ?
    `).all(limit) as { entity_id: string; last_appearance: number }[];
  }

  /**
   * 搜索实体
   */
  searchEntities(query: string, limit = 20): Entity[] {
    const pattern = `%${query}%`;
    const rows = this.db.prepare(`
      SELECT e.* FROM entities e
      LEFT JOIN aliases a ON e.id = a.entity_id
      WHERE e.canonical_name LIKE ? OR a.alias LIKE ?
      GROUP BY e.id
      ORDER BY e.last_appearance DESC
      LIMIT ?
    `).all(pattern, pattern, limit) as any[];
    return rows.map(this.rowToEntity);
  }

  // ===========================================================================
  // RAG Observability
  // ===========================================================================

  logRagQuery(params: {
    query: string;
    queryType: string;
    resultsCount: number;
    hitSources?: string[] | null;
    latencyMs?: number | null;
    chapter?: number | null;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO rag_query_log (query, query_type, results_count, hit_sources, latency_ms, chapter)
      VALUES (@query, @query_type, @results_count, @hit_sources, @latency_ms, @chapter)
    `);

    stmt.run({
      query: params.query,
      query_type: params.queryType,
      results_count: params.resultsCount,
      hit_sources: (params.hitSources || []).join(','),
      latency_ms: params.latencyMs ?? null,
      chapter: params.chapter ?? null,
    });
  }

  getRecentRagQueries(limit = 10): RagQueryLogEntry[] {
    const rows = this.db.prepare(`
      SELECT id, query, query_type, results_count, hit_sources, latency_ms, chapter, created_at
      FROM rag_query_log
      ORDER BY id DESC
      LIMIT ?
    `).all(limit) as Array<{
      id: number;
      query: string;
      query_type: string;
      results_count: number;
      hit_sources: string | null;
      latency_ms: number | null;
      chapter: number | null;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      query: row.query,
      queryType: row.query_type,
      resultsCount: row.results_count,
      hitSources: row.hit_sources
        ? row.hit_sources.split(',').map((source) => source.trim()).filter(Boolean)
        : [],
      latencyMs: row.latency_ms,
      chapter: row.chapter,
      createdAt: row.created_at,
    }));
  }

  getRagQuerySummary(limit = 10): RagQuerySummary {
    const total = this.db.prepare(
      'SELECT COUNT(*) as count, AVG(latency_ms) as avg_latency FROM rag_query_log'
    ).get() as { count: number; avg_latency: number | null };

    const byType = this.db.prepare(`
      SELECT query_type, COUNT(*) as count
      FROM rag_query_log
      GROUP BY query_type
    `).all() as Array<{ query_type: string; count: number }>;

    return {
      totalQueries: total.count,
      avgLatencyMs: total.avg_latency == null ? null : Math.round(total.avg_latency),
      byType: Object.fromEntries(byType.map((row) => [row.query_type, row.count])),
      recentQueries: this.getRecentRagQueries(limit),
    };
  }

  // ===========================================================================
  // Stats Operations
  // ===========================================================================

  /**
   * 获取统计信息
   */
  getStats(): { totalEntities: number; byType: Record<string, number>; byTier: Record<string, number> } {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM entities').get() as { count: number };

    const byType = this.db.prepare(`
      SELECT type, COUNT(*) as count
      FROM entities
      GROUP BY type
    `).all() as Array<{ type: string; count: number }>;

    const byTier = this.db.prepare(`
      SELECT tier, COUNT(*) as count
      FROM entities
      GROUP BY tier
    `).all() as Array<{ tier: string; count: number }>;

    return {
      totalEntities: total.count,
      byType: Object.fromEntries(byType.map(r => [r.type, r.count])),
      byTier: Object.fromEntries(byTier.map(r => [r.tier, r.count])),
    };
  }

  /**
   * 获取章节场景
   */
  getScenes(chapter: number): Array<{
    chapter: number;
    scene_index: number;
    location: string | null;
    summary: string | null;
    characters: string[];
  }> {
    const rows = this.db.prepare(`
      SELECT chapter, scene_index, location, summary, characters
      FROM scenes
      WHERE chapter = ?
      ORDER BY scene_index
    `).all(chapter) as Array<{
      chapter: number;
      scene_index: number;
      location: string | null;
      summary: string | null;
      characters: string;
    }>;

    return rows.map(r => ({
      chapter: r.chapter,
      scene_index: r.scene_index,
      location: r.location,
      summary: r.summary,
      characters: JSON.parse(r.characters || '[]'),
    }));
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  close(): void {
    this.db.close();
  }
}

export default IndexManager;
