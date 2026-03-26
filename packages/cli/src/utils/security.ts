/**
 * 安全工具函数
 *
 * 迁移自 Python security_utils.py
 * 提供文件名清洗、原子写入、Git 操作封装
 */
import { spawn, spawnSync } from 'child_process';
import { existsSync, mkdirSync, renameSync, unlinkSync, copyFileSync, readFileSync, writeFileSync, fsyncSync, openSync, closeSync } from 'fs';
import { basename, dirname, join, extname } from 'path';
import { randomUUID } from 'crypto';

// ============================================================================
// 文件名清洗
// ============================================================================

/**
 * 清理文件名，防止路径遍历攻击 (CWE-22)
 *
 * @param name 原始文件名（可能包含路径遍历字符）
 * @param maxLength 文件名最大长度（默认 100 字符）
 * @returns 安全的文件名
 */
export function sanitizeFilename(name: string, maxLength = 100): string {
  // Step 1: 仅保留基础文件名（移除所有路径）
  let safeName = basename(name);

  // Step 2: 移除路径分隔符（双重保险）
  safeName = safeName.replace(/[/\\]/g, '_');

  // Step 3: 只保留安全字符
  // 允许：中文(\u4e00-\u9fff)、字母(a-zA-Z)、数字(0-9)、下划线(_)、连字符(-)
  safeName = safeName.replace(/[^\w\u4e00-\u9fff-]/g, '_');

  // Step 4: 移除连续的下划线（美化）
  safeName = safeName.replace(/_+/g, '_');

  // Step 5: 长度限制
  if (safeName.length > maxLength) {
    safeName = safeName.slice(0, maxLength);
  }

  // Step 6: 移除首尾下划线
  safeName = safeName.replace(/^_+|_+$/g, '');

  // Step 7: 确保非空
  if (!safeName) {
    safeName = 'unnamed_entity';
  }

  return safeName;
}

/**
 * 清理 Git 提交消息，防止命令注入 (CWE-77)
 *
 * @param message 原始提交消息
 * @param maxLength 消息最大长度（默认 200 字符）
 * @returns 安全的提交消息
 */
