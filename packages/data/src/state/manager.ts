/**
 * State Manager - 状态管理器
 *
 * 与 Python 版本保持兼容，读写 state.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, closeSync, openSync } from 'fs';
import { join } from 'path';
import lockfile from 'proper-lockfile';
import { ProjectState, ProjectStateSchema } from '@changw98ic/core';

export interface StateManagerOptions {
  projectRoot: string;
  storagePath?: string;
  stateFile?: string;
}

export class StateManager {
  private projectRoot: string;
  private webnovelDir: string;
  private statePath: string;

  constructor(options: StateManagerOptions) {
    this.projectRoot = options.projectRoot;
    this.webnovelDir = join(this.projectRoot, options.storagePath || '.webnovel');
    this.statePath = join(this.webnovelDir, options.stateFile || 'state.json');
  }

  /**
   * 检查项目是否存在
   */
  exists(): boolean {
    return existsSync(this.statePath);
  }

  /**
   * 初始化新项目
   */
  async initialize(initialState: Partial<ProjectState>): Promise<ProjectState> {
    if (!existsSync(this.webnovelDir)) {
      mkdirSync(this.webnovelDir, { recursive: true });
    }

    const state = ProjectStateSchema.parse({
      project_info: initialState.project_info || { title: '', genre: '' },
      progress: initialState.progress || { current_chapter: 1, total_words: 0 },
      chapter_meta: initialState.chapter_meta || {},
      plot_threads: initialState.plot_threads || { foreshadowing: [], active_conflicts: [], unresolved_questions: [] },
      strand_tracker: initialState.strand_tracker || { entries: [], quest_consecutive: 0, fire_gap: 0, constellation_gap: 1 },
    });

    await this.saveState(state);
    return state;
  }

  /**
   * 加载状态（带锁）
   */
  async loadState(): Promise<ProjectState> {
    if (!existsSync(this.statePath)) {
      throw new Error(`State file not found: ${this.statePath}`);
    }

    const release = lockfile.lockSync(this.statePath);
    try {
      const content = readFileSync(this.statePath, 'utf-8');
      return ProjectStateSchema.parse(JSON.parse(content));
    } finally {
      release();
    }
  }

  /**
   * 保存状态（带锁）
   */
  async saveState(state: ProjectState): Promise<void> {
    if (!existsSync(this.webnovelDir)) {
      mkdirSync(this.webnovelDir, { recursive: true });
    }

    // proper-lockfile requires file to exist before locking
    if (!existsSync(this.statePath)) {
      const fd = openSync(this.statePath, 'w');
      closeSync(fd);
    }

    const release = lockfile.lockSync(this.statePath);
    try {
      const content = JSON.stringify(state, null, 2);
      writeFileSync(this.statePath, content, 'utf-8');
    } finally {
      release();
    }
  }

  /**
   * 更新状态（原子操作）
   */
  async updateState(updater: (state: ProjectState) => ProjectState): Promise<ProjectState> {
    const state = await this.loadState();
    const newState = updater(state);
    await this.saveState(newState);
    return newState;
  }

  /**
   * 获取当前章节号
   */
  async getCurrentChapter(): Promise<number> {
    const state = await this.loadState();
    return state.progress.current_chapter || 1;
  }

  /**
   * 设置当前章节号
   */
  async setCurrentChapter(chapter: number): Promise<void> {
    await this.updateState(state => ({
      ...state,
      progress: {
        ...state.progress,
        current_chapter: chapter,
      },
    }));
  }

  /**
   * 获取章节元数据
   */
  async getChapterMeta(chapter: number): Promise<ProjectState['chapter_meta'][string] | undefined> {
    const state = await this.loadState();
    return state.chapter_meta[chapter.toString()];
  }

  /**
   * 设置章节元数据
   */
  async setChapterMeta(chapter: number, meta: ProjectState['chapter_meta'][string]): Promise<void> {
    await this.updateState(state => ({
      ...state,
      chapter_meta: {
        ...state.chapter_meta,
        [chapter.toString()]: meta,
      },
    }));
  }

  /**
   * 获取项目信息
   */
  async getProjectInfo(): Promise<ProjectState['project_info']> {
    const state = await this.loadState();
    return state.project_info;
  }

  /**
   * 更新项目信息
   */
  async updateProjectInfo(info: Partial<ProjectState['project_info']>): Promise<void> {
    await this.updateState(state => ({
      ...state,
      project_info: {
        ...state.project_info,
        ...info,
      },
    }));
  }

  /**
   * 添加伏笔
   */
  async addForeshadowing(foreshadowing: ProjectState['plot_threads']['foreshadowing'][number]): Promise<void> {
    await this.updateState(state => ({
      ...state,
      plot_threads: {
        ...state.plot_threads,
        foreshadowing: [...state.plot_threads.foreshadowing, foreshadowing],
      },
    }));
  }

  /**
   * 添加 Strand 条目
   */
  async addStrandEntry(entry: ProjectState['strand_tracker']['entries'][number]): Promise<void> {
    await this.updateState(state => {
      const entries = [...state.strand_tracker.entries, entry];

      let questConsecutive = 0;
      let fireGap = 0;
      let constellationGap = 0;

      // 计算连续 Quest
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].type === 'Quest') {
          questConsecutive++;
        } else {
          break;
        }
      }

      // 计算断档
      const lastFire = entries.filter(e => e.type === 'Fire').pop();
      const lastConstellation = entries.filter(e => e.type === 'Constellation').pop();
      const currentChapter = state.progress.current_chapter || 1;

      if (lastFire) {
        fireGap = currentChapter - lastFire.chapter;
      }
      if (lastConstellation) {
        constellationGap = currentChapter - lastConstellation.chapter;
      }

      return {
        ...state,
        strand_tracker: {
          entries,
          quest_consecutive: questConsecutive,
          fire_gap: fireGap,
          constellation_gap: constellationGap,
        },
      };
    });
  }
}

export default StateManager;
