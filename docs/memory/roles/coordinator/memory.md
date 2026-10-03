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
每次分工指定 task ID 和文件 owner；公共任务板/决定/接口由 coordinator 单写。后续实现从 LF-010 接续。

候选接口已统一命名，但完整 schema/鉴权/部署未定稿。不要把设计文件当作已实现代码。用户于 2026-10-03 已明确授权提交并推送工作流；实际发布版本以 Git 历史及远端 main 为准。本次没有应用部署和云资源开通。
