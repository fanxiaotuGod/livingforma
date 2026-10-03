---
title: LivingForma QA journal
type: note
permalink: livingforma/roles/qa/journal
updated: 2026-10-03
timezone: America/Vancouver
---

# QA 工作日志

## 2026-10-03 · America/Vancouver · LF-005
- Status: in-progress
- Scope: 多 agent 工作流的配置、文档与 MCP 验证。
- Planned checks: 本地链接、角色 TOML、Codex strict parser、MCP initialize/tools/read/write/search、跨进程共享。
- Results: 尚未执行；由 coordinator 填入实际运行结果或交给 qa 后追加。

## 2026-10-03 14:22 · America/Vancouver · LF-005 独立复核

- Status: verified（范围仅为开发工作流；应用尚未实现）。
- Owned files: `docs/memory/roles/qa/memory.md`、`docs/memory/roles/qa/journal.md`。

### 已完成

- 阅读 AGENTS/PRD/WORKFLOW、公共记忆、QA 原有记忆，核对工作流脚本、项目配置模板及角色 TOML。
- 运行 `python3 scripts/check-workflow.py`：exit 0，输出 `PASS: roles, ownership memory files, local links, Codex config, shell syntax, and ignored local data.`
- 运行 `codex mcp get livingforma_memory --json` 并脱敏：exit 0；项目 server 为 enabled stdio，command / args / cwd 正确，允许工具为 read_note/search_notes/write_note/edit_note/build_context/recent_activity/list_directory。
- 用环境包元数据核对 Python 3.12.14 / Basic Memory 0.23.2 / FastMCP 4.0.0b1 / MCP 2.3.0；核对隔离 Basic Memory 配置的关闭选项与 local 项目目录。
- 运行 `git check-ignore`，确认 smoke 报告/日志、配置备份、索引配置及机器专属 Codex 配置被忽略。
- 结构化比较用户 Codex 配置与私密备份，输出布尔核对结果；未输出配置正文、模型设置或其他用户配置内容。

### 已核实的现有执行证据

- `.local/memory-smoke-report.json` 时间为 2026-10-03T21:20:11Z，即 Vancouver 14:20:11；success 和 cleanup_reindex_ok 均为 true。
- 审阅 smoke 源码后确认报告的六项检查确实对应：真实 MCP initialize/工具发现、两个独立进程对不同笔记并发写入、跨客户端互读、文本检索、新进程重启后读取持久内容、读取已有 shared context。
- smoke 日志关键错误/警告文本搜索无匹配。按 coordinator 要求没有重跑 smoke，避免无新原因重复测试。
- 用户配置只新增本仓库确切项目路径的 trusted 状态；其他项目与顶层设置相等，备份权限 0600。

### 结论与限制

- 本轮未发现阻塞当前工作流的错误；可把 LF-005 的脚本/配置与上述 MCP 证据范围交给 coordinator 标记 verified。
- named roles / MCP 是否在当前或新 Codex chat 中实际加载仍需界面/会话确认；CLI 成功不能当作热加载证据。
- 不同文件并发和重启持久化已由现有报告覆盖；同文件并发覆盖、全部工具行为、跨机器共享及产品端功能不在本轮证明范围。
- 依赖 freeze 为当前安装证据，不是完整可重现锁；当前 requirements 固定 Basic Memory，升级或新机器安装时仍需核对间接依赖。
- 仅修改分配的两个 QA 文件；无其他修复、外部服务调用、commit 或 push。

### 下一步 / 共享事实提案

- coordinator 记录安装版本、真实 stdio smoke 成功、精确项目信任范围和新 chat 加载限制。
- 新 LivingForma chat 验证角色/工具加载后，再由 coordinator 单独授权产品实现和产品 QA 验收。

## 2026-10-03 14:23 · America/Vancouver · LF-005 新环境验证等待

- Status: in-progress，supersedes 14:22 中对当前完整工作流的 verified 状态；历史检查结果仍有效。
- coordinator 报告已将六项不必要的预发布间接依赖替换为稳定解析版本，并重新运行 smoke；即时搜索未找到新笔记，正在调查索引延迟和补充有界重试。
- QA 没有重跑 smoke。独立读取当前 `.local/memory-smoke-report.json`：运行开始于 14:21:58，success=false、cleanup_reindex_ok=true，仅前三项通过，错误为 ExceptionGroup。
- QA 运行 `.local/memory-venv/bin/python -m pip check`：exit 0，`No broken requirements found.`。包元数据仍为 Basic Memory 0.23.2 / FastMCP 4.0.0b1 / MCP 2.3.0。
- 当前限制：根因与修复尚未核实；此前全链路通过报告不能作为新环境最终结果。等待 coordinator 通知完成后复核新脚本、报告和证据，再更新 QA 状态。

## 2026-10-03 14:24 · America/Vancouver · LF-005 最终证据复核

- Status: verified（开发工作流范围），supersedes 14:23 的等待状态；没有新增产品验收结论。
- 读取最终 `.local/memory-smoke-report.json`：2026-10-03T21:23:03Z，六项实际检查均通过，success=true、search_attempts=1、cleanup_reindex_ok=true。
- 阅读变更后的 smoke 源码：检索有界为十次、每次空结果后等待一秒；超限仍抛出失败并保存检索结果。没有通过忽略 assertion 或无限重试掩盖失败。本次实际首个搜索就命中；并未实际触发所有重试路径。
- 阅读 AGENTS / WORKFLOW 新增恢复约定：用已知路径确认文件已写入，搜索短暂重试，不能因为空结果重复创建笔记。
- 阅读 memory.sh 与已安装 FastMCP settings.py：FASTMCP_CHECK_FOR_UPDATES=off、FASTMCP_SHOW_SERVER_BANNER=false 字段名和类型受当前版本支持。此项为设置核对，不是网络抓包审计。
- 查看当前依赖元数据：仍有 fastmcp / fastmcp-slim 4.0.0b1、logfire-sdk 6.0.0b7、opentelemetry-semantic-conventions / opentelemetry-instrumentation 0.65b0；不声称所有依赖为稳定版。14:23 已独立运行的 pip check 为 clean。
- 无新阻塞发现；按要求未重复 smoke 或其他已通过测试。最后修改仍只有 QA memory/journal，无 commit/push。
- 交接：coordinator 可按最终证据完成 LF-005。剩余边界是新 Codex chat 工具/角色加载、同文件并发和产品功能，需对应后续任务验证。
