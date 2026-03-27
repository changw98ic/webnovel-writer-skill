/**
 * Entity command - 实体管理
 */
import { Command } from 'commander';
import { resolveProjectRoot } from '../utils/project-locator.js';
import { IndexManager } from '@changw98ic/data';

export const entityCommand = new Command('entity')
  .description('实体管理');

// Search subcommand
entityCommand
  .command('search <keyword>')
  .description('搜索实体')
  .option('-p, --project-root <path>', '项目根目录')
  .option('-t, --type <type>', '实体类型过滤')
  .option('--json', 'JSON 格式输出')
  .action(async (keyword: string, options) => {
    try {
      const projectRoot = resolveProjectRoot(options.projectRoot ?? process.cwd());
      const manager = new IndexManager({ projectRoot });
      const results = manager.searchEntities(keyword, 20);

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
        console.log(`   [${entity.type}] ${entity.canonical_name} (层级: ${entity.tier})`);
        const aliases = manager.getAliasesForEntity(entity.id);
        if (aliases.length > 0) {
          console.log(`     别名: ${aliases.map(a => a.alias).join(', ')}`);
        }
        console.log(`     首次出现: 第 ${entity.first_appearance} 章`);
        console.log();
      }
    } catch (error) {
      console.error('❌ 搜索失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Link subcommand - 注意：linkEntities 方法不存在，改为占位实现
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
      console.log(`   关系类型: ${options.relation || '未指定'}`);

      const manager = new IndexManager({ projectRoot });

      // 查找实体
      const e1 = manager.getEntityById(entity1) || manager.getEntityByAlias(entity1);
      const e2 = manager.getEntityById(entity2) || manager.getEntityByAlias(entity2);

      if (!e1 || !e2) {
        console.log(`\n❌ 未找到实体: ${!e1 ? entity1 : ''} ${!e2 ? entity2 : ''}`);
        manager.close();
        process.exit(1);
      }

      // 使用 upsertRelationship 创建关系
      manager.upsertRelationship({
        from_entity: e1.id,
        to_entity: e2.id,
        type: options.relation || '关联',
        description: `CLI 创建的关系`,
        chapter: 1,
      });

      manager.close();
      console.log('\n✅ 链接成功');
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

      // 先按 ID 查找，再按别名查找
      let entity = manager.getEntityById(name);
      if (!entity) {
        entity = manager.getEntityByAlias(name);
      }

      if (!entity) {
        manager.close();
        console.log(`未找到实体: ${name}`);
        process.exit(1);
      }

      // 获取别名和关系
      const aliases = manager.getAliasesForEntity(entity.id);
      const relationships = manager.getRelationships(entity.id);

      if (options.json) {
        console.log(JSON.stringify({ ...entity, aliases, relationships }, null, 2));
      } else {
        console.log(`📋 实体详情:\n`);
        console.log(`   名称: ${entity.canonical_name}`);
        console.log(`   ID: ${entity.id}`);
        console.log(`   类型: ${entity.type}`);
        console.log(`   层级: ${entity.tier}`);
        if (aliases.length > 0) {
          console.log(`   别名: ${aliases.map(a => a.alias).join(', ')}`);
        }
        console.log(`   首次出现: 第 ${entity.first_appearance} 章`);
        if (entity.last_appearance) {
          console.log(`   最后出现: 第 ${entity.last_appearance} 章`);
        }
        if (entity.desc) {
          console.log(`   描述: ${entity.desc}`);
        }
        if (relationships.length > 0) {
          console.log('\n   关系:');
          for (const rel of relationships) {
            const target = rel.from_entity === entity.id ? rel.to_entity : rel.from_entity;
            console.log(`   - ${target} (${rel.type})`);
          }
        }
      }

      manager.close();
    } catch (error) {
      console.error('❌ 获取失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