export function sanitizeCommitMessage(message: string, maxLength = 200): string {
  // Step 1: 移除换行符（防止多行参数注入）
  let safeMsg = message.replace(/[\n\r]/g, ' ');

  // Step 2: 移除 Git 特殊标志（--开头的参数）
  safeMsg = safeMsg.replace(/--[\w-]+/g, '');

  // Step 3: 移除引号（防止参数分隔符混淆）
  safeMsg = safeMsg.replace(/['"]/g, '');

  // Step 4: 移除前导的 -（防止单字母标志如 -m）
  safeMsg = safeMsg.replace(/^-+/, '');

  // Step 5: 移除连续空格
  safeMsg = safeMsg.replace(/\s+/g, ' ');

  // Step 6: 长度限制
  if (safeMsg.length > maxLength) {
    safeMsg = safeMsg.slice(0, maxLength);
  }

  // Step 7: 移除首尾空格
  safeMsg = safeMsg.trim();

  // Step 8: 确保非空
  if (!safeMsg) {
    safeMsg = 'Untitled commit';
  }

  return safeMsg;
}

// ============================================================================
// Git 操作
// ============================================================================

let gitAvailable: boolean | null = null;

/**
 * 检测 Git 是否可用
 */
export function isGitAvailable(): boolean {
  if (gitAvailable !== null) {
    return gitAvailable;
  }

  try {
    const result = spawnSync('git', ['--version'], {
      timeout: 5000,
      encoding: 'utf-8',
      windowsHide: true,
    });
    gitAvailable = result.status === 0;
  } catch {
    gitAvailable = false;
  }

  return gitAvailable;
}

/**
 * 检测指定目录是否是 Git 仓库
 */
export function isGitRepo(path: string): boolean {
  if (!isGitAvailable()) {
    return false;
  }
  return existsSync(join(path, '.git'));
}

interface GitOperationResult {
  success: boolean;
  output: string;
  wasSkipped: boolean;
}

/**
 * 优雅执行 Git 操作
 */
export async function gitGracefulOperation(
  args: string[],
  cwd: string,
  fallbackMsg = 'Git 不可用，跳过版本控制操作'
): Promise<GitOperationResult> {
  if (!isGitAvailable()) {
    console.warn(`⚠️  ${fallbackMsg}`);
    return { success: false, output: '', wasSkipped: true };
  }

  return new Promise((resolve) => {
    const proc = spawn('git', args, {
      cwd,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.setEncoding('utf-8');
    proc.stdout?.on('data', (data: string) => {
      stdout += data;
    });

    proc.stderr?.setEncoding('utf-8');
    proc.stderr?.on('data', (data: string) => {
      stderr += data;
    });

    proc.on('close', (code: number | null) => {
      resolve({
        success: code === 0,
        output: stdout || stderr,
        wasSkipped: false,
      });
    });

    proc.on('error', (err: Error) => {
      console.warn(`⚠️  Git 操作失败: ${err.message}`);
      resolve({
        success: false,
        output: err.message,
        wasSkipped: false,
      });
    });
  });
}

/**
 * Git add
 */
export async function gitAdd(files: string[], cwd: string): Promise<GitOperationResult> {
  return gitGracefulOperation(['add', ...files], cwd, 'Git 不可用，跳过 add 操作');
}

/**
 * Git commit
 */
export async function gitCommit(message: string, cwd: string): Promise<GitOperationResult> {
  const safeMessage = sanitizeCommitMessage(message);
  return gitGracefulOperation(['commit', '-m', safeMessage], cwd, 'Git 不可用，跳过 commit 操作');
}

/**
 * Git status
 */
export async function gitStatus(cwd: string): Promise<string[]> {
  const result = await gitGracefulOperation(['status', '--porcelain'], cwd);
  if (!result.success || !result.output) {
    return [];
  }
  return result.output.trim().split('\n').filter(Boolean);
}

// ============================================================================
// 原子化文件写入
// ============================================================================

export class AtomicWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AtomicWriteError';
  }
}

/**
 * 原子化写入 JSON 文件
 *
 * 实现策略：
 * 1. 写入临时文件（同目录）
 * 2. 可选：备份原文件
 * 3. 原子重命名
 */
export function writeJsonAtomic(
  filePath: string,
  data: unknown,
  options?: {
    backup?: boolean;
    indent?: number;
  }
): void {
  const { backup = true, indent = 2 } = options ?? {};

  const parentDir = dirname(filePath);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  // 准备 JSON 内容
  let jsonContent: string;
  try {
    jsonContent = JSON.stringify(data, null, indent);
  } catch (err) {
    throw new AtomicWriteError(`JSON 序列化失败: ${err}`);
  }

  // 创建临时文件
  const tempFileName = `${basename(filePath, extname(filePath))}_${randomUUID()}.tmp`;
  const tempPath = join(parentDir, tempFileName);
  const backupPath = filePath + '.bak';

  try {
    // Step 1: 写入临时文件
    writeFileSync(tempPath, jsonContent, 'utf-8');

    // 确保写入磁盘
    const fd = openSync(tempPath, 'r');
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }

    // Step 2: 备份原文件（如果存在且启用备份）
    if (backup && existsSync(filePath)) {
      try {
        copyFileSync(filePath, backupPath);
      } catch {
        // 备份失败不阻止写入
      }
    }

    // Step 3: 原子重命名
    renameSync(tempPath, filePath);
  } catch (err) {
    // 清理临时文件
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
    } catch {
      // 忽略清理错误
    }
    throw new AtomicWriteError(`原子写入失败: ${err}`);
  }
}

/**
 * 安全读取 JSON 文件
 */
export function readJsonSafe<T = Record<string, unknown>>(
  filePath: string,
  defaultValue?: T
): T {
  const fallback = defaultValue ?? ({} as T);

  if (!existsSync(filePath)) {
    return fallback;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err) {
    console.warn(`⚠️ 读取 JSON 失败 (${filePath}): ${err}`);
    return fallback;
  }
}

/**
 * 从备份恢复文件
 */
export function restoreFromBackup(filePath: string): boolean {
  const backupPath = filePath + '.bak';

  if (!existsSync(backupPath)) {
    console.warn(`⚠️ 备份文件不存在: ${backupPath}`);
    return false;
  }

  try {
    copyFileSync(backupPath, filePath);
    console.log(`✅ 已从备份恢复: ${filePath}`);
    return true;
  } catch (err) {
    console.error(`❌ 恢复失败: ${err}`);
    return false;
  }
}

// ============================================================================
// 整数验证
// ============================================================================

/**
 * 验证并转换整数输入
 */
export function validateIntegerInput(value: string, fieldName: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    const error = `${fieldName} 必须是整数，收到: ${value}`;
    console.error(`❌ 错误：${error}`);
    throw new Error(`Invalid integer input for ${fieldName}: ${value}`);
  }

  return parsed;
}
