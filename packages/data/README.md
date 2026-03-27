# @changw98ic/data

数据层 - 状态管理、实体索引、RAG 检索。

## 安装

```bash
npm install @changw98ic/data
```

## 使用

### 根入口（推荐）

```typescript
import { StateManager, IndexManager, RAGAdapter } from '@changw98ic/data';

// 状态管理
const stateManager = new StateManager({ projectRoot: '/path/to/novel' });
const state = await stateManager.loadState();

// 实体索引
const indexManager = new IndexManager({ projectRoot: '/path/to/novel' });
const entities = indexManager.searchEntities('主角');

// RAG 检索
const ragAdapter = new RAGAdapter({ projectRoot: '/path/to/novel' });
const results = await ragAdapter.search('查询内容');
```

### 子路径导入

```typescript
import { StateManager } from '@changw98ic/data/state';
import { IndexManager } from '@changw98ic/data/index-manager';
import { RAGAdapter } from '@changw98ic/data/rag';
```

> 提示：实体索引子路径是 `@changw98ic/data/index-manager`，不是旧的 `@changw98ic/data/index`。

## 文档

详见 [项目主页](https://github.com/changw98ic/webnovel-writer-skill#readme)

## 致谢

本项目基于 [lingfengQAQ/webnovel-writer](https://github.com/lingfengQAQ/webnovel-writer) 开发。

## License

GPL-3.0-or-later
