/**
 * Entity command - 实体管理
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { IndexManager } from '@webnovel-skill/data';

export const entityCommand = new Command('entity')
  .description('实体管理');

// Search subcommand
entityCommand
  .command('search <keyword>')
  .description('搜索实体')
  .option('-p, --project-root <path>', '项目根目录')
  .option('-t, --type <type>', '实体类型 (character|location|item|concept)')
  .option('--json', 'JSON 格式输出')
  .action(async (keyword: string, options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const manager = new IndexManager({ projectRoot });
      const results = manager.searchEntities(keyword, options.type);

      manager.close();

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      if (results.length === 0) {
        console.log(`未找到匹配 "${keyword}" 的实体`);
        return;
      }

      console.log(`🔍 搜索结果 (${results.length} 个):\n`);
      for (const entity of results) {
        console.log(`   [${entity.type}] ${entity.name} (层级: ${entity.tier})`);
        if (entity.aliases && entity.aliases.length > 0) {
          console.log(`     别名: ${entity.aliases.join(', ')}`);
        }
        console.log(`     首次出现: 第 ${entity.firstAppearance} 章`);
        console.log();
      }
    } catch (error) {
      console.error('❌ 搜索失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Link subcommand
entityCommand
  .command('link <entity1> <entity2>')
  .description('链接两个实体')
  .option('-p, --project-root <path>', '项目根目录')
  .option('-r, --relation <type>', '关系类型')
  .action(async (entity1: string, entity2: string, options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());

      console.log(`🔗 链接实体: ${entity1} ↔ ${entity2}`);
      console.log(`   项目路径: ${projectRoot}`);

      const manager = new IndexManager({ projectRoot });
      const success = manager.linkEntities(entity1, entity2, options.relation);

      manager.close();

      if (success) {
        console.log('\n✅ 链接成功');
      } else {
        console.log('\n❌ 链接失败: 未找到指定实体');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ 链接失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Stats subcommand
entityCommand
  .command('stats')
  .description('显示实体统计')
  .option('-p, --project-root <path>', '项目根目录')
  .option('--json', 'JSON 格式输出')
  .action(async (options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const manager = new IndexManager({ projectRoot });
      const stats = manager.getStats();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log('📊 实体统计:\n');
        console.log(`   总实体数: ${stats.totalEntities}`);
        console.log('\n   按类型:');
        for (const [type, count] of Object.entries(stats.byType)) {
          console.log(`   - ${type}: ${count}`);
        }
        console.log('\n   按层级:');
        for (const [tier, count] of Object.entries(stats.byTier)) {
          console.log(`   - ${tier}: ${count}`);
        }
      }

      manager.close();
    } catch (error) {
      console.error('❌ 获取统计失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Get subcommand
entityCommand
  .command('get <name>')
  .description('获取实体详情')
  .option('-p, --project-root <path>', '项目根目录')
  .option('--json', 'JSON 格式输出')
  .action(async (name: string, options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const manager = new IndexManager({ projectRoot });
      const entity = manager.getEntity(name);

      manager.close();

      if (!entity) {
        console.log(`未找到实体: ${name}`);
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(entity, null, 2));
      } else {
        console.log(`📋 实体详情:\n`);
        console.log(`   名称: ${entity.name}`);
        console.log(`   类型: ${entity.type}`);
        console.log(`   层级: ${entity.tier}`);
        if (entity.aliases && entity.aliases.length > 0) {
          console.log(`   别名: ${entity.aliases.join(', ')}`);
        }
        console.log(`   首次出现: 第 ${entity.firstAppearance} 章`);
        if (entity.lastAppearance) {
          console.log(`   最后出现: 第 ${entity.lastAppearance} 章`);
        }
        if (entity.description) {
          console.log(`   描述: ${entity.description}`);
        }
        if (entity.relations && entity.relations.length > 0) {
          console.log('\n   关系:');
          for (const rel of entity.relations) {
            console.log(`   - ${rel.target} (${rel.type})`);
          }
        }
      }
    } catch (error) {
      console.error('❌ 获取失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
