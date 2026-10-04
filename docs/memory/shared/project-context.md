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
- [decision] 生产数据库已选 Neon Free 并通过严格 TLS 与真实业务写入验证。Tiger Shared Free 因证书链问题未启用，不禁用TLS；Snowflake 仍仅候选分析层。
- [workflow] 各对话通过 scripts/coordination.py 自动领取 .codex/coordination.json 的下一项可执行任务；实时认领不能由 MCP 搜索空结果推断。角色归属见 docs/ROLE-OWNERSHIP.md。
- [confirmed] 两条主线：前端可玩性/变换性 + 后端 Pi 工具创建/复用；主动分类用户场景，预制丰富可信组件库，Agent 自主选择组合。见 docs/product/use-case-capability-map.md；不是只做固定模板或语音聊天。
- [confirmed] 状态、界面与能力分离；保留共享数据，界面持续变化。
- [current] 2026-10-03 LF-150文字基础与LF180/181/182媒体模块完成：Google Owner、Gemini3.5-flash-lite、Neon、12组件6皮肤、Pi工具审批注册复用、记录/URL保留和SSE实测。LF185真实语音已发布保留数据的界面变形，camera配额停止与设备生命周期UI通过，真实vision/TTS适配器各自通过；完整camera UI真实服务往返、播放、停止及访客隔离于2026-10-04 00:00 UTC通过。最终100自动测试、TypeScript与生产构建通过；正式域名尚未上线。
- [implemented] Vite/React/TypeScript/Motion + Fastify同源生产服务已锁定和构建；Pi1.0.1实际SDK和Gemini已集成，Neon/PGlite共用SQL。
- [confirmed] Jarvis 式语音对话改站及相机观察/ElevenLabs 播报是明确产品里程碑；文字先验证基础，语音不再永远 optional。Snowflake、3D 仍为扩展。
- [confirmed] Owner 左上角小圆圈扩展到中央输入/语音；访客只看网站，匿名可浏览、写入再登录，登录不授予 Owner 权限。
- [confirmed] 组件持续增长：变体、强调规则、calendar-grid、6套精选皮肤；schema与manifest已接受并实现，camera在LF180浏览器验证后升为available。相机/麦克风仅本客户端显式启动，媒体不随共享快照/SSE广播。
- [verified] 用户授权后安装 frontend-dev（98 个源文件）与 animations（23 个源文件），按固定 upstream commit 逐文件 hash 校验，保留 MIT LICENSE。前端按 docs/frontend/skills-guide.md 使用；未执行素材脚本、API 或安装 app 依赖。版本记录 .codex/third-party-skills.json，新窗口指令 docs/product/start-development.md。
- [current] Devpost 已保存名称、tagline、开发中项目故事和 GitHub 链接；视频和实际技术集成尚未提供，尚未最终提交。
- [rule] 不复制此前截图中的 API key。只记录所需环境变量名，凭据由后端私密环境提供。

## Relations

- implements [[decisions]]
- coordinated by [[task-board]]
- governed by [PRD](../../PRD.md)

- [confirmed] 用户开发中明确：产品界面为英文，开发沟通可中文；英文覆盖按钮/错误/示例/生成App默认文案。

- [current] 真实调用全部使用Neon持久预算；2026-10-03 UTC已预留30/30 Gemini请求，已自然日切至2026-10-04且当前1/30，CLI旧JSON22仅历史。ElevenAPI included余额/AutoTopUpOFF已只读核实；固定验证期STT5/60秒、TTS316/1000字符，不自动按日重置，不新增收费。
- [verified] 本地生产Docker镜像连接真实Neon，健康、匿名snapshot、SPA深链、CSP/设备策略、关闭测试登录均通过；证据LF-185-production-smoke.json。此结果不证明livingforma.tech或生产Google回调已上线。
- [confirmed] 用户已自行创建并登录Render，明确批准把现有GoogleOAuth/Neon/Gemini/ElevenLabs配置保存到Render服务端私密环境，继续免费部署且不添加付款方式。LF160已通过，LF170在部署；域名上线仍须实测。
