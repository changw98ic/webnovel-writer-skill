import { describe, expect, it } from 'vitest';
import { adapt } from '../index.js';
import { generateBundle } from '../bundle/generator.js';

describe('generateBundle', () => {
  it('should generate a codex bundle with injected bootstrap guidance', () => {
    const result = generateBundle('codex');
    const writeSkill = result.files.find((file) => file.path === '.codex/skills/webnovel-write/SKILL.md');
    const bootstrap = result.files.find((file) => file.path === '.codex/webnovel-bootstrap-env.sh');

    expect(result.metadata.bundleRoot).toBe('.codex');
    expect(result.metadata.skillCount).toBeGreaterThan(0);
    expect(bootstrap?.content).toContain('CLAUDE_PLUGIN_ROOT');
    expect(bootstrap?.content).toContain('WEBNOVEL_BUNDLE_ROOT_DEFAULT');
    expect(writeSkill?.content).toContain('## 平台引导（Codex）');
    expect(writeSkill?.content).toContain('source "$PWD/.codex/webnovel-bootstrap-env.sh"');
  });

  it('should generate an openclaw workspace bundle and native plugin package', () => {
    const result = generateBundle('openclaw');
    const readme = result.files.find((file) => file.path === 'WEBNOVEL_BUNDLE.md');
    const skill = result.files.find((file) => file.path === 'skills/webnovel-init/SKILL.md');
    const pluginManifest = result.files.find((file) => file.path === 'openclaw-plugin/openclaw.plugin.json');
    const pluginPackage = result.files.find((file) => file.path === 'openclaw-plugin/package.json');
    const pluginSkill = result.files.find((file) => file.path === 'openclaw-plugin/skills/webnovel-write/SKILL.md');

    expect(result.metadata.bundleRoot).toBe('.');
    expect(result.metadata.nativePluginRoot).toBe('openclaw-plugin');
    expect(readme?.content).toContain('openclaw plugins install ./openclaw-plugin');
    expect(skill?.content).toContain('source "{baseDir}/../../webnovel-bootstrap-env.sh"');
    expect(pluginManifest?.content).toContain('"id": "webnovel-writer-skill"');
    expect(pluginManifest?.content).toContain('"skills"');
    expect(pluginPackage?.content).toContain('"extensions"');
    expect(pluginSkill?.content).toContain('source "{baseDir}/../../webnovel-bootstrap-env.sh"');
  });
});

describe('adapt', () => {
  it('should route opencode to the direct bundle generator', () => {
    const result = adapt({
      platform: 'opencode',
      outputDir: '.',
      skills: [],
    });

    const skill = result.files.find((file) => file.path === '.opencode/skills/webnovel-review/SKILL.md');

    expect(result.metadata?.platform).toBe('opencode');
    expect(skill?.content).toContain('## 平台引导（OpenCode）');
  });
});
