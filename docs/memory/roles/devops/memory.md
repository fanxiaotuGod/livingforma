---
title: DevOps Memory
type: note
permalink: livingforma/roles/devops/memory
---

# DevOps 当前记忆

更新：2026-10-03。

## 事实

- LivingForma 聚焦通用 App 生成与持续演化；任务、签到和投票是可选例子。应用尚未实现。
- 仓库是公开的 `fanxiaotuGod/livingforma`。用户表示已申请 `livingforma.tech`；注册、DNS、HTTPS 和部署可访问性尚未独立验证。
- 用户要求免费额度优先；任何收费发生前必须确认。未创建部署资源或修改 DNS。
- 协作记忆选择 Basic Memory 0.23.2：隔离 venv 在 `.local/memory-venv/`，配置/索引在 `.local/basic-memory/`，Markdown 在 `docs/memory/`。关闭语义搜索、自动更新和 telemetry；不需要云账号或付费模型 API。
- 主协调 agent 已完成两个 memory wrapper 与本地安装；固定版本、跨进程读写/检索与重启持久化已有 smoke 报告。当前 chat 不自动热加载磁盘上的角色和 MCP 配置，应新开仓库根目录 chat 或重连 MCP。
- 新笔记检索可能有索引延迟；测试最多每秒重试一次、共 10 次。已知路径可先直接读取，不因未命中而重复创建。wrapper 同时关闭 FastMCP 更新检查与 banner。
- DevOps 只维护自己的记忆；共享笔记采用主协调 agent 单一写入。没有开通云服务、发生云费用或部署产品。

## 证据

- 产品范围与费用要求：`docs/PRD.md`、`docs/product/open-questions.md`，以及本次用户确认，由主协调 agent 传达。
- 部署选项与限制：`docs/operations/deployment.md`，引用提供商官方文档；所有选项仍未 provision。
- 本地记忆比较与配置依据：`docs/research/local-memory.md`，引用 Basic Memory 与 MCP reference server 官方资料。
- 最终测试：`.local/memory-smoke-report.json`（2026-10-03 14:23 America/Vancouver / `21:23:03Z`），`basic_memory=0.23.2`、`success=true`、`search_attempts=1`、`cleanup_reindex_ok=true`；DevOps 已阅读报告。14:20 的历史通过记录保留在 journal。
- 主协调 agent 的验证结果：限定本仓库的 Codex trust、目标 MCP 配置读取成功、strict config 无 malformed role；本地检查不证明当前聊天已载入新工具。

## 待确认 / 待验证

- 在新开的仓库根目录 chat 中实际使用 `livingforma_memory`；当前会话热加载不作保证。
- 数据库与实时传输选择、前后端托管方式、额度停止策略。
- 实际构建/启动命令、健康检查、重连恢复和多客户端验收。
- 实际部署 URL、部署 commit、域名 DNS、HTTPS 与无登录访问结果。
