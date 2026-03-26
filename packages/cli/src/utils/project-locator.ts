/**
 * Project Locator - 项目根目录解析器
 *
 * 迁移自 Python project_locator.py，保持完全兼容
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { platform } from 'os';
import {
  getStatePath,
  isProjectRoot,
  isExplicitProjectRoot,
  normalizePath,
  getGlobalRegistryPath,
  makePathKey,
  nowIso,
} from './path-compat.js';

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_PROJECT_DIR_NAMES = ['webnovel-project'] as const;
export const CURRENT_PROJECT_POINTER_REL = join('.claude', '.webnovel-current-project');
export const GLOBAL_REGISTRY_REL = join('webnovel-writer', 'workspaces.json');

export const ENV_CLAUDE_PROJECT_DIR = 'CLAUDE_PROJECT_DIR';
export const ENV_CLAUDE_HOME = 'CLAUDE_HOME';
export const ENV_WEBNOVEL_CLAUDE_HOME = 'WEBNOVEL_CLAUDE_HOME';
export const ENV_WEBNOVEL_PROJECT_ROOT = 'WEBNOVEL_PROJECT_ROOT';

// ============================================================================
// Git Root Detection
// ============================================================================

/**
 * 查找最近的 Git 根目录
 */
export function findGitRoot(cwd: string): string | null {
  const parts = resolve(cwd).split(/[/\\]/);
  for (let i = parts.length; i > 0; i--) {
    const candidate = parts.slice(0, i).join(sep());
    if (existsSync(join(candidate, '.git'))) {
      return candidate || '/';
    }
  }
  return null;
}

function sep(): string {
  return platform() === 'win32' ? '\\' : '/';
}

// ============================================================================
// Global Registry
// ============================================================================

interface WorkspaceEntry {
  workspace_root: string;
  current_project_root: string;
  updated_at: string;
}

interface GlobalRegistry {
  schema_version: number;
  workspaces: Record<string, WorkspaceEntry>;
  last_used_project_root: string;
  updated_at: string;
}

function defaultRegistry(): GlobalRegistry {
  return {
    schema_version: 1,
    workspaces: {},
    last_used_project_root: '',
    updated_at: nowIso(),
  };
}

function loadGlobalRegistry(path: string): GlobalRegistry {
  if (!existsSync(path)) {
    return defaultRegistry();
  }
  try {
    const content = readFileSync(path, 'utf-8');
    const data = JSON.parse(content || '{}');
    if (typeof data !== 'object' || data === null) {
      return defaultRegistry();
    }
    return {
      schema_version: data.schema_version ?? 1,
      workspaces: data.workspaces ?? {},
      last_used_project_root: data.last_used_project_root ?? '',
      updated_at: data.updated_at ?? nowIso(),
    };
  } catch {
    return defaultRegistry();
  }
}

function saveGlobalRegistry(path: string, data: GlobalRegistry): void {
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    data.updated_at = nowIso();
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // best-effort, 非阻断
  }
}

/**
 * 从用户级 registry 解析 project_root
 */
function resolveProjectRootFromGlobalRegistry(
  base: string,
  options?: {
    workspaceHint?: string;
    allowLastUsedFallback?: boolean;
  }
): string | null {
  const regPath = getGlobalRegistryPath();
  const reg = loadGlobalRegistry(regPath);
  const workspaces = reg.workspaces;

  if (Object.keys(workspaces).length === 0) {
    return null;
  }

  const hints: string[] = [];
  const envWs = process.env[ENV_CLAUDE_PROJECT_DIR];
  if (envWs) {
    hints.push(normalizePath(envWs));
  }
  if (options?.workspaceHint) {
    hints.push(normalizePath(options.workspaceHint));
  }
  hints.push(normalizePath(base));

  // 1) 精确匹配
  for (const hint of hints) {
    const key = makePathKey(hint);
    const entry = workspaces[key];
    if (entry && entry.current_project_root) {
      const target = resolve(normalizePath(entry.current_project_root));
      if (isProjectRoot(target)) {
        return target;
      }
    }
  }

  // 2) 前缀匹配
  for (const hint of hints) {
    const hintKey = makePathKey(hint);
    let bestKey: string | null = null;
    let bestLen = -1;

    for (const wsKey of Object.keys(workspaces)) {
      if (hintKey === wsKey || hintKey.startsWith(wsKey + sep())) {
        if (wsKey.length > bestLen) {
          bestKey = wsKey;
          bestLen = wsKey.length;
        }
      }
    }

    if (bestKey) {
      const entry = workspaces[bestKey];
      if (entry && entry.current_project_root) {
        const target = resolve(normalizePath(entry.current_project_root));
        if (isProjectRoot(target)) {
          return target;
        }
      }
    }
  }

  // 3) last_used fallback
  if (options?.allowLastUsedFallback) {
    const lastUsed = reg.last_used_project_root;
    if (lastUsed) {
      const target = resolve(normalizePath(lastUsed));
      if (isProjectRoot(target)) {
        return target;
      }
    }
  }

  return null;
}

