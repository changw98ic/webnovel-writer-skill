import ora from 'ora';
import chalk from 'chalk';
import { StateManager } from '@webnovel-skill/data';

interface WriteOptions {
  fast?: boolean;
  minimal?: boolean;
}

export async function writeCommand(chapter: string, options: WriteOptions) {
  const spinner = ora(`写作第 ${chapter} 章...`).start();

  try {
    const projectRoot = process.cwd();
    const stateManager = new StateManager({ projectRoot });

    if (!stateManager.exists()) {
      throw new Error('项目未初始化，请先运行 webnovel init');
    }

    // 模式选择
    const mode = options.fast ? 'fast' : options.minimal ? 'minimal' : 'standard';
    console.log(chalk.dim(`模式: ${mode}`));

    // TODO: 实现写作逻辑
    // Step 1: Context Agent
    // Step 2A: 起草正文
    // Step 2B: 风格适配 (标准模式)
    // Step 3: 审查
    // Step 4: 润色
    // Step 5: Data Agent
    // Step 6: Git 备份

    spinner.succeed(`第 ${chapter} 章写作完成`);

    console.log('');
    console.log(chalk.dim('下一步: 运行 `webnovel review ' + chapter + '` 进行审查'));

  } catch (error) {
    spinner.fail('写作失败');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
