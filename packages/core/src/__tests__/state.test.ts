/**
 * State Types Tests
 */
import { describe, it, expect } from 'vitest';
import {
  ProjectStateSchema,
  ProjectInfoSchema,
  ProgressSchema,
  ChapterMetaSchema,
  ForeshadowingSchema,
  PlotThreadsSchema,
  StrandTrackerSchema,
  validateProjectState,
  loadProjectState,
  saveProjectState,
} from '../types/state.js';

describe('ProjectInfoSchema', () => {
  it('should validate minimal project info', () => {
    const info = {
      title: '我的小说',
      genre: '玄幻',
    };

    const result = ProjectInfoSchema.parse(info);
    expect(result.title).toBe('我的小说');
    expect(result.genre).toBe('玄幻');
    expect(result.target_words).toBe(0); // default from schema
  });

  it('should validate complete project info', () => {
    const info = {
      title: '我的小说',
      genre: '玄幻',
      target_words: 1000000,
      target_chapters: 100,
      one_liner: '一个少年的成长故事',
      core_conflict: '人魔大战',
      platform: '起点',
    };

    const result = ProjectInfoSchema.parse(info);
    expect(result.target_words).toBe(1000000);
    expect(result.target_chapters).toBe(100);
  });
});

describe('ProgressSchema', () => {
  it('should use defaults', () => {
    const progress = ProgressSchema.parse({});
    expect(progress.current_chapter).toBe(0);
    expect(progress.total_words).toBe(0);
    expect(progress.completed_chapters).toEqual([]);
  });

  it('should validate progress data', () => {
    const progress = {
      current_chapter: 10,
      total_words: 25000,
      completed_chapters: [1, 2, 3, 4, 5],
      planned_chapters: [11, 12, 13],
    };

    const result = ProgressSchema.parse(progress);
    expect(result.current_chapter).toBe(10);
    expect(result.total_words).toBe(25000);
  });
});

describe('ChapterMetaSchema', () => {
  it('should validate chapter meta', () => {
    const meta = {
      chapter: 1,
      title: '第一章 少年觉醒',
      word_count: 2500,
      summary: '主角觉醒了神秘力量',
      hook: {
        type: '悬念钩',
        content: '神秘声音的来源',
        strength: 'strong',
      },
      pattern: {
        opening: '场景开场',
        hook: '危机钩',
        emotion_rhythm: '紧张 → 释放',
        info_density: 'medium',
      },
    };

    const result = ChapterMetaSchema.parse(meta);
    expect(result.chapter).toBe(1);
    expect(result.hook?.type).toBe('悬念钩');
  });
});

describe('ForeshadowingSchema', () => {
  it('should validate active foreshadowing', () => {
    const f = {
      id: 'f1',
      content: '主角的神秘身世',
      planted_chapter: 1,
      status: 'active',
    };

    const result = ForeshadowingSchema.parse(f);
    expect(result.status).toBe('active');
  });

  it('should validate resolved foreshadowing', () => {
    const f = {
      id: 'f2',
      content: '神秘力量的来源',
      planted_chapter: 3,
      target_chapter: 50,
      resolved_chapter: 48,
      status: 'resolved',
      type: '主线伏笔',
    };

    const result = ForeshadowingSchema.parse(f);
    expect(result.status).toBe('resolved');
    expect(result.resolved_chapter).toBe(48);
  });
});

describe('PlotThreadsSchema', () => {
  it('should validate plot threads', () => {
    const threads = {
      foreshadowing: [
        { id: 'f1', content: 'Test', planted_chapter: 1, status: 'active' },
      ],
      active_conflicts: ['人魔冲突', '宗门内斗'],
      unresolved_questions: ['主角的身世是什么？'],
    };

    const result = PlotThreadsSchema.parse(threads);
    expect(result.foreshadowing).toHaveLength(1);
    expect(result.active_conflicts).toHaveLength(2);
  });
});

describe('StrandTrackerSchema', () => {
  it('should validate strand tracker', () => {
    const tracker = {
      entries: [
        { chapter: 1, type: 'Quest', content: '主线任务' },
        { chapter: 1, type: 'Fire', content: '爽点场景' },
      ],
      quest_consecutive: 1,
      fire_gap: 0,
      constellation_gap: 1,
    };

    const result = StrandTrackerSchema.parse(tracker);
    expect(result.entries).toHaveLength(2);
  });
});

describe('ProjectStateSchema', () => {
  it('should validate minimal state', () => {
    const state = {
      project_info: {
        title: 'Test',
        genre: '玄幻',
      },
    };

    const result = ProjectStateSchema.parse(state);
    expect(result.project_info.title).toBe('Test');
    expect(result.progress).toBeDefined();
  });

  it('should validate complete state', () => {
    const state = {
      project_info: {
        title: '我的小说',
        genre: '玄幻',
        target_words: 1000000,
        target_chapters: 100,
      },
      progress: {
        current_chapter: 10,
        total_words: 25000,
        completed_chapters: [1, 2, 3, 4, 5],
      },
      chapter_meta: {
        '1': {
          chapter: 1,
          title: '第一章',
          word_count: 2500,
        },
      },
      plot_threads: {
        foreshadowing: [
          { id: 'f1', content: 'Test', planted_chapter: 1, status: 'active' },
        ],
        active_conflicts: [],
        unresolved_questions: [],
      },
      strand_tracker: {
        entries: [],
        quest_consecutive: 0,
        fire_gap: 0,
        constellation_gap: 1,
      },
    };

    const result = ProjectStateSchema.parse(state);
    expect(result.project_info.title).toBe('我的小说');
    expect(result.chapter_meta['1'].title).toBe('第一章');
  });
});

describe('validateProjectState', () => {
  it('should validate and return state', () => {
    const state = {
      project_info: { title: 'Test', genre: '玄幻' },
    };

    const result = validateProjectState(state);
    expect(result.project_info.title).toBe('Test');
  });

  it('should throw on invalid state', () => {
    expect(() => validateProjectState({})).toThrow();
  });
});

describe('loadProjectState / saveProjectState', () => {
  it('should round-trip state', () => {
    const state = {
      project_info: { title: 'Test', genre: '玄幻' },
      progress: { current_chapter: 5 },
      chapter_meta: {},
      plot_threads: { foreshadowing: [], active_conflicts: [], unresolved_questions: [] },
      strand_tracker: { entries: [], quest_consecutive: 0, fire_gap: 0, constellation_gap: 1 },
    };

    const json = saveProjectState(state as any);
    const loaded = loadProjectState(json);

    expect(loaded.project_info.title).toBe('Test');
    expect(loaded.progress.current_chapter).toBe(5);
  });
});