// ============================================================================
// Pointer File
// ============================================================================

/**
 * 查找包含 .claude/ 的最近祖先目录
 */
function findWorkspaceRootWithClaude(start: string): string | null {
  const parts = resolve(start).split(/[/\\]/);
  for (let i = parts.length; i > 0; i--) {
    const candidate = parts.slice(0, i).join(sep());
    if (existsSync(join(candidate, '.claude'))) {
      return candidate || '/';
    }
  }
  return null;
}

/**
 * 从 workspace 指针文件解析 project_root
 */
function resolveProjectRootFromPointer(
  cwd: string,
  stopAt?: string | null
): string | null {
  const parts = resolve(cwd).split(/[/\\]/);

  for (let i = parts.length; i > 0; i--) {
    const candidate = parts.slice(0, i).join(sep());
    const pointerFile = join(candidate, CURRENT_PROJECT_POINTER_REL);

    if (existsSync(pointerFile)) {
      const raw = readFileSync(pointerFile, 'utf-8').trim();
      if (!raw) continue;

      let target = normalizePath(raw);
      if (!resolve(target).startsWith('/')) {
        // 相对路径，相对于指针文件所在目录
        target = resolve(join(dirname(pointerFile), raw));
      }

      if (isProjectRoot(target)) {
        return resolve(target);
      }
    }

    if (stopAt && candidate === stopAt) {
      break;
    }
  }

  return null;
}

// ============================================================================
// Candidate Roots
// ============================================================================

function* candidateRoots(cwd: string, stopAt?: string | null): Generator<string> {
  const resolved = resolve(cwd);
  yield resolved;

  for (const name of DEFAULT_PROJECT_DIR_NAMES) {
    yield join(resolved, name);
  }

  const parts = resolved.split(/[/\\]/);
  for (let i = parts.length - 1; i > 0; i--) {
    const parent = parts.slice(0, i).join(sep());
    yield parent;

    for (const name of DEFAULT_PROJECT_DIR_NAMES) {
      yield join(parent, name);
    }

    if (stopAt && parent === stopAt) {
      break;
    }
  }
}

// ============================================================================
// Main API
// ============================================================================

/**
 * 解析项目根目录
 *
 * 解析优先级：
 * 1) 显式传入的 project_root
 * 2) 环境变量 WEBNOVEL_PROJECT_ROOT
 * 3) workspace 指针文件
 * 4) 用户级 registry (前缀匹配)
 * 5) 从 CWD 向上搜索 .webnovel/state.json
 *
 * @throws Error 如果无法找到有效的项目根目录
 */
export function resolveProjectRoot(
  explicitProjectRoot?: string,
  options?: { cwd?: string }
): string {
  const cwd = resolve(options?.cwd || process.cwd());

  // 1) 显式传入
  if (explicitProjectRoot) {
    const root = resolve(normalizePath(explicitProjectRoot));
    if (isExplicitProjectRoot(root)) {
      return root;
    }

    // 兼容：显式传入工作区根目录（含指针文件）
    const pointerRoot = resolveProjectRootFromPointer(root, findGitRoot(root));
    if (pointerRoot) {
      return pointerRoot;
    }

    // 兼容：从用户级 registry 查找
    const regRoot = resolveProjectRootFromGlobalRegistry(root, {
      workspaceHint: root,
      allowLastUsedFallback: false,
    });
    if (regRoot) {
      return regRoot;
    }

    throw new Error(
      `Not a webnovel project root (missing .webnovel/state.json): ${root}`
    );
  }

  // 2) 环境变量
  const envRoot = process.env[ENV_WEBNOVEL_PROJECT_ROOT];
  if (envRoot) {
    const root = resolve(normalizePath(envRoot));
    if (isProjectRoot(root)) {
      return root;
    }
    throw new Error(
      `WEBNOVEL_PROJECT_ROOT is set but invalid (missing .webnovel/state.json): ${root}`
    );
  }

  const gitRoot = findGitRoot(cwd);

  // 3) workspace 指针文件
  const pointerRoot = resolveProjectRootFromPointer(cwd, gitRoot);
  if (pointerRoot) {
    return pointerRoot;
  }

  // 4) 用户级 registry
  const allowLastUsed = Boolean(process.env[ENV_CLAUDE_PROJECT_DIR]);
  const regRoot = resolveProjectRootFromGlobalRegistry(cwd, {
    allowLastUsedFallback: allowLastUsed,
  });
  if (regRoot) {
    return regRoot;
  }

  // 5) 从 CWD 向上搜索
  for (const candidate of candidateRoots(cwd, gitRoot)) {
    if (isProjectRoot(candidate)) {
      return resolve(candidate);
    }
  }

  throw new Error(
    'Unable to locate webnovel project root. Expected `.webnovel/state.json` under the current directory, ' +
    'a parent directory, or `webnovel-project/`. Run /webnovel-init first or pass --project-root / set ' +
    'WEBNOVEL_PROJECT_ROOT.'
  );
}

