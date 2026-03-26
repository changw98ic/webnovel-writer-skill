/**
 * 风格样本管理模块
 *
 * 迁移自 Python style_sampler.py
 * 管理高质量章节片段作为风格参考
 *
 * 使用 JSON 文件存储，避免 better-sqlite3 在新版本 Node.js 上的编译问题
 */
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { writeJsonAtomic, readJsonSafe } from './security.js';

// ============================================================================
// Types
// ============================================================================

/** 场景类型 */
export enum SceneType {
  BATTLE = '战斗',
  DIALOGUE = '对话',
  DESCRIPTION = '描写',
  TRANSITION = '过渡',
  EMOTION = '情感',
  TENSION = '紧张',
  COMEDY = '轻松',
}

/** 风格样本 */
export interface StyleSample {
  id: string;
  chapter: number;
  sceneType: string;
  content: string;
  score: number;
  tags: string[];
  createdAt: string;
}

/** 场景数据 */
export interface SceneData {
  index?: number;
  summary?: string;
  content?: string;
}

/** 样本统计 */
export interface StyleSamplerStats {
  total: number;
  byType: Record<string, number>;
  avgScore: number;
}

interface StyleSamplesData {
  samples: StyleSample[];
  updatedAt: string;
}

// ============================================================================
// Style Sampler
// ============================================================================

export class StyleSampler {
  private dataPath: string;
  private data: StyleSamplesData;

  constructor(projectRoot: string) {
    const webnovelDir = join(projectRoot, '.webnovel');
    if (!existsSync(webnovelDir)) {
      mkdirSync(webnovelDir, { recursive: true });
    }

    this.dataPath = join(webnovelDir, 'style_samples.json');
    this.data = this.loadData();
  }

  private loadData(): StyleSamplesData {
    const loaded = readJsonSafe<StyleSamplesData>(this.dataPath, { samples: [], updatedAt: '' });
    return loaded;
  }

  private saveData(): void {
    this.data.updatedAt = new Date().toISOString();
    writeJsonAtomic(this.dataPath, this.data);
  }

  // ==================== 样本管理 ====================

  /**
   * 添加风格样本
   */
  addSample(sample: StyleSample): boolean {
    // 检查是否已存在
    const existingIndex = this.data.samples.findIndex(s => s.id === sample.id);
    if (existingIndex >= 0) {
      return false; // 已存在
    }

    this.data.samples.push({
      ...sample,
      createdAt: sample.createdAt || new Date().toISOString(),
    });
    this.saveData();
    return true;
  }

  /**
   * 按场景类型获取样本
   */
  getSamplesByType(sceneType: string, limit = 5, minScore = 0): StyleSample[] {
    return this.data.samples
      .filter(s => s.sceneType === sceneType && s.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * 获取最高分样本
   */
  getBestSamples(limit = 10): StyleSample[] {
    return [...this.data.samples]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ==================== 样本提取 ====================

  /**
   * 从章节中提取风格样本候选
   *
   * 只有高分章节 (reviewScore >= 80) 才提取样本
   */
  extractCandidates(
    chapter: number,
    reviewScore: number,
    scenes: SceneData[]
  ): StyleSample[] {
    if (reviewScore < 80) {
      return [];
    }

    const candidates: StyleSample[] = [];

    for (const scene of scenes) {
      const sceneType = this.classifySceneType(scene);
      const sceneContent = scene.content ?? '';

      // 跳过过短的场景
      if (sceneContent.length < 200) {
        continue;
      }

      const sample: StyleSample = {
        id: `ch${chapter}_s${scene.index ?? 0}`,
        chapter,
        sceneType,
        content: sceneContent.slice(0, 2000), // 限制长度
        score: reviewScore / 100.0,
        tags: this.extractTags(sceneContent),
        createdAt: new Date().toISOString(),
      };
      candidates.push(sample);
    }

    return candidates;
  }

  private classifySceneType(scene: SceneData): string {
    const summary = (scene.summary ?? '').toLowerCase();
    const content = (scene.content ?? '').toLowerCase();
    const text = summary + content;

    // 关键词分类
    const battleKeywords = ['战斗', '攻击', '出手', '拳', '剑', '杀', '打', '斗'];
    const dialogueKeywords = ['说道', '问道', '笑道', '冷声', '对话'];
    const emotionKeywords = ['心中', '感觉', '情', '泪', '痛', '喜'];
    const tensionKeywords = ['危险', '紧张', '恐惧', '压力'];

    if (battleKeywords.some(kw => text.includes(kw))) {
      return SceneType.BATTLE;
    }
    if (tensionKeywords.some(kw => text.includes(kw))) {
      return SceneType.TENSION;
    }
    if (dialogueKeywords.some(kw => text.includes(kw))) {
      return SceneType.DIALOGUE;
    }
    if (emotionKeywords.some(kw => text.includes(kw))) {
      return SceneType.EMOTION;
    }

    return SceneType.DESCRIPTION;
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];

    if (content.includes('战斗') || content.includes('攻击')) {
      tags.push('战斗');
    }
    if (content.includes('修炼') || content.includes('突破')) {
      tags.push('修炼');
    }
    if (content.includes('对话') || content.includes('说道')) {
      tags.push('对话');
    }
    if (content.includes('描写') || content.includes('景色')) {
      tags.push('描写');
    }

    return tags.slice(0, 5);
  }

  // ==================== 样本选择 ====================

  /**
   * 为章节写作选择合适的风格样本
   */
  selectSamplesForChapter(
    chapterOutline: string,
    targetTypes?: string[],
    maxSamples = 3
  ): StyleSample[] {
    const types = targetTypes ?? this.inferSceneTypes(chapterOutline);

    if (types.length === 0) {
      return this.getBestSamples(maxSamples);
    }

    const samples: StyleSample[] = [];
    const perType = Math.max(1, Math.floor(maxSamples / types.length));

    for (const sceneType of types) {
      const typeSamples = this.getSamplesByType(sceneType, perType, 0.8);
      samples.push(...typeSamples);
    }

    return samples.slice(0, maxSamples);
  }

  private inferSceneTypes(outline: string): string[] {
    const types: string[] = [];

    if (['战斗', '对决', '比试', '交手'].some(kw => outline.includes(kw))) {
      types.push(SceneType.BATTLE);
    }

    if (['对话', '谈话', '商议', '讨论'].some(kw => outline.includes(kw))) {
      types.push(SceneType.DIALOGUE);
    }

    if (['情感', '感情', '心理'].some(kw => outline.includes(kw))) {
      types.push(SceneType.EMOTION);
    }

    if (types.length === 0) {
      types.push(SceneType.DESCRIPTION);
    }

    return types;
  }

  // ==================== 统计 ====================

  /**
   * 获取样本统计
   */
  getStats(): StyleSamplerStats {
    const samples = this.data.samples;
    const total = samples.length;

    const byType: Record<string, number> = {};
    for (const sample of samples) {
      byType[sample.sceneType] = (byType[sample.sceneType] ?? 0) + 1;
    }

    const avgScore = total > 0
      ? samples.reduce((sum, s) => sum + s.score, 0) / total
      : 0;

    return {
      total,
      byType,
      avgScore: Math.round(avgScore * 1000) / 1000,
    };
  }
}
