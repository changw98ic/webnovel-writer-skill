/**
 * where 命令 - 打印解析出的 project_root
 *
 * 与 Python 版本兼容：仅输出绝对路径字符串
 */
import { resolveProjectRoot } from '../utils/project-locator.js';

export async function whereCommand(): Promise<void> {
  // 从全局选项获取 projectRoot (通过环境变量或 commander 全局选项)
  const projectRoot = process.env.WEBNOVEL_PROJECT_ROOT;
  const root = resolveProjectRoot(projectRoot);
  console.log(root);
}
