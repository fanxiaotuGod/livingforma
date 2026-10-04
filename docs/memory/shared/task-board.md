---
title: LivingForma task board
type: note
permalink: livingforma/shared/task-board
---

# 任务板

仅 coordinator 写。本轮更新产品方向、角色文档与任务目录：前端组合/变形、Pi 工具创建/复用、Owner orb 和语音/相机里程碑。应用已开始实际实现；当前生产上线仍待后续验收。此表是摘要；实时认领/完成状态以 `python3 scripts/coordination.py status` 为准，任务定义来自 `.codex/coordination.json`。

| ID | Owner | Task | Status | Evidence / next |
| --- | --- | --- | --- | --- |
| LF-001 | coordinator | 多 agent 规则、角色配置、共享记忆工作流 | verified | AGENTS.md、.codex/、docs/WORKFLOW.md；新 chat 加载 |
| LF-002 | frontend | 通用产品 PRD 与前端 runtime 计划 | verified（文档） | PRD/前端计划已对齐；读书记录+习惯打卡已确认 |
| LF-003 | backend | 状态/版本/实时/ToolSpec 架构提案 | verified（文档） | docs/architecture.md；候选命名已对齐，非应用实现 |
| LF-004 | devops | 本地 MCP 研究、安装与部署约定 | verified | shared/setup-verification.md；未部署应用 |
| LF-005 | qa | 验证配置、文档、MCP 跨客户端读写 | verified | roles/qa/journal.md；最新 smoke 六项通过 |
| LF-006 | coordinator | 独立对话自动任务/路径认领；Google OAuth 与服务归属 | verified（工作流） | 30 项脚本测试、10 任务临时仓库流程、配置/链接检查通过；见 setup-verification.md |
| LF-007 | frontend | 扩展组件、Owner orb、动效与 skills 使用约定 | verified（文档） | experience-direction、skills-guide、runtime-plan、独立交接；未实现组件 |
| LF-008 | agent | 语音/视觉、工具创造与能力装配方案 | verified（文档） | multimodal-plan、官方资料核查与独立 handoff；未调用 API |
| LF-009 | devops | 公开读/登录写、SPA 路由与媒体部署约定 | verified（文档） | operations 文档、own memory 与 handoff；未配置 OAuth/部署 |
| LF-011 | frontend | 已安装第三方 skills 的使用适配与角色交接 | verified（文档） | frontend-dev / animations，98/23 源文件比对、Codex skills/list enabled；skills-guide 与独立 handoff |
| LF-100 | coordinator | 应用骨架、组件 manifest、Pi registry 与 Google session 契约 | verified | pnpm typecheck/test/build，4 项契约测试，API/Vite HTTP smoke，Pi core 构造/registry smoke；详见 LF-100 handoff |
| LF-110 | frontend | 丰富组件库/组装、Owner orb、变形与访客登录 UI | verified | 11组件/6皮肤英文UI；真实CRUD/独立SSE/blank/offline/mobile与fixture变形证据；见frontend LF110 handoff |
| LF-120 | backend | Tiger Data/Postgres、用户映射、权限/API/SSE | verified | 12项真实PGlite/Fastify测试、磁盘重启、APIbuild/typecheck；生产Docker已连接Neon，用户业务流程仍待整合 |
| LF-130 | agent | Pi/Gemini 装配 Planner、工具创建/注册/复用与基础适配 | verified | 真Gemini reading/habits/patch与工具调用，真OpenLibrary+审批注册复用+审计，10单测；CLI budget22/30需迁移 |
| LF-140 | devops | Google OAuth/session、免费资源核查、部署准备 | verified | 真实Google登录刷新退出、17安全测试、Neon严格TLS、免费用量与Docker/CI准备；正式Render/域名待LF170 |
| LF-145 | coordinator | 并行阶段的共享接口、依赖与任务板维护 | verified | 四角色handoff已审核，shared契约/预算/媒体接口及依赖准备完成 |
| LF-150 | coordinator | 文字基础、组件组装、Pi 工具闭环与多人同步整合 | verified | 真GoogleOwner+Gemini+Neon两类app/变形/数据URL/SSE/工具审批复用；QA14718/18，见LF150证据 |
| LF-180 | frontend | 语音 orb、相机组件与本地设备生命周期 | verified | 11 虚拟设备浏览器检查、5 媒体单测、12 组件回归；真实 UI 整合由 LF185 承接 |
| LF-181 | agent | 语音改站、Gemini 看图与 ElevenLabs 播报 | verified | 实际 STT/vision/TTS、23 单测；真实 voice Apply 已发布 habit v2；完整相机 UI 由 LF185 承接 |
| LF-182 | backend | 媒体会话鉴权/配额、短期传输与数据隔离 | verified | 13 媒体 host + 4 budget 测试，取消/退出/过期/跨会话隔离通过 |
| LF-185 | coordinator | Jarvis 真实语音/相机整合与数据保留 | verified | 实际voice→v2、camera→vision→speech→browser播放、停止/访客隔离/记录保留；LF-185-camera-live-evidence.json，100 tests + GitHub CI通过 |
| LF-155 | coordinator | QA/部署期间目录维护与返工安排 | handoff | 正在释放给用户授权的60模块扩展coordinator；DevOps170继续固定7efaa91发布，见module-expansion-handoff |
| LF-160 | qa | 独立 MVP 验收 | verified | LF-160-acceptance.md及evidence.json，100tests CI、独立18浏览器及安全复验、真实服务证据一致性；上线门槛留LF170 |
| LF-170 | devops | 部署到 livingforma.tech、生产登录与 HTTPS 验收 | in progress | QA已通过；用户已创建/登录Render，并明确授权现有凭据写入Render私密环境；仅Free、不添加付款方式 |

