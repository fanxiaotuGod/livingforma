---
title: DevOps Journal
type: note
permalink: livingforma/roles/devops/journal
---

# DevOps 日志

## 2026-10-03

### 事实与证据

- 阅读 `docs/PRD.md` 和 `docs/product/open-questions.md`；通用 App 生成是当前主线，免费优先与收费前确认是已确认约束。当前没有已实现应用或已验证上线地址。
- 主协调 agent 传达：公开仓库 `fanxiaotuGod/livingforma`；用户已注册 `livingforma.tech`；域名配置与访问尚未验证。
- 调研官方 Vercel、Render、Supabase 资料，写入 `docs/operations/deployment.md`。Render Free 可能休眠且磁盘临时；有付款方式时部分超额用量可计费，不能把免费 compute 当作完整费用保证。
- 调研 Basic Memory 本地模式、配置和 telemetry，以及 MCP reference JSONL graph memory，写入 `docs/research/local-memory.md`。本项目选择 0.23.2 与隔离本地目录，禁止默认开启云、语义搜索、自动更新和遥测。
- 本次只写 DevOps 所属文档和角色笔记，没有改配置、脚本、共享记忆、DNS 或云资源，没有提交或推送。

### 待验证

- 主协调 agent 完成 memory wrappers 后验证固定版本、设置、索引和 MCP 连通性。
- 应用实现后再填写实际部署命令，选择并核对免费方案，验证域名、数据持久化及两个浏览器同步。

## 2026-10-03 14:20 America/Vancouver · LF-004 验证交接

### 事实与证据

- 状态：本地协作记忆 **verified**；产品与部署仍 **proposed / 未实现**。检查主协调 agent 运行的 `.local/memory-smoke-report.json`，其时间 `2026-10-03T21:20:11+00:00` 对应本条本地时间；版本为 0.23.2，`success=true`，清理后的重新索引也通过。
- 报告覆盖 MCP 初始化及配置工具可用、两个独立服务进程并发写入不同文件、互读、文本检索、两服务停止后的新进程持久读取、公共项目背景读取。DevOps 阅读证据，没有将安装成功替代读写验证，也没有把不同文件并发误称为同文件冲突处理。
- 主协调 agent 确认只为本仓库建立 Codex trust；目标 `codex mcp get` 成功，strict config 无 malformed role 诊断。当前 chat 不自动热加载新增配置，需新开仓库根目录 chat 或重连 MCP。
- 阅读修复后的 wrapper：明确使用 SQLite、清除继承的数据库/Redis/项目根环境设置，调用 venv Python 执行 CLI，避免目录移动后的旧 console shebang；文档说明配置脚本需要 Python 3.11+、Basic Memory 需要 3.12+。DevOps 没有改脚本或机器配置。
- 更新 `docs/research/local-memory.md` 与自己的 `memory.md`、`journal.md`，记录实际安装和验证状态。域名证据修正：用户表示已申请；注册、DNS、HTTPS 与部署尚未独立验证，先前“已注册”的摘要不可当作独立验证结果。
- 没有开通云服务、发生云费用、部署产品、修改 DNS、提交或推送。

### 待验证与下一步

- 在新仓库 chat 中实际使用记忆工具，并继续遵守公共笔记 coordinator 单一写入。
- 应用实现与平台选择后，再按免费优先、收费前确认的约定验证部署、域名与业务数据恢复；本次记忆工具 smoke 不覆盖 App 验收。

## 2026-10-03 14:23 America/Vancouver · LF-004 最终验证记录

- 阅读最终 `.local/memory-smoke-report.json`：`21:23:03Z`，Basic Memory 0.23.2，六项检查全部通过，`success=true`、`search_attempts=1`、`cleanup_reindex_ok=true`。此结果来自主协调 agent 在稳定依赖调整后的重跑；保留先前 14:20 通过记录作为历史。
- 索引可晚于已知路径读取。测试现采用 1 秒间隔、最多 10 次的有限检索等待；即时未命中不代表写入失败，不重复创建笔记，先核对路径、等待或重新索引。
- 阅读 wrapper 中的 `FASTMCP_CHECK_FOR_UPDATES=off` 与 `FASTMCP_SHOW_SERVER_BANNER=false`，依赖更新检查也已关闭。
- 本次只更新自己的记忆/日志与 `docs/research/local-memory.md`，没有再运行测试；coordinator 负责收齐文档后统一重新索引。云服务、收费、产品部署与域名验证状态未变化。
