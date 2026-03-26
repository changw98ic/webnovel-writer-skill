/**
 * use 命令 - 绑定当前工作区使用的书项目
 *
 * 与 Python 版本兼容的输出格式
 */
import {
  writeCurrentProjectPointer,
  updateGlobalRegistryCurrentProject,
} from '../utils/project-locator.js';
import { normalizePath } from '../utils/path-compat.js';
import { resolve } from 'path';

export interface UseOptions {
  workspaceRoot?: string;
}

export async function useCommand(
  projectRoot: string,
  options: UseOptions
): Promise<void> {
  const root = resolve(normalizePath(projectRoot));

  // 1) 写入工作区指针（若工作区内存在 .claude/）
  const pointerFile = writeCurrentProjectPointer(root, {
    workspaceRoot: options.workspaceRoot,
  });

  if (pointerFile) {
    console.log(`workspace pointer: ${pointerFile}`);
  } else {
    console.log('workspace pointer: (skipped)');
  }

  // 2) 写入用户级 registry（保证全局安装/空上下文可恢复）
  const regPath = updateGlobalRegistryCurrentProject({
    workspaceRoot: options.workspaceRoot,
    projectRoot: root,
  });

  if (regPath) {
    console.log(`global registry: ${regPath}`);
  } else {
    console.log('global registry: (skipped)');
  }
}
