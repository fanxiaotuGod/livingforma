---
title: LivingForma task board
type: note
permalink: livingforma/shared/task-board
---

# 任务板

仅 coordinator 写。本轮准备角色与认领工作流，产品实现留给新的开发对话。此表是摘要；实时认领/完成状态以 `python3 scripts/coordination.py status` 为准，任务定义来自 `.codex/coordination.json`。

| ID | Owner | Task | Status | Evidence / next |
| --- | --- | --- | --- | --- |
| LF-001 | coordinator | 多 agent 规则、角色配置、共享记忆工作流 | verified | AGENTS.md、.codex/、docs/WORKFLOW.md；新 chat 加载 |
| LF-002 | frontend | 通用产品 PRD 与前端 runtime 计划 | verified（文档） | PRD/前端计划已对齐；读书记录+习惯打卡已确认 |
| LF-003 | backend | 状态/版本/实时/ToolSpec 架构提案 | verified（文档） | docs/architecture.md；候选命名已对齐，非应用实现 |
| LF-004 | devops | 本地 MCP 研究、安装与部署约定 | verified | shared/setup-verification.md；未部署应用 |
| LF-005 | qa | 验证配置、文档、MCP 跨客户端读写 | verified | roles/qa/journal.md；最新 smoke 六项通过 |
| LF-006 | coordinator | 独立对话自动任务/路径认领；Google OAuth 与服务归属 | verified（工作流） | 30 项脚本测试、10 任务临时仓库流程、配置/链接检查通过；见 setup-verification.md |
| LF-100 | coordinator | 应用骨架、共享类型与 Google session 契约 | queued | 首项可领取；产品任务尚未开始 |
| LF-110 | frontend | 通用 renderer、登录 UI、语音控件 | queued | 依赖 LF-100；apps/web/src 与 public |
| LF-120 | backend | Tiger Data/Postgres、用户映射、权限/API/SSE | queued | 依赖 LF-100；真实登录在整合后验证 |
| LF-130 | agent | Pi/Gemini planner、受控工具、ElevenLabs 适配 | queued | 依赖 LF-100；文字主链路优先 |
| LF-140 | devops | Google OAuth/session、免费资源核查、部署准备 | queued | 依赖 LF-100；packages/auth 与运维范围 |
| LF-145 | coordinator | 并行阶段的共享接口、依赖与任务板维护 | queued | 依赖 LF-100；不改角色正在写的应用代码 |
| LF-150 | coordinator | Google 登录与生成/数据/多人同步完整整合 | queued | 依赖四个角色任务及 LF-145 |
| LF-155 | coordinator | QA/部署期间目录维护与返工安排 | queued | 独立维护入口，通常整合后使用；空闲时 release 保留以后可领取 |
| LF-160 | qa | 独立 MVP 验收 | queued | 依赖 LF-150；缺陷回到 owner，不能无证据放行 |
| LF-170 | devops | 部署到 livingforma.tech、生产登录与 HTTPS 验收 | queued | 依赖 LF-160；收费前确认 |

原 LF-010～014 backlog 已由上述可执行任务目录取代，尚未执行的旧任务不能当作已完成依赖。Snowflake 功能有负责人，但先作为可选分析项，待用途与额度验证后再由 coordinator 加入任务目录。