/**
 * 更新用户级 registry：workspace -> current_project_root 映射
 */
export function updateGlobalRegistryCurrentProject(options: {
  workspaceRoot?: string | null;
  projectRoot: string;
}): string | null {
  const root = resolve(normalizePath(options.projectRoot));
  if (!isProjectRoot(root)) {
    throw new Error(
      `Not a webnovel project root (missing .webnovel/state.json): ${root}`
    );
  }

  let ws = options.workspaceRoot;
  if (!ws) {
    const envWs = process.env[ENV_CLAUDE_PROJECT_DIR];
    if (envWs) {
      ws = normalizePath(envWs);
    }
  }
  if (!ws) {
    return null;
  }

  ws = resolve(normalizePath(ws));
  const regPath = getGlobalRegistryPath();
  const reg = loadGlobalRegistry(regPath);
  const workspaces = reg.workspaces;

  workspaces[makePathKey(ws)] = {
    workspace_root: ws,
    current_project_root: root,
    updated_at: nowIso(),
  };
  reg.last_used_project_root = root;
  saveGlobalRegistry(regPath, reg);

  return regPath;
}

/**
 * 写入 workspace 级当前项目指针
 */
export function writeCurrentProjectPointer(
  projectRoot: string,
  options?: { workspaceRoot?: string }
): string | null {
  const root = resolve(normalizePath(projectRoot));
  if (!isProjectRoot(root)) {
    throw new Error(
      `Not a webnovel project root (missing .webnovel/state.json): ${root}`
    );
  }

  let wsRoot = options?.workspaceRoot
    ? resolve(normalizePath(options.workspaceRoot))
    : findWorkspaceRootWithClaude(root);

  if (!wsRoot) {
    wsRoot = findWorkspaceRootWithClaude(resolve(process.cwd()));
  }
  if (!wsRoot) {
    // 兜底：使用项目父目录
    wsRoot = dirname(root);
  }

  let pointerFile: string | null = null;

  // 仅当工作区内已存在 .claude/ 时才写入指针
  if (existsSync(join(wsRoot, '.claude'))) {
    try {
      pointerFile = join(wsRoot, CURRENT_PROJECT_POINTER_REL);
      const pointerDir = dirname(pointerFile);
      if (!existsSync(pointerDir)) {
        mkdirSync(pointerDir, { recursive: true });
      }
      writeFileSync(pointerFile, root, 'utf-8');
    } catch {
      pointerFile = null;
    }
  }

  // best-effort 更新用户级 registry
  try {
    updateGlobalRegistryCurrentProject({
      workspaceRoot: wsRoot,
      projectRoot: root,
    });
  } catch {
    // 非阻断
  }

  return pointerFile;
}

/**
 * 解析 state.json 文件路径
 */
export function resolveStateFile(
  explicitStateFile?: string,
  options?: {
    explicitProjectRoot?: string;
    cwd?: string;
  }
): string {
  const cwd = resolve(options?.cwd || process.cwd());

  if (explicitStateFile) {
    const p = resolve(normalizePath(explicitStateFile));
    if (!p.startsWith('/')) {
      return resolve(join(cwd, p));
    }
    return p;
  }

  const root = resolveProjectRoot(options?.explicitProjectRoot, { cwd });
  return getStatePath(root);
}
