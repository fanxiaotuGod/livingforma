---
title: LivingForma workflow setup verification
type: note
permalink: livingforma/shared/setup-verification
---

# 工作流安装与验证

验证日期：2026-10-03，America/Vancouver。范围是开发协作基础设施，应用尚未实现。

| 项目 | 结果与证据 |
| --- | --- |
| 固定角色 | frontend / backend / agent / devops / qa 配置已创建；主 agent 协调，并发最多三个子 agent。 |
| 持久记忆 | 六个角色目录（含 coordinator）均有 memory.md 和 journal.md；公共决策、接口、任务板及交接目录已建立。 |
| 本地 MCP | Basic Memory 0.23.2 安装在项目隔离 venv；唯一配置项目 livingforma 指向 docs/memory。SQLite 索引位于被忽略的 .local/basic-memory。 |
| Codex 配置 | Codex CLI 0.160.0 的 mcp get 可读取 livingforma_memory；strict-config 未报告无效角色。 |
| 范围限定 | 只新增本仓库的 trust；原用户配置有私密备份。未改模型、sandbox、审批策略或其他项目设置。 |
| 静态检查 | check-workflow.py 通过：角色 TOML、文件、Markdown 链接、shell 语法、Git 忽略规则。 |
| 依赖 | pip check 通过；无需全局 --pre 即可解析安装。实际依赖清单在 .local/memory-installed.txt。 |
| MCP 行为 | 两个独立服务进程同时写不同笔记、互读和检索通过；停止后新进程仍可读，现有公共背景可读。 |
| 重复安装 | 重跑 setup-memory.sh 与 setup-workflow.py --trust 成功，保留同一项目和既有 trust。 |

最新完整 smoke 报告时间为 2026-10-03T21:23:03Z，`success=true`、`search_attempts=1`、`cleanup_reindex_ok=true`。机器本地报告在 `.local/memory-smoke-report.json`，服务诊断在 `.local/memory-smoke-server.log`；这些运行产物不入 Git。

复测曾发现立即检索为空，而直接读取成功。测试现允许最多十次、间隔一秒的检索尝试；日常交接应传递准确路径，不能仅凭一次搜索结果断言笔记不存在。同一 Markdown 文件仍采用单一写入者；并发验证不代表同文件写入会自动合并。

关闭 Basic Memory 云路由、语义搜索、自动更新及遥测；同时关闭 FastMCP 更新检查。没有创建云服务、配置付费账号或部署 livingforma.tech。

本轮验证了独立 MCP 客户端和 Codex 可识别的配置。当前聊天不保证热加载新增 MCP 工具；在此仓库新开 Codex chat 或重连 MCP 后，新的 agent 才会使用这些配置。

操作入口：[工作流](../../WORKFLOW.md)。
## 2026-10-03 14:58 · 自动认领与新角色职责

- `scripts/test-coordination.py`：实现 agent 最终运行 30 项测试全部通过，覆盖多进程争抢、父子路径冲突、角色/会话所有权、worktree 共用、独立 clone 隔离、崩溃恢复、目录摘要/CAS、活跃目录所有者校验、验收变化及后继证据失效。
- coordinator 在临时 Git 仓库中用实际 10 任务目录独立验证依赖门禁、四角色并行认领、整合/QA/部署顺序、LF-155 维护时发布新验收、返工及关闭。报告 `.local/coordination-smoke-report.json`，时间 2026-10-03T21:57:00Z。仅模拟调度，不是应用验收。
- `check-workflow.py` 与 `git diff --check` 通过；公开文档/脚本凭据模式检查无命中，账户状态与索引保持忽略。
- 真实仓库已初始化目录 revision 1；产品任务均未完成。coordinator 仅认领 LF-155 做本轮证据收尾，交接后释放并关闭，不把维护记为产品完成。
- DevOps 主责 Google OAuth/session 与 livingforma.tech；Backend 主责用户映射/权限/Tiger Data，Agent 主责 Gemini/ElevenLabs，Snowflake 为可选分析。账号可访问不等于 API/应用已实现。
- 当前仍未部署网站、配置 OAuth 客户端或创建云服务；免费额度优先、收费前确认。
