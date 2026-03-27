import ora from 'ora';
import chalk from 'chalk';
import { StateManager } from '@changw98ic/data';

interface PlanOptions {
  detailed?: boolean;
}

export async function planCommand(chapter: string, _options: PlanOptions) {
  const spinner = ora(`规划第 ${chapter} 章大纲...`).start();

  try {
    const projectRoot = process.cwd();
    const stateManager = new StateManager({ projectRoot });

    if (!stateManager.exists()) {
      throw new Error('项目未初始化，请先运行 webnovel init');
    }

    // 解析章号范围
    parseChapterRange(chapter);

    // TODO: 实现规划逻辑
    // 1. 读取总纲和设定
    // 2. 生成章节大纲
    // 3. 写入大纲文件

    spinner.succeed(`第 ${chapter} 章大纲已生成`);

    console.log('');
    console.log(chalk.dim('下一步: 运行 `webnovel write ' + chapter + '` 开始写作'));

  } catch (error) {
    spinner.fail('规划失败');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

function parseChapterRange(input: string): number[] {
  if (input.includes('-')) {
    const [start, end] = input.split('-').map(Number);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
  return [Number(input)];
}
