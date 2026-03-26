/**
 * Cursor Adapter - .cursorrules 生成器
 *
 * 将统一 Skill 定义转换为 Cursor 的 .cursorrules 格式
 */
import { Skill } from '@webnovel-skill/core';

export interface CursorOutput {
  path: string;
  content: string;
}

/**
 * 生成 Cursor .cursorrules 文件
 */
export function generateCursorRules(skill: Skill): CursorOutput {
  const sections: string[] = [];

  // 标题
  sections.push(`# ${skill.name}`, '');
  sections.push('', `> ${skill.description}`, '');
  sections.push('');

  // 触发词
  sections.push('## 触发词', '');
  sections.push('');
  sections.push('当用户输入以下内容时，触发此 Skill:', '');
  sections.push('');
  for (const trigger of skill.triggers) {
    sections.push(`- \`${trigger}\``);
  }
  sections.push('');

  // 执行规则
  sections.push('## 执行规则', '');
  sections.push('');
  sections.push('### 优先级', '');
  sections.push('');
  sections.push('1. 严格遵循工作流步骤顺序， 不得跳步或 不得合并步骤');
  sections.push('2. 参考资料按需加载， 避免一次性灌入全部内容');
  sections.push('3. 夯每一步完成后， 输出明确的中间结果');
  sections.push('');

  // 工作流
  if (skill.workflow.length > 0) {
    sections.push('### 工作流', '');
    sections.push('');
    for (const step of skill.workflow) {
      const optional = step.optional ? ' [可选]' : '';
      sections.push(`#### ${step.step}${optional}`, '');
      sections.push('');
      sections.push(`**动作**: ${step.action}`);
      if (step.tools && step.tools.length > 0) {
        sections.push(`**工具**: ${step.tools.map(t => `\`${t}\``).join(', ')}`);
      }
      if (step.references && step.references.length > 0) {
        sections.push(`**参考文件**:`);
        for (const ref of step.references) {
          sections.push(`  - \`${ref}\``);
        }
      }
      sections.push('');
    }
  }

  // 工具使用
  sections.push('## 工具使用', '');
  sections.push('');
  for (const tool of skill.tools) {
    sections.push(`### ${tool.name}`, '');
    const desc = tool.description || `类型: ${tool.type}`;
    sections.push(desc);
    sections.push('');
  }

  // 参考文档
  if (skill.references && skill.references.length > 0) {
    sections.push('## 参考文档', '');
    sections.push('');
    sections.push('以下文档按需加载:', '');
    sections.push('');
    for (const ref of skill.references) {
      const trigger = ref.trigger ? ` (${ref.trigger})` : '';
    sections.push(`- \`${ref.path}\` - ${ref.purpose}${trigger}`);
    }
  }

  return {
    path: '.cursorrules',
    content: sections.join('\n'),
  };
}

/**
 * 批量生成
 */
export function generateCursorRulesAll(skills: Skill[]): CursorOutput {
  // 合并所有 Skills 到一个 .cursorrules 文件
  const allSections: string[] = [];

  allSections.push('# Webnovel Writer Skills', '');
  allSections.push('');
  allSections.push('> 通用网文创作技能集', '');
  allSections.push('');

  for (const skill of skills) {
    const output = generateCursorRules(skill);
    allSections.push(output.content);
    allSections.push('---', '');
  }

  return {
    path: '.cursorrules',
    content: allSections.join('\n'),
  };
}
