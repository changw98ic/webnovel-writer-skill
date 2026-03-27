import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const sourceRoot = path.join(repoRoot, 'webnovel-writer');
const targetRoot = path.join(packageRoot, 'dist', 'runtime', 'webnovel-writer');

const DIRECTORIES = [
  'skills',
  'references',
  'agents',
  'scripts',
  'templates',
  'dashboard',
  'genres',
];

const SKIP_DIRS = new Set(['node_modules', 'dist', '__pycache__']);
const SKIP_FILES = new Set(['.DS_Store']);

if (!fs.existsSync(sourceRoot)) {
  throw new Error(`未找到运行时资源目录: ${sourceRoot}`);
}

fs.rmSync(targetRoot, { recursive: true, force: true });
fs.mkdirSync(targetRoot, { recursive: true });

for (const directory of DIRECTORIES) {
  copyDirectory(path.join(sourceRoot, directory), path.join(targetRoot, directory));
}

function copyDirectory(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }

      copyDirectory(path.join(sourceDir, entry.name), path.join(targetDir, entry.name));
      continue;
    }

    if (SKIP_FILES.has(entry.name)) {
      continue;
    }

    fs.copyFileSync(path.join(sourceDir, entry.name), path.join(targetDir, entry.name));
  }
}
