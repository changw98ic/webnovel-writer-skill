/**
 * preflight 命令 - 校验运行环境与 project_root
 *
 * 与 Python 版本兼容的输出格式
 */
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { printSuccess } from '../utils/output.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface PreflightOptions {
  projectRoot?: string;
  format?: 'text' | 'json';
}

interface PreflightCheck {
  name: string;
  ok: boolean;
  path?: string;
  error?: string;
}

interface PreflightReport {
  ok: boolean;
  project_root: string;
  scripts_dir: string;
  skill_root: string;
  checks: PreflightCheck[];
  project_root_error?: string;
}

function buildPreflightReport(explicitProjectRoot?: string): PreflightReport {
  const cliDir = join(__dirname, '..');
  const packagesDir = join(cliDir, '..', '..');
  const pluginRoot = join(packagesDir, '..');
  const skillRoot = join(pluginRoot, 'webnovel-writer', 'skills', 'webnovel-write');

  const checks: PreflightCheck[] = [
    {
      name: 'cli_dir',
      ok: existsSync(cliDir),
      path: cliDir,
    },
    {
      name: 'plugin_root',
      ok: existsSync(pluginRoot),
      path: pluginRoot,
    },
    {
      name: 'skill_root',
      ok: existsSync(skillRoot),
      path: skillRoot,
    },
  ];

  let projectRoot = '';
  let projectRootError: string | undefined;

  try {
    const resolvedRoot = resolveProjectRoot(explicitProjectRoot);
    projectRoot = resolvedRoot;
    checks.push({
      name: 'project_root',
      ok: true,
      path: projectRoot,
    });
  } catch (err) {
    projectRootError = err instanceof Error ? err.message : String(err);
    checks.push({
      name: 'project_root',
      ok: false,
      path: explicitProjectRoot || '',
      error: projectRootError,
    });
  }

  return {
    ok: checks.every((c) => c.ok),
    project_root: projectRoot,
    scripts_dir: cliDir,
    skill_root: skillRoot,
    checks,
    project_root_error: projectRootError,
  };
}

export async function preflightCommand(options: PreflightOptions): Promise<void> {
  const report = buildPreflightReport(options.projectRoot);

  if (options.format === 'json') {
    printSuccess(report, 'preflight');
  } else {
    for (const check of report.checks) {
      const status = check.ok ? 'OK' : 'ERROR';
      const path = check.path || '';
      console.log(`${status} ${check.name}: ${path}`);
      if (check.error) {
        console.log(`  detail: ${check.error}`);
      }
    }
  }

  process.exit(report.ok ? 0 : 1);
}
