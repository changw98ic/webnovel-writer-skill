/**
 * StateManager Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../state/manager.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';

describe('StateManager', () => {
  let tempDir: string;
  let stateManager: StateManager;

  beforeEach(() => {
    tempDir = mkdtempSync('webnovel-test-');
    stateManager = new StateManager({ projectRoot: tempDir });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('exists', () => {
    it('should return false for non-existent project', () => {
      expect(stateManager.exists()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should create new project', async () => {
      const state = await stateManager.initialize({
        project_info: {
          title: '测试小说',
          genre: '玄幻',
        },
      });

      expect(state.project_info.title).toBe('测试小说');
      expect(stateManager.exists()).toBe(true);
    });

    it('should create .webnovel directory', async () => {
      await stateManager.initialize({
        project_info: { title: 'Test', genre: '玄幻' },
      });

      const webnovelDir = join(tempDir, '.webnovel');
      const stateFile = join(webnovelDir, 'state.json');
      expect(stateManager.exists()).toBe(true);
    });
  });

  describe('loadState', () => {
    it('should throw for non-existent project', async () => {
      await expect(stateManager.loadState()).rejects.toThrow();
    });

    it('should load initialized state', async () => {
      await stateManager.initialize({
        project_info: { title: 'Test', genre: '玄幻' },
      });

      const state = await stateManager.loadState();
      expect(state.project_info.title).toBe('Test');
    });
  });

  describe('saveState', () => {
    it('should save state', async () => {
        await stateManager.initialize({
          project_info: { title: 'Test', genre: '玄幻' },
        });

        const state = await stateManager.loadState();
        state.progress.current_chapter = 5;
        await stateManager.saveState(state);

        const loaded = await stateManager.loadState();
        expect(loaded.progress.current_chapter).toBe(5);
      });
  });

  describe('updateState', () => {
    it('should atomically update state', async () => {
        await stateManager.initialize({
          project_info: { title: 'Test', genre: '玄幻' },
        });

        await stateManager.updateState(s => ({
          ...s,
          progress: { ...s.progress, current_chapter: 10 },
        }));

        const state = await stateManager.loadState();
        expect(state.progress.current_chapter).toBe(10);
      });
  });

  describe('convenience methods', () => {
    beforeEach(async () => {
      await stateManager.initialize({
        project_info: { title: 'Test', genre: '玄幻' },
      });
    });

    it('should get current chapter', async () => {
      const chapter = await stateManager.getCurrentChapter();
      expect(chapter).toBe(1); // default
    });

    it('should set current chapter', async () => {
      await stateManager.setCurrentChapter(5);
      const chapter = await stateManager.getCurrentChapter();
      expect(chapter).toBe(5);
    });

    it('should get chapter meta', async () => {
      await stateManager.setChapterMeta(1, {
        chapter: 1,
        title: '第一章',
      });

      const meta = await stateManager.getChapterMeta(1);
      expect(meta?.title).toBe('第一章');
    });

    it('should get project info', async () => {
      const info = await stateManager.getProjectInfo();
      expect(info.title).toBe('Test');
    });

    it('should update project info', async () => {
      await stateManager.updateProjectInfo({ one_liner: '一个少年的故事' });
      const info = await stateManager.getProjectInfo();
      expect(info.one_liner).toBe('一个少年的故事');
    });
  });
});
