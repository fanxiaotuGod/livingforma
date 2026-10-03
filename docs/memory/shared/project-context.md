---
title: LivingForma project context
type: note
permalink: livingforma/shared/project-context
---

# 当前项目背景

- [confirmed] 项目名 LivingForma；GitHub: https://github.com/fanxiaotuGod/livingforma
- [verified] 域名管理页已核对 livingforma.tech 注册于 2026-10-03、到期于 2027-10-03；DNS、HTTPS 与正式部署尚未验证。
- [confirmed] 产品优先通用 App 生成与持续迭代；弱化活动场景（用户于 2026-10-03 确认）。
- [confirmed] 免费额度优先；任何收费前确认（用户于 2026-10-03 确认）。
- [confirmed] 首轮演示为读书记录 + 习惯打卡；仅为通用运行时的验收样例（用户于 2026-10-03 确认）。
- [confirmed] Google OAuth 登录由 DevOps 主责；Backend 管内部用户映射和空间授权，Frontend 管登录 UI。部署目标为 livingforma.tech。
- [decision] Tiger Data 为首选 PostgreSQL 候选，先核实 Shared Free；Snowflake 仅候选分析层，Gemini/ElevenLabs 适配由 Agent 负责。
- [workflow] 各对话通过 scripts/coordination.py 自动领取 .codex/coordination.json 的下一项可执行任务；实时认领不能由 MCP 搜索空结果推断。角色归属见 docs/ROLE-OWNERSHIP.md。
- [confirmed] 状态、界面与能力分离；保留共享数据，界面持续变化。
- [current] 应用尚未实现。本次完成的是团队开发工作流和产品/架构文档。
- [proposed] React/Next.js/TypeScript/Motion，Node/TypeScript，Pi + Gemini，Postgres/Tiger Data；具体选型以 PRD/决策记录为准。
- [proposed] ElevenLabs 语音入口和回复；Snowflake、3D 作为后续评估项。
- [current] Devpost 已保存名称、tagline、开发中项目故事和 GitHub 链接；视频和实际技术集成尚未提供，尚未最终提交。
- [rule] 不复制此前截图中的 API key。只记录所需环境变量名，凭据由后端私密环境提供。

## Relations

- implements [[decisions]]
- coordinated by [[task-board]]
- governed by [PRD](../../PRD.md)
