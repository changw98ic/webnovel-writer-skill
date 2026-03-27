import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUNDLE_DIRECTORIES = [
  'skills',
  'references',
  'agents',
  'scripts',
  'templates',
  'dashboard',
  'genres',
] as const;

const SKIP_DIRS = new Set(['node_modules', 'dist', '__pycache__']);
const SKIP_FILES = new Set(['.DS_Store']);
const BOOTSTRAP_MARKER = '<!-- generated: webnovel bundle bootstrap -->';
const OPENCLAW_NATIVE_PLUGIN_DIR = 'openclaw-plugin';
const OPENCLAW_PLUGIN_ID = 'webnovel-writer-skill';
const OPENCLAW_PLUGIN_PACKAGE_NAME = '@changw98ic/openclaw-webnovel-writer-skill';
const DEFAULT_PLUGIN_VERSION = '1.0.0';

type BundleProfile = 'bundle' | 'native-plugin';
type BundleFileKind = 'skill' | 'agent';

export type BundlePlatform = 'codex' | 'opencode' | 'openclaw';

export interface BundleFileOutput {
  path: string;
  content: string;
}

export interface BundleMetadata {
  mode: 'bundle';
  platform: BundlePlatform;
  bundleRoot: string;
  sourceRoot: string;
  skillCount: number;
  fileCount: number;
  directories: string[];
  nativePluginRoot?: string;
}

export interface BundleOutput {
  files: BundleFileOutput[];
  metadata: BundleMetadata;
}

export function generateBundle(platform: BundlePlatform): BundleOutput {
  const sourceRoot = resolveRuntimeAssetRoot();
  const bundleRoot = getBundleRoot(platform);
  const files: BundleFileOutput[] = [];

  files.push({
    path: joinBundlePath(bundleRoot, 'webnovel-bootstrap-env.sh'),
    content: buildBootstrapScript(),
  });

  files.push({
    path: joinBundlePath(bundleRoot, 'WEBNOVEL_BUNDLE.md'),
    content: buildBundleReadme(platform),
  });

  files.push(...collectRuntimeFiles(sourceRoot, bundleRoot, platform, 'bundle'));

  let nativePluginRoot: string | undefined;

  if (platform === 'openclaw') {
    nativePluginRoot = OPENCLAW_NATIVE_PLUGIN_DIR;
    files.push(...generateOpenClawNativePluginFiles(sourceRoot));
  }

  return {
    files,
    metadata: {
      mode: 'bundle',
      platform,
      bundleRoot,
      sourceRoot,
      skillCount: countSkills(sourceRoot),
      fileCount: files.length,
      directories: [...BUNDLE_DIRECTORIES],
      nativePluginRoot,
    },
  };
}

function generateOpenClawNativePluginFiles(sourceRoot: string): BundleFileOutput[] {
  const pluginRoot = OPENCLAW_NATIVE_PLUGIN_DIR;
  const files: BundleFileOutput[] = [
    {
      path: joinBundlePath(pluginRoot, 'openclaw.plugin.json'),
      content: buildOpenClawManifest(),
    },
    {
      path: joinBundlePath(pluginRoot, 'package.json'),
      content: buildOpenClawPackageJson(),
    },
    {
      path: joinBundlePath(pluginRoot, 'index.ts'),
      content: buildOpenClawEntryPoint(),
    },
    {
      path: joinBundlePath(pluginRoot, 'webnovel-bootstrap-env.sh'),
      content: buildBootstrapScript(),
    },
    {
      path: joinBundlePath(pluginRoot, 'README.md'),
      content: buildOpenClawPluginReadme(),
    },
  ];

  files.push(...collectRuntimeFiles(sourceRoot, pluginRoot, 'openclaw', 'native-plugin'));

  return files;
}

function collectRuntimeFiles(
  sourceRoot: string,
  destinationRoot: string,
  platform: BundlePlatform,
  profile: BundleProfile,
): BundleFileOutput[] {
  const files: BundleFileOutput[] = [];

  for (const directory of BUNDLE_DIRECTORIES) {
    const sourceDir = path.join(sourceRoot, directory);

    if (!fs.existsSync(sourceDir)) {
      continue;
    }

    for (const absolutePath of walkFiles(sourceDir)) {
      const relativePath = toPosixPath(path.relative(sourceRoot, absolutePath));
      const outputPath = joinBundlePath(destinationRoot, relativePath);
      let content = fs.readFileSync(absolutePath, 'utf-8');
      const bootstrapTarget = getBootstrapTarget(platform, relativePath, profile);

      if (bootstrapTarget) {
        content = injectBootstrapNotice(content, platform, bootstrapTarget);
      }

      files.push({
        path: outputPath,
        content,
      });
    }
  }

  return files;
}

