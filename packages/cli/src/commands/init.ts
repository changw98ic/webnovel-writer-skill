import ora from 'ora';
import chalk from 'chalk';
import { StateManager } from '@changw98ic/data';

interface InitOptions {
  genre?: string;
  targetWords?: number;
  chapters?: number;
}

export async function initCommand(title: string, options: InitOptions) {
  const spinner = ora('初始化项目...').start();

  try {
    // 确定项目路径
    const projectRoot = process.cwd() + '/' + title;

    // 创建状态管理器
    const stateManager = new StateManager({ projectRoot });

    // 初始化状态
    await stateManager.initialize({
      project_info: {
        title,
        genre: options.genre || '玄幻',
        target_words: options.targetWords || 1000000,
        target_chapters: options.chapters || 100,
      },
    });

    spinner.succeed('项目初始化完成');

    // 输出项目信息
    console.log(chalk.green('\n✅ 项目创建成功!\n'));
    console.log(chalk.bold('  项目名称: ') + title);
    console.log(chalk.bold('  项目路径: ') + projectRoot);
    console.log(chalk.bold('  题材类型: ') + (options.genre || '玄幻'));
    console.log(chalk.bold('  目标字数: ') + (options.targetWords?.toLocaleString() || '100,000'));
    console.log(chalk.bold('  目标章数: ') + (options.chapters?.toLocaleString() || '100'));
    console.log('');
    console.log(chalk.dim('下一步: 运行 `webnovel plan 1` 开始规划第一章'));

  } catch (error) {
    spinner.fail('初始化失败');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
