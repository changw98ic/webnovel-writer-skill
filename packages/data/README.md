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

## RAG 配置

```bash
export EMBED_BASE_URL=https://api-inference.modelscope.cn/v1
export EMBED_MODEL=Qwen/Qwen3-Embedding-8B
export EMBED_API_KEY=your_embed_api_key

export RERANK_BASE_URL=https://api.jina.ai/v1
export RERANK_MODEL=jina-reranker-v3
export RERANK_API_KEY=your_rerank_api_key
```

- `RAGAdapter` 默认从 `process.env` 读取 `EMBED_*` / `RERANK_*`
- 当前 TypeScript 包未内置 `.env` 自动加载逻辑；如果你直接在 Node.js 里使用本包，请在启动前自行导出环境变量，或手动加载 `.env`
- 仓库内插件版 `.env` 加载顺序见根 `README.md` 与 `docs/rag-and-config.md`

## 文档

详见 <https://github.com/changw98ic/webnovel-writer-skill#readme>

## License

GPL-3.0-or-later
