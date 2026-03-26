/**
 * Path Compatibility - 与 Python 版本兼容的路径处理工具
 */
import { existsSync, statSync } from 'fs';
import { join, resolve, normalize } from 'path';
import { homedir, platform } from 'os';

/**
 * Webnovel 数据目录名
 */
export const WEBNOVEL_DIR = '.webnovel';

/**
 * 格式化章节编号（补零到 4 位）
 * Python: f"{chapter:04d}"
 */
export function formatChapter(chapter: number): string {
  return String(chapter).padStart(4, '0');
}

/**
 * 生成 Chunk ID
 * Python: f"ch{chapter_id}_summary" 或 f"ch{chapter_id}_s{scene_index}"
 */
export function makeChunkId(type: 'summary' | 'scene', chapter: number, sceneIndex?: number): string {
  const chapterId = formatChapter(chapter);
  if (type === 'summary') {
    return `ch${chapterId}_summary`;
  }
  return `ch${chapterId}_s${sceneIndex ?? 0}`;
}

/**
 * 解析 Chunk ID 中的章节号
 */
export function parseChunkChapter(chunkId: string): number | null {
  const match = chunkId.match(/^ch(\d+)_/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

/**
 * 获取 state.json 文件路径
 */
export function getStatePath(projectRoot: string): string {
  return join(projectRoot, WEBNOVEL_DIR, 'state.json');
}

/**
 * 获取 index.db 文件路径
 */
export function getIndexDbPath(projectRoot: string): string {
  return join(projectRoot, WEBNOVEL_DIR, 'index.db');
}

/**
 * 获取 vectors.db 文件路径
 */
export function getVectorsDbPath(projectRoot: string): string {
  return join(projectRoot, WEBNOVEL_DIR, 'vectors.db');
}

/**
 * 检查是否为有效的项目根目录
 */
export function isProjectRoot(projectRoot: string): boolean {
  const statePath = getStatePath(projectRoot);
  try {
    return existsSync(statePath) && statSync(statePath).isFile();
  } catch {
    return false;
  }
}

/**
 * 检查是否为显式项目根目录（包含 .webnovel 目录或 state.json）
 */
export function isExplicitProjectRoot(projectRoot: string): boolean {
  const webnovelDir = join(projectRoot, WEBNOVEL_DIR);
  try {
    return isProjectRoot(projectRoot) || (existsSync(webnovelDir) && statSync(webnovelDir).isDirectory());
  } catch {
    return false;
  }
}

/**
 * 规范化路径（跨平台）
 * Python: os.path.normcase + resolve
 */
export function normalizePath(path: string): string {
  let normalized = normalize(path);
  // Windows 下统一使用反斜杠
  if (platform() === 'win32') {
    normalized = normalized.toLowerCase();
  }
  return normalized;
}

/**
 * 获取用户 Claude 根目录
 * Python: _get_user_claude_root()
 */
export function getUserClaudeRoot(): string {
  const envHome = process.env.WEBNOVEL_CLAUDE_HOME || process.env.CLAUDE_HOME;
  if (envHome) {
    return resolve(normalizePath(envHome));
  }
  return join(homedir(), '.claude');
}

/**
 * 获取全局 registry 路径
 * Python: _global_registry_path()
 */
export function getGlobalRegistryPath(): string {
  return join(getUserClaudeRoot(), 'webnovel-writer', 'workspaces.json');
}

/**
 * 生成稳定的路径 key（用于 registry 映射）
 * Python: _normcase_path_key()
 */
export function makePathKey(path: string): string {
  try {
    return normalizePath(resolve(path));
  } catch {
    return normalizePath(path);
  }
}

/**
 * 获取当前时间 ISO 格式
 */
export function nowIso(): string {
  return new Date().toISOString().slice(0, 19);
}
