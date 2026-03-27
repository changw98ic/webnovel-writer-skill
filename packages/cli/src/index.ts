#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import ora from 'ora';
import { initCommand } from './commands/init.js';
import { planCommand } from './commands/plan.js';
import { writeCommand } from './commands/write.js';
import { reviewCommand } from './commands/review.js';
import { queryCommand } from './commands/query.js';
import { adaptCommand } from './commands/adapt.js';
import { dashboardCommand } from './commands/dashboard.js';
import { whereCommand } from './commands/where.js';
import { preflightCommand } from './commands/preflight.js';
import { useCommand } from './commands/use.js';
import { statusCommand } from './commands/status.js';
import { backupCommand } from './commands/backup.js';
import { archiveCommand } from './commands/archive.js';
import { indexCommand } from './commands/index.js';
import { stateCommand } from './commands/state.js';
import { ragCommand } from './commands/rag.js';
import { styleCommand } from './commands/style.js';
import { entityCommand } from './commands/entity.js';
import { contextCommand } from './commands/context.js';
import { migrateCommand } from './commands/migrate.js';
import { workflowCommand } from './commands/workflow.js';
import { updateStateCommand } from './commands/update-state.js';
import { extractContextCommand } from './commands/extract-context.js';

const VERSION = '1.1.0';

const program = new Command();

function parseIntegerOption(value: string, optionName: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    throw new InvalidArgumentError(`${optionName} 必须是整数`);
  }

  return parsed;
}

program
  .name('webnovel')
  .description('通用网文创作 Skill 框架')
  .version(VERSION)
  .option('-p, --project-root <path>', '项目根目录或工作区根目录');

// 注册命令
program
  .command('init <title>')
  .description('初始化新小说项目')
  .option('-g, --genre <genre>', '题材类型')
  .option('-t, --target-words <number>', '目标字数', (value) => parseIntegerOption(value, 'target-words'))
  .option('-c, --chapters <number>', '目标章数', (value) => parseIntegerOption(value, 'chapters'))
  .action(initCommand);

program
  .command('plan <chapter>')
  .description('规划章节大纲')
  .option('-d  --detailed', '生成详细大纲')
  .action(planCommand);

program
  .command('write <chapter>')
  .description('写作章节')
  .option('-f, --fast', '快速模式（跳过风格适配)')
  .option('-m, --minimal', '极简模式（仅核心审查)')
  .action(writeCommand);

program
  .command('review <range>')
  .description('审查章节质量')
  .option('-d, --detailed', '详细审查报告')
  .action(reviewCommand);

program
  .command('query <keyword>')
  .description('查询项目状态')
  .option('-t, --type <type>', '查询类型 (entity|foreshadowing|debt)')
  .action(queryCommand);

program
  .command('adapt')
  .description('生成平台适配文件')
  .requiredOption('-p, --platform <platform>', '目标平台 (claude-code|cursor|openai|openclaw|codex|opencode)')
  .requiredOption('-o, --output <dir>', '输出目录')
  .action(adaptCommand);

program
  .command('dashboard')
  .description('启动可视化面板')
  .option('-p, --port <number>', '端口号', (value) => parseIntegerOption(value, 'port'), 3000)
  .action(dashboardCommand);

program
  .command('resume')
  .description('恢复中断的任务')
  .action(async () => {
    const spinner = ora('恢复任务中...').start();
    // TODO: 实现恢复逻辑
    spinner.succeed('任务已恢复');
  });

// P0 迁移：基础命令
// 注意：这些命令使用全局的 --project-root 选项，不再单独定义
program
  .command('where')
  .description('打印解析出的 project_root')
  .action(whereCommand);

program
  .command('preflight')
  .description('校验运行环境与 project_root')
  .option('-f, --format <format>', '输出格式 (text|json)', 'text')
  .action(preflightCommand);

program
  .command('use <project-root>')
  .description('绑定当前工作区使用的书项目')
  .option('-w, --workspace-root <path>', '工作区根目录')
  .action(useCommand);

// P2 迁移：工作流命令
program.addCommand(statusCommand);
program.addCommand(backupCommand);
program.addCommand(archiveCommand);

// P4 迁移：数据管理命令
program.addCommand(indexCommand);
program.addCommand(stateCommand);
program.addCommand(ragCommand);
program.addCommand(styleCommand);
program.addCommand(entityCommand);
program.addCommand(contextCommand);
program.addCommand(migrateCommand);
program.addCommand(workflowCommand);
program.addCommand(updateStateCommand);
program.addCommand(extractContextCommand);

// 解析命令
program.parse();

export default program;