function resolveRuntimeAssetRoot(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(currentDir, '../runtime/webnovel-writer'),
    path.resolve(currentDir, '../../../../webnovel-writer'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`未找到 webnovel-writer 运行时资源目录，已检查: ${candidates.join(', ')}`);
}

function getBundleRoot(platform: BundlePlatform): string {
  switch (platform) {
    case 'codex':
      return '.codex';
    case 'opencode':
      return '.opencode';
    case 'openclaw':
      return '.';
    default:
      return assertNever(platform);
  }
}

function buildBootstrapScript(): string {
  return [
    '#!/usr/bin/env bash',
    '# 兼容 webnovel-writer 原始 Skill / Agent 中的 Claude Plugin 路径约定。',
    'set -euo pipefail',
    '',
    'WEBNOVEL_BOOTSTRAP_SOURCE="${BASH_SOURCE[0]:-$0}"',
    'WEBNOVEL_BUNDLE_ROOT_DEFAULT="$(cd -- "$(dirname -- "$WEBNOVEL_BOOTSTRAP_SOURCE")" && pwd)"',
    '',
    'export CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"',
    'export WEBNOVEL_BUNDLE_ROOT="${WEBNOVEL_BUNDLE_ROOT:-$WEBNOVEL_BUNDLE_ROOT_DEFAULT}"',
    'export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$WEBNOVEL_BUNDLE_ROOT}"',
    '',
    'echo "[webnovel-writer] CLAUDE_PROJECT_DIR=$CLAUDE_PROJECT_DIR"',
    'echo "[webnovel-writer] CLAUDE_PLUGIN_ROOT=$CLAUDE_PLUGIN_ROOT"',
    '',
  ].join('\n');
}

function buildBundleReadme(platform: BundlePlatform): string {
  const bootstrapPath = getBundleReadmeBootstrapPath(platform);
  const bundleRoot = getBundleRoot(platform);
  const lines = [
    `# Webnovel Writer ${platform} bundle`,
    '',
    '这是由 `webnovel adapt` 生成的直接可用运行时 bundle。',
    '',
    '## 目录说明',
    '',
    `- bundle 根目录：\`${bundleRoot}\``,
    '- 核心目录：`skills/`、`agents/`、`references/`、`scripts/`、`templates/`、`dashboard/`、`genres/`',
    '',
    '## 使用前先执行',
    '',
    '```bash',
    `source "${bootstrapPath}"`,
    '```',
    '',
    '上面的脚本会设置：',
    '',
    '- `CLAUDE_PROJECT_DIR`：默认取当前工作目录',
    '- `CLAUDE_PLUGIN_ROOT`：自动指向当前 bundle 根目录',
    '',
    '之后即可直接使用 bundle 内的 Skill / Agent / 脚本路径。',
  ];

  if (platform === 'openclaw') {
    lines.push(
      '',
      '## OpenClaw native plugin',
      '',
      `同目录额外生成了原生插件包：\`${OPENCLAW_NATIVE_PLUGIN_DIR}/\`。`,
      '',
      '可直接执行：',
      '',
      '```bash',
      `openclaw plugins install ./${OPENCLAW_NATIVE_PLUGIN_DIR}`,
      `openclaw plugins enable ${OPENCLAW_PLUGIN_ID}`,
      '# 然后重启 gateway',
      '```',
    );
  }

  lines.push('');
  return lines.join('\n');
}

function buildOpenClawPluginReadme(): string {
  return [
    '# Webnovel Writer OpenClaw Plugin',
    '',
    '这是 `webnovel adapt --platform openclaw` 生成的原生 OpenClaw 插件包。',
    '',
    '## 关键文件',
    '',
    '- `openclaw.plugin.json`：插件 manifest',
    '- `package.json`：`openclaw.extensions` 入口声明',
    '- `index.ts`：最小运行时入口',
    '- `skills/`：插件随附 Skill 目录',
    '',
    '## 安装',
    '',
    '```bash',
    'openclaw plugins install ./openclaw-plugin',
    `openclaw plugins enable ${OPENCLAW_PLUGIN_ID}`,
    '# 然后重启 gateway',
    '```',
    '',
    '## 配置',
    '',
    '该插件当前不需要额外配置；`openclaw.plugin.json` 使用空配置 schema。',
    '',
  ].join('\n');
}

function buildOpenClawManifest(): string {
  return `${JSON.stringify({
    id: OPENCLAW_PLUGIN_ID,
    name: 'Webnovel Writer Skill Pack',
    description: 'Webnovel Writer native OpenClaw plugin with bundled skills and runtime assets.',
    version: DEFAULT_PLUGIN_VERSION,
    skills: ['skills'],
    configSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  }, null, 2)}\n`;
}

function buildOpenClawPackageJson(): string {
  return `${JSON.stringify({
    name: OPENCLAW_PLUGIN_PACKAGE_NAME,
    version: DEFAULT_PLUGIN_VERSION,
    private: true,
    type: 'module',
    description: 'Generated native OpenClaw plugin for Webnovel Writer.',
    openclaw: {
      extensions: ['./index.ts'],
    },
  }, null, 2)}\n`;
}

