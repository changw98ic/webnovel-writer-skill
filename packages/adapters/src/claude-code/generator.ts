/**
 * Claude Code Adapter - SKILL.md 生成器
 *
 * 将统一 Skill 定义转换为 Claude Code 的 SKILL.md 格式
 */
import { Skill } from '@changw98ic/core';

export interface ClaudeCodeOutput {
  path: string;
  content: string;
}

/**
 * 生成 Claude Code SKILL.md 文件
 */
export function generateClaudeSkill(skill: Skill): ClaudeCodeOutput {
  const frontmatter = generateFrontmatter(skill);
  const body = generateBody(skill);

  return {
    path: `${skill.name}/SKILL.md`,
    content: `---\n${frontmatter}\n---\n\n${body}`,
  };
}

/**
 * 生成 Frontmatter
 */
function generateFrontmatter(skill: Skill): string {
  const lines: string[] = [
    `name: ${skill.name}`,
    `description: ${skill.description}`,
  `allowed-tools: ${skill.tools.map(t => t.name).join(', ')}`,
  ];

  // 添加可选的元数据
  if (skill.adapters?.['claude-code']) {
    const cc = skill.adapters['claude-code'] as Record<string, unknown>;
    if (cc.model) lines.push(`model: ${cc.model}`);
    if (cc.triggers) lines.push(`triggers: ${(cc.triggers as string[]).join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * 生成正文内容
 */
function generateBody(skill: Skill): string {
  const sections: string[] = [];

  // 目标说明
  sections.push(`# ${skill.name}`, '');
  sections.push('## 目标', '');
  sections.push(skill.description, '');
  sections.push('');

  // 工具策略
  if (skill.tools.length > 0) {
    sections.push('## 工具策略（按需）', '');
    sections.push('');
    sections.push(skill.tools.map(t => {
      const desc = t.description ? ` - ${t.description}` : '';
      return `- \`${t.name}\`${desc}\``;
    }).join('\n'));
    sections.push('');
  }

  // 参考资料加载
  if (skill.references && skill.references.length > 0) {
    sections.push('## 引用加载等级（strict, lazy）', '');
    sections.push('');
    sections.push('| 等级 | 说明 | 触发条件 |');
    sections.push('|------|------|----------|');
    for (const ref of skill.references) {
      const trigger = ref.trigger || `触发时加载`;
      sections.push(`| ${ref.level} | \`${ref.path}\` | ${trigger} |`);
    }
    sections.push('');
  }

  // 提示词
  if (skill.prompts.length > 0) {
    sections.push('## 提示词', '');
    sections.push('');
    for (const prompt of skill.prompts) {
      if (prompt.role === 'system') {
        sections.push('### 系统提示', '');
        sections.push(prompt.content, '');
        sections.push('');
      } else if (prompt.role === 'user') {
        const condition = prompt.condition ? ` (条件: ${prompt.condition})` : '';
        sections.push(`### 用户提示${condition}`, '');
        sections.push(prompt.content, '');
        sections.push('');
      }
    }
  }

  // 工作流
  if (skill.workflow.length > 0) {
    sections.push('## 交互流程', '');
    sections.push('');
    for (const step of skill.workflow) {
      const optional = step.optional ? '（可选）' : '';
      sections.push(`### ${step.step}${optional}`, '');
      sections.push('');
      sections.push(`**动作**: ${step.action}`, '');
      if (step.tools && step.tools.length > 0) {
        sections.push(`**工具**: ${step.tools.join(', ')}`);
      }
      if (step.references && step.references.length > 0) {
        sections.push(`**参考**: ${step.references.join(', ')}`);
      }
      if (step.condition) {
        sections.push(`**条件**: ${step.condition}`);
      }
      sections.push('');
    }
  }

  // 成功标准
  if (skill.successCriteria && skill.successCriteria.length > 0) {
    sections.push('## 成功标准', '');
    sections.push('');
    sections.push('未满足以下条件前不得结束流程： ', '');
    sections.push('');
    for (const criterion of skill.successCriteria) {
      const required = criterion.required ? '（必须）' : '（可选）';
      sections.push(`${required} ${criterion.id}: ${criterion.description}`);
    }
  }

  return sections.join('\n');
}

/**
 * 批量生成多个 Skills
 */
export function generateClaudeSkills(skills: Skill[]): ClaudeCodeOutput[] {
  return skills.map(generateClaudeSkill);
}
