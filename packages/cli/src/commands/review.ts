import ora from 'ora';
import chalk from 'chalk';
import { StateManager } from '@changw98ic/data';

interface ReviewOptions {
  detailed?: boolean;
}

export async function reviewCommand(range: string, options: ReviewOptions) {
  const spinner = ora(`审查第 ${range} 章...`).start();

  try {
    const projectRoot = process.cwd();
    const stateManager = new StateManager({ projectRoot });

    if (!stateManager.exists()) {
      throw new Error('项目未初始化，请先运行 webnovel init');
    }

    // 解析范围
    parseChapterRange(range);

    // TODO: 实现审查逻辑
    // 1. 读取章节正文
    // 2. 运行六维审查器
    // 3. 生成审查报告
    // 4. 保存审查指标

    spinner.succeed(`第 ${range} 章审查完成`);

    console.log('');
    if (options.detailed) {
      console.log(chalk.dim('审查报告已保存到: 审查报告/'));
    }

  } catch (error) {
    spinner.fail('审查失败');
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