function buildOpenClawEntryPoint(): string {
  return [
    'const plugin = {',
    `  id: '${OPENCLAW_PLUGIN_ID}',`,
    "  name: 'Webnovel Writer Skill Pack',",
    '  register() {',
    '    // Skill-only plugin: runtime behavior is provided by bundled skills/resources.',
    '  },',
    '};',
    '',
    'export default plugin;',
    '',
  ].join('\n');
}

function walkFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }

      files.push(...walkFiles(path.join(dir, entry.name)));
      continue;
    }

    if (SKIP_FILES.has(entry.name)) {
      continue;
    }

    files.push(path.join(dir, entry.name));
  }

  files.sort((left, right) => left.localeCompare(right));
  return files;
}

function getBootstrapTarget(
  platform: BundlePlatform,
  relativePath: string,
  profile: BundleProfile,
): { kind: BundleFileKind; sourcePath: string } | null {
  const normalized = toPosixPath(relativePath);

  if (normalized.startsWith('skills/') && normalized.endsWith('/SKILL.md')) {
    return {
      kind: 'skill',
      sourcePath: getBootstrapSourcePath(platform, 'skill', profile),
    };
  }

  if (platform !== 'openclaw' && normalized.startsWith('agents/') && normalized.endsWith('.md')) {
    return {
      kind: 'agent',
      sourcePath: getBootstrapSourcePath(platform, 'agent', profile),
    };
  }

  return null;
}

function injectBootstrapNotice(
  content: string,
  platform: BundlePlatform,
  bootstrapTarget: { kind: BundleFileKind; sourcePath: string },
): string {
  if (content.includes(BOOTSTRAP_MARKER)) {
    return content;
  }

  const notice = [
    BOOTSTRAP_MARKER,
    '',
    `## 平台引导（${getPlatformDisplayName(platform)}）`,
    '',
    '执行本文任意 Bash / shell 命令前，先运行：',
    '',
    '```bash',
    `source "${bootstrapTarget.sourcePath}"`,
    '```',
    '',
    '这会把 `CLAUDE_PLUGIN_ROOT` 指到当前 bundle 根目录，兼容原始 Skill / Agent 里的路径约定。',
    '',
  ].join('\n');

  if (!content.startsWith('---\n')) {
    return `${notice}${content}`;
  }

  const secondDelimiterIndex = content.indexOf('\n---\n', 4);
  if (secondDelimiterIndex === -1) {
    return `${notice}${content}`;
  }

  const insertAt = secondDelimiterIndex + '\n---\n'.length;
  return `${content.slice(0, insertAt)}\n${notice}${content.slice(insertAt)}`;
}

function countSkills(sourceRoot: string): number {
  const skillsDir = path.join(sourceRoot, 'skills');

  if (!fs.existsSync(skillsDir)) {
    return 0;
  }

  return walkFiles(skillsDir).filter((filePath) => filePath.endsWith(`${path.sep}SKILL.md`)).length;
}

function getPlatformDisplayName(platform: BundlePlatform): string {
  switch (platform) {
    case 'codex':
      return 'Codex';
    case 'opencode':
      return 'OpenCode';
    case 'openclaw':
      return 'OpenClaw';
    default:
      return assertNever(platform);
  }
}

function getBundleReadmeBootstrapPath(platform: BundlePlatform): string {
  switch (platform) {
    case 'codex':
      return '$PWD/.codex/webnovel-bootstrap-env.sh';
    case 'opencode':
      return '$PWD/.opencode/webnovel-bootstrap-env.sh';
    case 'openclaw':
      return '$PWD/webnovel-bootstrap-env.sh';
    default:
      return assertNever(platform);
  }
}

function getBootstrapSourcePath(
  platform: BundlePlatform,
  kind: BundleFileKind,
  profile: BundleProfile,
): string {
  switch (platform) {
    case 'codex':
      return '$PWD/.codex/webnovel-bootstrap-env.sh';
    case 'opencode':
      return '$PWD/.opencode/webnovel-bootstrap-env.sh';
    case 'openclaw':
      if (kind === 'skill') {
        return '{baseDir}/../../webnovel-bootstrap-env.sh';
      }

      return profile === 'native-plugin'
        ? '$PWD/openclaw-plugin/webnovel-bootstrap-env.sh'
        : '$PWD/webnovel-bootstrap-env.sh';
    default:
      return assertNever(platform);
  }
}

function joinBundlePath(bundleRoot: string, relativePath: string): string {
  if (bundleRoot === '.') {
    return toPosixPath(relativePath);
  }

  return toPosixPath(path.posix.join(bundleRoot, relativePath));
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported bundle platform: ${String(value)}`);
}
