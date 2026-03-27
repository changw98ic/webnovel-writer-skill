# @changw98ic/dashboard

可视化面板 - Fastify 后端。

## 安装

```bash
npm install @changw98ic/dashboard
```

## 使用

```typescript
import { createDashboard } from '@changw98ic/dashboard';

const dashboard = createDashboard({
  port: 3000,
  projectRoot: '/path/to/novel'
});

await dashboard.start();
```

## 命令行

```bash
npx webnovel dashboard
```

## 文档

详见 [项目主页](https://github.com/changw98ic/webnovel-writer-skill#readme)

## 致谢

本项目基于 [lingfengQAQ/webnovel-writer-skill](https://github.com/lingfengQAQ/webnovel-writer-skill) 开发。

## License

MIT
