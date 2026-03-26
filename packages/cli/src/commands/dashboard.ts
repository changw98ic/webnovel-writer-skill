import ora from 'ora';
import chalk from 'chalk';
import { createDashboard } from '@webnovel-skill/dashboard';

interface DashboardOptions {
  port?: number;
}

export async function dashboardCommand(options: DashboardOptions) {
  const port = options.port || 3000;
  const projectRoot = process.cwd();

  const spinner = ora('启动 Dashboard...').start();

  try {
    const dashboard = await createDashboard({
      port,
      projectRoot,
    });

    await dashboard.start();

    spinner.succeed(`Dashboard 已启动`);

    console.log('');
    console.log(chalk.green(`🌐 Dashboard 地址: http://localhost:${port}`));
    console.log(chalk.bold('  项目路径: ') + projectRoot);
    console.log('');
    console.log(chalk.dim('按 Ctrl+C 停止服务器'));

  } catch (error) {
    spinner.fail('启动失败');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
