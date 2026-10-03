---
title: LivingForma coordinator memory
type: note
permalink: livingforma/roles/coordinator/memory
---

# 协调者记忆

用户于 2026-10-03 要求建立固定前端、后端、Agent、DevOps 角色及个人日志、公共记忆和本地 memory MCP，并在 docs 维护 PRD。
用户随后确认：
1. 优先通用 App 生成，弱化活动场景。
2. 免费额度优先，收费前确认。
3. 首轮演示为读书记录 + 习惯打卡；作为通用生成验收样例。

当前实施仅覆盖开发工作流和文档。五个角色配置已生成，当前同时最多三个 child agents。Basic Memory 0.23.2 已安装，跨进程读写、检索和重启持久化通过；最新证据见 shared/setup-verification.md。Codex CLI 已识别本项目 MCP；新聊天/重连后加载。
角色、服务与代码目录见 docs/ROLE-OWNERSHIP.md 和 docs/integrations.md。各对话使用 scripts/coordination.py 自动领取 .codex/coordination.json 的任务及路径，不再依赖用户手工指定文件。公共任务板/决定/接口仍由 coordinator 单写。应用实现从 LF-100 接续，完成后 LF-145 协调各角色，LF-150 整合，LF-155 为可重复领取的独立维护入口，LF-160 QA，LF-170 部署。目录改动仅由已持有目录范围的 coordinator 使用旧摘要 CAS 显式发布，避免旧 worktree 覆盖新进度。

用户进一步确认 Google OAuth 登录由 DevOps 负责、部署目标 livingforma.tech；Tiger Data 为优先主库候选。Backend 管内部用户与空间授权，Agent 管 Gemini/ElevenLabs，Snowflake 为可选分析；应用仍未实现。域名注册已只读核验；账户额度/续订细节在忽略的 .local/service-status.json，不能当作已获免费调用许可。

候选接口已统一命名，但完整 schema/鉴权/部署未定稿。不要把设计文件当作已实现代码。用户于 2026-10-03 已明确授权提交并推送工作流；实际发布版本以 Git 历史及远端 main 为准。本次没有应用部署和云资源开通。
