# @changw98ic/cli

命令行工具 - `webnovel` 命令。

## 安装

```bash
npm install -g @changw98ic/cli
```

## 使用

```bash
# 初始化新项目
webnovel init "我的小说"

# 规划章节
webnovel plan 1

# 写作章节
webnovel write 1

# 审查章节
webnovel review 1-5

# 查询实体
webnovel query 主角

# 启动可视化面板
webnovel dashboard
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `init <title>` | 初始化新小说项目 |
| `plan <chapter>` | 规划章节大纲 |
| `write <chapter>` | 写作章节 |
| `review <range>` | 审查章节质量 |
| `query <keyword>` | 查询项目状态 |
| `dashboard` | 启动可视化面板 |
| `status` | 生成项目健康报告 |
| `where` | 显示当前项目路径 |
| `preflight` | 校验运行环境 |

## 文档

详见 [项目主页](https://github.com/changw98ic/webnovel-writer-skill#readme)

## 致谢

本项目基于 [lingfengQAQ/webnovel-writer-skill](https://github.com/lingfengQAQ/webnovel-writer-skill) 开发。

## License

MIT
