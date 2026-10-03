---
title: LivingForma QA memory
type: note
permalink: livingforma/roles/qa/memory
updated: 2026-10-03
timezone: America/Vancouver
---

# QA 角色记忆

负责独立核对事实与验收证据。先读 PRD 和任务板，再验证分配范围。当前应用尚未实现；LF-005 的验证对象仅为开发工作流脚本、配置和本地 MCP 记忆。

**当前 LF-005：verified（仅为工作流范围）。** coordinator 调整依赖并为检索增加有界等待后，14:24 独立复核最终报告成功。14:22 初次成功和14:23 暂时失败都作为历史证据保留；产品应用和当前 Codex chat 热加载仍不包含在此结论中。

## 已完成

- 独立阅读 setup-workflow、setup-memory、configure-memory、memory/server/smoke 入口与 smoke Python 源码、角色 TOML、工作流文档和本地配置。
- 运行 `python3 scripts/check-workflow.py`；exit 0，角色/记忆文件、本地链接、TOML、shell 语法和本地数据忽略规则通过。
- 运行 `codex mcp get livingforma_memory --json`，仅输出脱敏后的指定项目检查结果；exit 0，CLI 能读取项目配置，stdio 的 command / args / cwd 与 7 个 enabled_tools 匹配。
- 复核 coordinator 已运行的 `.local/memory-smoke-report.json` 和对应脚本；未重复执行 smoke。
- 对用户配置及私密备份做结构化脱敏比较，核对只增加 LivingForma 确切路径的信任。

## 已核实

- 安装环境为项目内 Python 3.12.14；Basic Memory 0.23.2、FastMCP 4.0.0b1、MCP SDK 2.3.0。Basic Memory 元数据明确要求 FastMCP 4.0.0b1。
- `.local/basic-memory/config.json` 只有一个 local project，路径为本仓库 `docs/memory`；SQLite、默认项目、关闭 semantic search / auto update / Logfire / frontmatter 自动写入的设置与脚本一致。
- 初次查看的 2026-10-03 14:20:11 America/Vancouver smoke 报告为 `success=true`、`cleanup_reindex_ok=true`。这是调整依赖前的历史证据。源码确实使用独立 stdio 服务器进程，检查 initialize / 工具发现、不同笔记并发写入、互相读取、文本搜索、停止后新进程读取持久内容和已有公共背景。
- 14:23 独立复核最新报告（14:21:58 开始）为 `success=false`、`cleanup_reindex_ok=true`；只完成 initialize/工具发现、双进程不同笔记写入和互读，错误为 ExceptionGroup。coordinator 报告即时搜索未找到新笔记，正在调查索引延迟；根因和修复效果尚未独立核实。
- 14:23 运行项目环境 `python -m pip check`：exit 0，`No broken requirements found.`；这不能代替搜索与重启持久化验证。
- 14:24 读取最终报告（14:23:03 开始）：六项 checks 均通过，success=true、search_attempts=1、cleanup_reindex_ok=true。复核当前脚本后确认全文检索最多尝试十次、间隔一秒，并保留超限失败；不是无限重试或把空结果判为成功。
- AGENTS / WORKFLOW 已记录“已知路径读取、搜索短暂重试、不重复创建笔记”的恢复规则。memory.sh 新增的 FASTMCP_CHECK_FOR_UPDATES=off / FASTMCP_SHOW_SERVER_BANNER=false 与已安装 settings schema 名称和类型一致。
- smoke 日志未找到 ERROR / Traceback / RuntimeError / database is locked / WARNING 文本。此项不是网络流量或所有运行日志的审计。
- 用户配置与备份的唯一结构变化是 `/Users/fanhaocheng/project/livingforma` 项目的 `trust_level=trusted`；其他项目和顶层设置不变，备份文件权限为 0600。未打印用户配置正文。
- 运行报告、运行日志、私密配置备份、索引配置和机器专属 `.codex/config.toml` 均被 Git 忽略。
- 初次配置检查与最终 MCP 报告均无阻塞当前工作流的错误；之前的即时搜索失败已由最终实际报告和有界等待协议覆盖。只写本角色 memory/journal；未改其他文件、未 commit/push。

## 验证边界

- CLI 读取项目配置、真实 stdio 协议已执行不等于当前 Codex chat 已热加载 MCP 或所有 named roles；新 LivingForma chat / 重新连接后仍应确认工具可用。
- smoke 并发写的是不同文件，不能证明同一 Markdown 的并发修改安全。仍遵守单角色单写入、shared 文件 coordinator 单写入。
- 7 个工具通过发现检查；实际调用覆盖 write_note / read_note / search_notes，不表示 edit_note / build_context / recent_activity / list_directory 的全部行为已测。
- Basic Memory 版本固定，实际依赖 freeze 已记录；`memory-installed.txt` 是证据而非完整依赖锁，新机器解析间接依赖仍可能变化。
- 六项不必要的预发布间接依赖已由 coordinator 替换；环境仍有 FastMCP/FastMCP-slim、Logfire SDK 和部分 OpenTelemetry 的预发布版本。不能把安装环境概括为“所有包均稳定版”；版本清单与 pip check 才是具体证据。
- 未验证应用、Gemini/Pi、ElevenLabs、Tiger Data、DNS、部署或任何业务接口。没有产品“测试通过”的主张。

## 待办

1. coordinator 按最终 smoke 及独立检查更新 LF-005 状态，保留已知索引延迟和新 chat 加载限制。
2. 新项目 chat 确认 named roles 和 `livingforma_memory` 工具实际可用，使用本地 Markdown 回退路径恢复。
3. 产品实现任务另行分配后，再执行 PRD 的通用生成、非破坏演化、多人同步、权限和受控能力验收。
