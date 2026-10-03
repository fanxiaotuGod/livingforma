# 本地协作记忆选择

调研与决策日期：2026-10-03。用途是保存开发角色的事实、证据与交接，不是存储 LivingForma 用户的业务状态。

## 简短比较

| 方案 | 存储与接入 | 本项目取舍 |
| --- | --- | --- |
| 直接使用 Git 中的 Markdown + `rg` | 不需要额外服务；容易审阅 diff 和恢复历史 | 最简单的回退路径；缺少标准 MCP 记忆检索与上下文组装工具。 |
| MCP reference memory server | 本地实体、关系、观察组成的知识图谱；通过 `MEMORY_FILE_PATH` 保存 JSONL，提供 MCP 操作。[官方 README](https://github.com/modelcontextprotocol/servers/blob/main/src/memory/README.md) | 适合简短实体事实；本项目希望保留可直接阅读、按角色划分的长文笔记，额外维护 JSONL 图谱没有明显收益。 |
| **Basic Memory 本地模式** | Markdown 笔记、SQLite 检索索引和 MCP/CLI；本地模式开源且免费。[本地入门](https://docs.basicmemory.com/start-here/quickstart-local) | **已选择。** Markdown 与仓库文档工作流一致，同时提供检索和上下文工具；不需要云账号或付费模型 API。 |

上述取舍是团队对当前开发需求的判断，不是性能基准。Basic Memory 的官方文档会随版本更新；本项目固定使用 [Basic Memory 0.23.2](https://pypi.org/project/basic-memory/0.23.2/)，升级另行评估。

## 本项目的隔离约定

| 内容 | 路径 / 行为 |
| --- | --- |
| Python 环境 | `.local/memory-venv/`，仅安装固定版本；不改系统 Python 环境。 |
| 配置与检索索引 | `.local/basic-memory/`，通过 `BASIC_MEMORY_CONFIG_DIR` 指定；本地运行产物不提交。 |
| 可审阅的长期笔记 | `docs/memory/` 中的 Markdown；提交前只保存无密钥、可公开的项目事实。 |
| MCP 入口 | `scripts/memory-server.sh`，由主协调 agent 编写并验证。 |
| CLI 入口 | `scripts/memory.sh`，由主协调 agent 编写并验证。 |

配置目录隔离、local 项目路由、`semantic_search_enabled=false` 和 `auto_update=false` 均有官方配置支持。本项目关闭语义搜索，使用文本检索，避免首次启动下载 embedding 模型或调用 embedding API；关闭自动更新以保持版本固定。[配置参考](https://docs.basicmemory.com/reference/configuration)

本项目通过固定版本的 `logfire_enabled=false`、`logfire_send_to_logfire=false` 与进程环境 `OTEL_SDK_DISABLED=true` 关闭 telemetry；不上传到 Basic Memory Cloud，不登录云账号，不配置云 API key。实际配置以当前 wrapper 和固定版本为准，不套用旧版 CLI 命令。[Telemetry 说明](https://www.basicmemory.com/telemetry)

## 已验证状态

2026-10-03，本地 Basic Memory 0.23.2 已安装。最终 `.local/memory-smoke-report.json` 时间为 `21:23:03Z`（14:23 America/Vancouver），记录 `success=true`、`cleanup_reindex_ok=true`、`search_attempts=1`：MCP 初始化与配置中的工具可用；两个独立服务进程并发写入不同笔记，双方互读并检索新内容；停止后用新进程读取持久笔记；既有公共项目背景可读。DevOps 已阅读报告；报告是本地验证证据，不代表线上 App 或云服务已实现。

新笔记的索引可能晚于已知路径读取；smoke 最多以 1 秒间隔检索 10 次，不保证每次立即可搜。检索暂时未命中时先读已知路径、等待或重新索引，不重复创建笔记。wrapper 还设置 `FASTMCP_CHECK_FOR_UPDATES=off`，关闭依赖 FastMCP 的更新检查，并以 `FASTMCP_SHOW_SERVER_BANNER=false` 关闭启动 banner。

主协调 agent 还确认：仅本仓库路径建立 Codex trust 后，`codex mcp get livingforma_memory --json` 成功，strict config 检查没有 malformed role 诊断。当前 chat 的工具列表不会因磁盘配置写入而自动热加载；使用新开的仓库根目录 chat 或重连 MCP 来加载配置。没有开通云服务、发生云费用或部署产品。

## 并发写入与证据规则

- 每个角色只维护自己的 `docs/memory/roles/<role>/memory.md` 与 `journal.md`；笔记有 `title` / `type` frontmatter，记录事实、来源、日期和待办。
- 公共记忆由主协调 agent 单独写入。其他角色给主协调 agent 返回摘要，不同时改同一份共享笔记；这是协作规则，不是 MCP 自动提供的文件锁。
- 写前阅读现有笔记；先核对事实，再更新当前摘要并按日期补充 journal。只记录高层结论与可复核证据，不保存模型内部推理、凭据、个人敏感信息或完整噪声日志。
- 文档直接编辑后按经过验证的 CLI 流程同步索引。检索不到内容时先核对目标项目与索引；Markdown 是可审阅内容来源，索引不是备份。
- 云同步、语义搜索、后台自动更新和遥测不因工具默认值而自行开启。未来启用会产生费用的服务或功能前仍需用户确认。
