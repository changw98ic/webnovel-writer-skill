# @changw98ic/dashboard

可视化面板后端，基于 Fastify 暴露项目、章节、实体和统计接口。

## 安装

```bash
npm install @changw98ic/dashboard
```

## 代码使用

```typescript
import { createDashboard } from '@changw98ic/dashboard';

const dashboard = await createDashboard({
  port: 3000,
  host: 'localhost',
  projectRoot: '/path/to/novel',
});

await dashboard.start();
```

## CLI 使用

`webnovel` 命令来自 `@changw98ic/cli`，不是本包直接提供：

```bash
# 临时执行
cd /path/to/novel
npx @changw98ic/cli dashboard --port 3000

# 或全局安装 @changw98ic/cli 后执行
webnovel dashboard --port 3000
```

## 运行说明

- `createDashboard()` 是异步工厂函数，需要先 `await`。
- 未显式传入 `staticDir` 时，会自动探测前端构建目录。
- 如果未找到静态资源，会退化为 API-only 模式，接口仍可访问。

## 文档

- 项目主页：<https://github.com/changw98ic/webnovel-writer-skill#readme>
- 工作区包总览：`packages/README.md`

## License

GPL-3.0-or-later
