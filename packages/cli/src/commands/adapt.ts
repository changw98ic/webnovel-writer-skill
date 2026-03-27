import ora from 'ora';
import chalk from 'chalk';
import { adapt, Platform } from '@changw98ic/adapters';
import type { Skill } from '@changw98ic/core';
import * as fs from 'fs';
import * as path from 'path';

interface AdaptOptions {
  platform: Platform;
  output: string;
}

const DIRECT_BUNDLE_PLATFORMS = new Set<Platform>(['openclaw', 'codex', 'opencode']);

// 内置 Skills（简化版）
const builtinSkills: Skill[] = [
  {
    name: 'webnovel-init',
    version: '1.0.0',
    description: '深度初始化网文项目',
    license: 'GPL-3.0',
    triggers: ['/webnovel-init', '/init'],
    tools: [
      { name: 'Read', type: 'read', description: '读取文件', required: true },
      { name: 'Write', type: 'write', description: '写入文件', required: true },
      { name: 'Bash', type: 'bash', description: '执行命令', required: false },
      { name: 'AskUserQuestion', type: 'ask', description: '用户交互', required: false },
    ],
    prompts: [
      { role: 'system', content: '你是一个专业的网文创作助手...' },
    ],
    workflow: [
      { step: 'Step 0', action: '预检与环境设置', tools: ['Bash'], optional: false, onFailure: 'abort' },
      { step: 'Step 1', action: '故事核与商业定位', tools: ['Read', 'Write', 'AskUserQuestion'], optional: false, onFailure: 'abort' },
    ],
  },
  {
    name: 'webnovel-plan',
    version: '1.0.0',
    description: '规划章节大纲',
    license: 'GPL-3.0',
    triggers: ['/webnovel-plan', '/plan'],
    tools: [
      { name: 'Read', type: 'read', required: true },
      { name: 'Write', type: 'write', required: true },
      { name: 'Grep', type: 'grep', required: false },
    ],
    prompts: [
      { role: 'system', content: '你是一个专业的网文创作助手...' },
    ],
    workflow: [
      { step: 'Step 1', action: '读取总纲与设定', tools: ['Read'], optional: false, onFailure: 'abort' },
      { step: 'Step 2', action: '生成章节大纲', tools: ['Write'], optional: false, onFailure: 'abort' },
    ],
  },
  {
    name: 'webnovel-write',
    version: '1.0.0',
    description: '写作章节',
    license: 'GPL-3.0',
    triggers: ['/webnovel-write', '/write'],
    tools: [
      { name: 'Read', type: 'read', required: true },
      { name: 'Write', type: 'write', required: true },
      { name: 'Edit', type: 'edit', required: false },
      { name: 'Bash', type: 'bash', required: false },
      { name: 'Task', type: 'task', required: false },
    ],
    prompts: [
      { role: 'system', content: '你是一个专业的网文创作助手...' },
    ],
    workflow: [
      { step: 'Step 0', action: '预检与上下文加载', tools: ['Bash'], optional: false, onFailure: 'abort' },
      { step: 'Step 1', action: 'Context Agent', tools: ['Task'], optional: false, onFailure: 'abort' },
      { step: 'Step 2', action: '起草正文', tools: ['Write'], optional: false, onFailure: 'abort' },
      { step: 'Step 3', action: '审查', tools: ['Task'], optional: true, onFailure: 'continue' },
      { step: 'Step 4', action: '润色', tools: ['Edit'], optional: true, onFailure: 'continue' },
      { step: 'Step 5', action: 'Data Agent', tools: ['Task'], optional: false, onFailure: 'skip' },
    ],
  },
];

export async function adaptCommand(options: AdaptOptions) {
  const spinner = ora(`生成 ${options.platform} 适配文件...`).start();

  try {
    if (!fs.existsSync(options.output)) {
      fs.mkdirSync(options.output, { recursive: true });
    }

    const useDirectBundle = DIRECT_BUNDLE_PLATFORMS.has(options.platform);
    const result = adapt({
      platform: options.platform,
      outputDir: options.output,
      skills: useDirectBundle ? [] : builtinSkills,
    });

    for (const file of result.files) {
      const filePath = path.join(options.output, file.path);
      const dir = path.dirname(filePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, file.content, 'utf-8');
      console.log(chalk.green(`  ✓ ${file.path}`));
    }

    spinner.succeed('适配文件生成完成');

    const skillCount = getNumericMetadata(result.metadata, 'skillCount') ?? builtinSkills.length;
    const bundleRoot = getStringMetadata(result.metadata, 'bundleRoot');
    const sourceRoot = getStringMetadata(result.metadata, 'sourceRoot');
    const nativePluginRoot = getStringMetadata(result.metadata, 'nativePluginRoot');

    console.log('');
    console.log(chalk.dim(`输出目录: ${options.output}`));
    console.log(chalk.dim(`平台: ${options.platform}`));
    console.log(chalk.dim(`模式: ${useDirectBundle ? '直接可用 bundle' : '内置 Skill 适配'}`));
    console.log(chalk.dim(`Skills: ${skillCount} 个`));

    if (bundleRoot) {
      console.log(chalk.dim(`Bundle 根目录: ${bundleRoot}`));
    }

    if (sourceRoot) {
      console.log(chalk.dim(`运行时资源: ${sourceRoot}`));
    }

    if (nativePluginRoot) {
      console.log(chalk.dim(`Native plugin: ${nativePluginRoot}`));
    }
  } catch (error) {
    spinner.fail('生成失败');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

function getNumericMetadata(metadata: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = metadata?.[key];
  return typeof value === 'number' ? value : undefined;
}

function getStringMetadata(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}