原 LF-010～014 backlog 已由上述可执行任务目录取代，尚未执行的旧任务不能当作已完成依赖。Snowflake 功能有负责人，但先作为可选分析项，待用途与额度验证后再由 coordinator 加入任务目录。

2026-10-03 新目录验证：17 项实际任务在临时 Git 仓库完成文档/文字/多模态/QA/部署路由模拟，包括阻止越过依赖、维护认领释放后整合。证据 `.local/vision-catalog-smoke-report.json`；这只验证工作流，不完成真实产品任务。下一应用任务仍为 LF-100。

第三方 skills 安装补充：用户授权后两项完整安装并被本地 Codex scanner 识别；目录版本现为 6，共 18 项任务（新增 LF-011 文档任务，不改变应用依赖）。来源 .codex/third-party-skills.json；新窗口入口 docs/product/start-development.md。产品任务仍待 LF-100 开始。

## 本轮开发补充任务

- LF-122（Backend，verified）：已完成LF120之上的工具审批桥接；pending ToolSpec不提前发布，Owner显式enable后重新规划绑定。LF150新增此依赖。
- LF-146（QA，verified report：15/16通过，mobile待修）：早期本地/英文/权限/连续性独立回归，保留LF160真实多模态及最终验收标准。
- 当前catalog revision10（digest 6a2ee3a5…），Google真实roundtrip由DevOps已执行，私密凭据在ignored .env；未上线。

LF-147 独立复验18/18通过：公开投影与320/390/430px rating溢出均修复。catalog revision11（digest7c835706…）。LF150真实云服务整合完成；语音/相机与正式部署尚未完成。


LF-148（DevOps，verified）：生产配置与私密环境已对齐实际 gemini-3.5-flash-lite、真实规划模式、server-only speech 配置；18 项只读发布预检通过。Catalog revision12，digest dd37a964…。Gemini 2026-10-03 UTC 用量30/30，STT5/60秒、TTS153/1000字符，禁止重置额度。Render 条款确认仍待用户回答，尚未部署。

LF185 独立只读 QA 发现并复现等待中的 proposal 可在 logout 后发布，已由 coordinator 修复并通过独立复验；补充工具并发窗口和 includeSpeech=false 复验通过。完整 release QA160 尚未开始，不把这些局部证据标成最终验收。

2026-10-03 16:50 America/Vancouver：最终 pnpm check 100/100、TypeScript、web/API生产构建通过；新增pg空闲连接断开故障处理及回归。QA独立访问生产Docker中两个匿名深链，资源/CSP/SSE/英文UI均通过，无Owner控制、JS错误或横向溢出。实际camera成功链路仍待UTC日切；正式QA160与发布170尚未完成。
