/**
 * Migrate command - 数据迁移
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { execSync } from 'child_process';
import { join } from 'path';

export const migrateCommand = new Command('migrate')
  .description('数据迁移');

// State to SQLite subcommand
migrateCommand
  .command('state-to-sqlite')
  .description('迁移 state.json 中的大型数组到 SQLite')
  .option('-p, --project-root <path>', '项目根目录')
  .option('--dry-run', '仅显示将执行的操作')
  .action(async (options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());

      console.log('🔄 迁移 state.json 大型数组到 SQLite...');
      console.log(`   项目路径: ${projectRoot}`);

      const webnovelDir = join(projectRoot, '.webnovel');
      const statePath = join(webnovelDir, 'state.json');

      // Check Python migration script
      const scriptPath = findPythonScript('migrate_state_to_sqlite.py');

      if (!scriptPath) {
        console.error('❌ 未找到迁移脚本');
        process.exit(1);
      }

      const args = ['python', '-X', 'utf8', scriptPath, '--project-root', projectRoot];
      if (options.dryRun) {
        args.push('--dry-run');
      }

      const result = execSync(args[0], args.slice(1), {
        encoding: 'utf-8',
        stdio: 'inherit',
      });

      if (result.status === 0) {
        console.log('\n✅ 迁移完成');
      } else {
        console.error('❌ 迁移失败');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ 迁移失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Check Python scripts directory
function findPythonScript(scriptName: string): string | null {
  // Try different possible locations
  const possiblePaths = [
    join(process.cwd(), 'webnovel-writer', 'scripts', scriptName),
    join(process.cwd(), 'scripts', scriptName),
    join(process.cwd(), '..', 'webnovel-writer', 'scripts', scriptName),
  ];

  for (const path of possiblePaths) {
    try {
      const result = execSync('test', ['-f', path], { stdio: 'pipe' });
      if (result.status === 0) return path;
    } catch {
      // Continue to next path
    }
  }

  return null;
}
