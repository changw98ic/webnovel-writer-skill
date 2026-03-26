import ora from 'ora';
import chalk from 'chalk';
import { StateManager, IndexManager } from '@webnovel-skill/data';

interface QueryOptions {
  type?: string;
}

export async function queryCommand(keyword: string, options: QueryOptions) {
  const spinner = ora(`查询 "${keyword}"...`).start();

  try {
    const projectRoot = process.cwd();
    const stateManager = new StateManager({ projectRoot });
    const indexManager = new IndexManager({ projectRoot });

    if (!stateManager.exists()) {
      throw new Error('项目未初始化，请先运行 webnovel init');
    }

    const state = await stateManager.loadState();

    // 根据查询类型执行不同查询
    switch (options.type) {
      case 'entity':
        await queryEntities(indexManager, keyword);
        break;

      case 'foreshadowing':
        await queryForeshadowing(state, keyword);
        break;

      case 'debt':
        await queryDebt(state, keyword);
        break;

      default:
        // 默认：综合查询
        await queryAll(state, indexManager, keyword);
    }

    spinner.succeed('查询完成');

  } catch (error) {
    spinner.fail('查询失败');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

async function queryEntities(indexManager: IndexManager, keyword: string) {
  const entities = await indexManager.searchEntities(keyword, 10);

  console.log('');
  console.log(chalk.bold(`找到 ${entities.length} 个相关实体:`));

  for (const entity of entities) {
    console.log(`  - ${entity.canonical_name} (${entity.type})`);
  }
}

async function queryForeshadowing(state: any, keyword: string) {
  const foreshadowing = state.plot_threads?.foreshadowing || [];
  const active = foreshadowing.filter((f: any) =>
    f.status === 'active' &&
    f.content.toLowerCase().includes(keyword.toLowerCase())
  );

  console.log('');
  console.log(chalk.bold(`找到 ${active.length} 个活跃伏笔:`));

  for (const f of active) {
    console.log(`  - [第${f.planted_chapter}章] ${f.content}`);
  }
}

async function queryDebt(_state: any, _keyword: string) {
  console.log('');
  console.log(chalk.dim('追读力债务查询功能待实现'));
}

async function queryAll(state: any, indexManager: IndexManager, keyword: string) {
  console.log('');
  console.log(chalk.bold(`查询: "${keyword}"`));
  console.log('');

  // 查询实体
  const entities = await indexManager.searchEntities(keyword, 5);
  if (entities.length > 0) {
    console.log(chalk.cyan('相关实体:'));
    for (const e of entities) {
      console.log(`  - ${e.canonical_name} (${e.type})`);
    }
  }

  // 查询伏笔
  const foreshadowing = state.plot_threads?.foreshadowing || [];
  const related = foreshadowing.filter((f: any) =>
    f.content.toLowerCase().includes(keyword.toLowerCase())
  );
  if (related.length > 0) {
    console.log('');
    console.log(chalk.cyan('相关伏笔:'));
    for (const f of related) {
      console.log(`  - [第${f.planted_chapter}章] ${f.content}`);
    }
  }
}
