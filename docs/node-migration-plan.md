# Python → Node 完整迁移清单

## 目标与结论

本文档用于规划本仓库从 Python 主链路迁移到 Node 主链路的执行步骤。

当前结论：

- 可以继续推进 Node 化。
- 现在还不能删除 Python。
- 正确路径是“分阶段迁移 + 每阶段做等价验证”，不是一次性切换。

## 当前基线

以下位置说明 Python 仍是当前主入口：

- `README.md`：安装与预检仍要求 Python。
- `webnovel-writer/scripts/webnovel.py`：统一入口脚本。
- `webnovel-writer/scripts/data_modules/webnovel.py`：统一 CLI 分发层。
- `webnovel-writer/skills/webnovel-dashboard/SKILL.md`：Dashboard Skill 仍通过 `python -m dashboard.server` 启动。

以下位置说明 Node 目前只覆盖了部分能力：

- `packages/cli/src/index.ts`：仅暴露 `init/plan/write/review/query/adapt/dashboard/resume`。
- `packages/data/src/state/manager.ts`
- `packages/data/src/index-manager/manager.ts`
- `packages/data/src/rag/adapter.ts`
- `packages/dashboard/src/index.ts`

## 迁移原则

1. 先做“能力等价”，再切换入口。
2. 先做“存储兼容”，再删旧实现。
3. 每迁一个模块，都要做 Python/Node 输出对拍。
4. 未经过“无 Python 环境”验证，不得宣称完成迁移。

## P0：统一入口与基础兼容

风险：高

目标：让 Node 具备替代 Python 统一入口的最小骨架。

- [ ] 在 Node 侧实现 `where/preflight/use`。
- [ ] 迁移 `project_locator.py` 的项目根解析规则、workspace 指针和 registry 逻辑。
- [ ] 统一 CLI 输出协议，兼容当前 JSON 成功/失败格式。
- [ ] 保持 `.webnovel/` 路径、`state.json`、`index.db`、`vectors.db` 命名完全兼容。
- [ ] 保持 `chunk_id`、`source_file`、章节编号补零规则一致。

验收：

- `python ... webnovel.py where` 与 Node 新入口解析到同一 `project_root`
- 同一项目目录下，Python/Node 均可读写同一份 `.webnovel/*`

## P1：迁移核心数据模块

风险：高

目标：覆盖写作主链路需要的数据能力。

- [ ] `context_manager.py`
- [ ] `style_sampler.py`
- [ ] `entity_linker.py`
- [ ] `migrate_state_to_sqlite.py`
- [ ] `api_client.py` 的环境变量、重试、超时、降级策略
- [ ] `runtime_compat.py`、`security_utils.py` 中的 UTF-8、原子写、锁语义

验收：

- Node 侧补齐对应测试
- 对同一输入，Python/Node 返回的 JSON schema 一致
- 关键数据库副作用一致

## P2：迁移工作流脚本

风险：中高

目标：让 Node 能替代 Python 的脚本式编排。

- [ ] `init_project.py`
- [ ] `workflow_manager.py`
- [ ] `status_reporter.py`
- [ ] `backup_manager.py`
- [ ] `archive_manager.py`
- [ ] `extract_chapter_context.py`
- [ ] `update_state.py`

验收：

- 原 Skills/Agents 依赖的命令都能由 Node 入口调用
- 产物路径、报告结构、退出码与旧实现一致

## P3：迁移 Dashboard 与可观测性

风险：中

目标：把运行态观察链路完全切到 Node。

- [ ] 对齐 Python Dashboard API 面与 Node Dashboard 路由
- [ ] 补齐 `/api/events` 或等价实时刷新机制
- [ ] 继续完善 Node `rag_query_log`、`tool_call_stats`、性能拆分指标
- [ ] 前端改为仅依赖 Node Dashboard API

当前已完成的基础项：

- Node Dashboard 可启动
- Node RAG 已支持 `rag_query_log`
- `/api/stats/rag` 已返回 `query_metrics`

## P4：切换 Skill、文档与发布包

风险：高

目标：把“用户安装体验”切换到 Node-only。

- [ ] 修改 `webnovel-writer/skills/*.md`，去掉 `python`/`PYTHONPATH` 依赖
- [ ] 修改 `README.md`、`docs/README.md`、`docs/commands.md`
- [ ] 移除 `requirements.txt` 在主安装路径中的必要性
- [ ] 校验插件发布包不再要求 Python 运行时

验收：

- 新文档中不再出现主流程 Python 安装步骤
- 新安装用户只需 Node + pnpm 即可启动核心功能

## P5：删除 Python 前的最终门槛

风险：最高

以下条件必须全部满足，才允许删除 Python：

- [ ] 在无 Python 环境下完成一次全流程烟测
- [ ] `init -> preflight -> plan -> write -> review -> dashboard -> rag search` 全链路通过
- [ ] 所有 Skill/Agent 启动脚本已切到 Node
- [ ] 主要数据结构和数据库内容完成对拍
- [ ] 文档、发布包、CI 不再依赖 Python

建议使用的残留扫描命令：

```bash
rg -n "python |PYTHONPATH|requirements.txt|\\.py\\b" README.md docs webnovel-writer
```

## 推荐执行顺序

1. `project_locator + unified CLI + cli_output`
2. `context/style/entity/migrate`
3. `workflow/status/backup/archive/extract/update/init`
4. `dashboard + observability + frontend API 对齐`
5. `skills/docs/release`
6. `无 Python 环境最终验收`

## 里程碑定义

- M1：Node 能替代 Python 统一入口的基础命令
- M2：Node 能独立跑完整数据主链路
- M3：Node Dashboard 与前端 API 完整对齐
- M4：Skills 与文档全面切换到 Node
- M5：删除 Python 成为安全操作

## 当前建议

下一阶段应优先完成 M1，而不是直接删除 Python。  
如果没有先补齐统一入口、项目定位和数据模块，再做“完全迁移”会把现有 Skill、文档和用户安装路径一起打断。
