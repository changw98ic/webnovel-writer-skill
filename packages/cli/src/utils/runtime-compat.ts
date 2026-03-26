/**
 * 运行时兼容性工具
 *
 * 迁移自 Python runtime_compat.py
 * 处理 Windows UTF-8 stdio 和跨平台路径规范化
 */
import { platform } from 'os';
import { normalize, resolve } from 'path';

const isWindows = platform() === 'win32';

// Windows POSIX 风格路径正则（Git Bash / MSYS 风格）
const WIN_POSIX_DRIVE_RE = /^\/([a-zA-Z])\/(.*)$/;
// WSL 挂载路径正则
const WIN_WSL_MNT_DRIVE_RE = /^\/mnt\/([a-zA-Z])\/(.*)$/;

/**
 * 在 Windows 上启用 UTF-8 stdio
 *
 * Node.js 默认在 Windows 上使用 UTF-8，但控制台可能需要设置
 * 此函数主要用于打印前的编码确保
 */
export function setupWindowsUtf8(): boolean {
  if (!isWindows) {
    return false;
  }

  // Node.js 在 Windows 上默认使用 UTF-8，无需额外设置
  // 但可以设置控制台代码页为 UTF-8
  try {
    // 通过环境变量抑制编码警告
    if (!process.env.NODE_OPTIONS?.includes('--no-warnings')) {
      process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --no-warnings';
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 规范化 Windows 上的 POSIX 风格路径
 *
 * 处理以下格式：
 * - Git Bash / MSYS: /d/desktop/... => D:/desktop/...
 * - WSL: /mnt/d/desktop/... => D:/desktop/...
 *
 * @param path 原始路径
 * @returns 规范化后的路径
 */
export function normalizeWindowsPath(path: string): string {
  if (!isWindows) {
    return normalize(path);
  }

  const raw = path.trim();
  if (!raw) {
    return raw;
  }

  // WSL 挂载路径: /mnt/d/... => D:/...
  let match = raw.match(WIN_WSL_MNT_DRIVE_RE);
  if (match) {
    const drive = match[1].toUpperCase();
    const rest = match[2];
    return normalize(`${drive}:/${rest}`);
  }

  // Git Bash / MSYS 路径: /d/... => D:/...
  match = raw.match(WIN_POSIX_DRIVE_RE);
  if (match) {
    const drive = match[1].toUpperCase();
    const rest = match[2];
    return normalize(`${drive}:/${rest}`);
  }

  return normalize(path);
}

/**
 * 跨平台路径规范化
 *
 * 统一处理不同来源的路径格式
 */
export function normalizePathCrossPlatform(path: string): string {
  // 先处理 Windows 特殊格式
  let normalized = normalizeWindowsPath(path);
  // 再规范化
  return resolve(normalized);
}

/**
 * 获取安全的 stdio 编码
 *
 * Node.js 默认 UTF-8，此函数返回编码名称供参考
 */
export function getStdioEncoding(): string {
  return 'utf-8';
}

/**
 * 检测是否在 WSL 环境中运行
 */
export function isWsl(): boolean {
  if (!isWindows && process.platform === 'linux') {
    // 检测 WSL 环境
    try {
      const fs = require('fs');
      const release = fs.readFileSync('/proc/version', 'utf-8');
      return release.toLowerCase().includes('microsoft');
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * 获取平台特定的换行符
 */
export function getNewline(): string {
  return isWindows ? '\r\n' : '\n';
}
