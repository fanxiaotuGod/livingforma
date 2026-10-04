---
title: LivingForma accepted decisions
type: note
permalink: livingforma/shared/decisions
---

# 已接受决策

## D-028 · 2026-10-04 00:35 America/Vancouver · 有界冷启动与工具执行分阶段

单并发和移除Worker运行时schema/parser导入后，实际Free0.1CPU/512MiB的完整adapter测试仍有冷启动超过4秒；证据保留在Backend LF229 performance.json。D027的4秒**总**deadline不能宣称验收通过。改为明确且有界的启动8秒、guest执行4秒、单Worker总计最多12秒；只有宿主可信Worker就绪后才进入执行阶段，parent仍终止超时/取消。全局并发1、guest heap32MiB/stack256KiB/Broker8和所有权限不变。API invoke14秒、registry test batch65秒；网站生成90秒、独立tool proposal30秒仍为更严格的整体工作期限，超过则真实失败。无偷偷预热或无限等待，不增加费用。LF229须同Free规格实测全部检查通过后完成。

## D-027 · 2026-10-04 00:17 America/Vancouver · 免费规格单工具并发

实际 compiled Docker 在0.1 CPU/512 MiB下，单QuickJS工具2.7–3.2秒通过，但两个冷Worker同时超过原4秒deadline。共享限额改为全进程1个并发，保留4秒deadline；额外请求立即TOOL_BUSY，不启动第二Worker。LF229验证完成/取消释放容量、持久requestId重试语义，并由DevOps在相同免费规格复验。LF227依赖LF229，catalog18；收费仍须用户先批准。此决策取代此前concurrency2规格，不扩大执行权限，也不重置账本。

## D-026 · 2026-10-03 23:40 America/Vancouver · 原创工具与真实动态 UI

用户当前 goal 要求 AI 前端页面、后端新工具及生成中 UI 变形。接受 [generated-tools](../../product/generated-tools.md) 和代码契约：code-js-v1 原创 JavaScript/schema/2–5 JSON测试，QuickJS/WASM Worker执行；Broker 仅提供声明的当前空间公开字段和已启用精确版本连接器。无宿主 Node/shell、密钥、任意网络或收费能力。guest heap/stack/deadline 不等于整个 Worker RSS 硬隔离，当前不承诺跨副本外部 exactly-once。

候选可附 codeToolProposals，经宿主测试后 Owner 显式 Publish 原子注册/启用/发布。组件 toolId/version 跨 kind 唯一；预览不运行后端工具，提示 Publish to run tool。UI/source/tool事件来自实际模型参数与宿主测试。高级绕过复现暂停，QA 做普通功能/权限/隐私/版本验证与已有防御证据审阅。LF221/224/225/226→LF223/227→LF228，尚未上线。

LF170 初版生产与403修复已完成真实验收：eedd1d4、CI37166475387、Render dep-db0q9nvavr4c738sqtqg，Free/AutoDeployOFF。60模块与新生成仍本地；旧上线证据不能当作新功能完成。

## D-001 · 2026-10-03 · 通用生成优先

来源：用户明确选择“优先通用 App 生成，弱化活动场景”。
结论：自然语言创建 App 并持续修改布局、字段、交互和能力为主线。Todo、签到、投票等只是示例。3D 暂为扩展，不强制 Discord 集成。

## D-002 · 2026-10-03 · 免费优先

来源：用户确认。
结论：先用免费额度；任何新增收费、付费资源、套餐升级前须确认。DevOps 提供可审核的方案和费用再行动。

## D-003 · 2026-10-03 · 固定角色、按任务启动

来源：用户授权多 agent 分工，coordinator 采用本环境并发限制。
结论：frontend / backend / agent / devops / qa；主 agent 协调。最多同时三个子 agent；不指定模型覆盖。角色通过文件恢复记忆，不依赖永续会话。

## D-004 · 2026-10-03 · 本地记忆

来源：本次研究与工作流设计，见 docs/research/local-memory.md。
结论：Basic Memory 0.23.2，项目独立运行环境和索引，Markdown 在 docs/memory。关闭云端路由、自动更新、语义模型下载与遥测。角色各自日志；公共文件 coordinator 单一写入。
安装与验证结果单独记录，决策本身不证明服务已连接。

## D-005 · 2026-10-03 · 先生成受约束的规范

来源：原始产品 brief，适用于通用生成。
结论：AppSpec / ToolSpec 表达能力内优先生成规范；由程序校验执行。通用不等于无限代码执行，未支持的请求应说明限制或进入后续能力规划。

## D-006 · 2026-10-03 · 首轮演示样例

来源：用户明确选择“读书记录 + 习惯打卡”。
结论：两类 App 由同一套运行时生成；读书空间先创建记录，再加评分字段和排序，证明旧数据保留。样例不改变产品的通用生成定位。

## D-007 · 2026-10-03 · 自动任务与文件认领

来源：用户希望不同独立对话通过共享记忆自行判断文件职责。
结论：Markdown/MCP 保存上下文与交接，Git common directory 下的 SQLite 记录实时认领；agent 从预先分工的任务目录自动领取依赖已满足的工作。父子路径冲突、同角色的第二个活跃任务拒绝；无自动过期抢锁。coordinator 对新任务扩充目录，用户不必逐个指明文件。机制为协作协议，不能阻止绕过脚本的写入。

## D-008 · 2026-10-03 · Google 登录与生产域名

来源：用户明确指定 DevOps 负责 Google OAuth，网站部署到 livingforma.tech。
结论：DevOps 主责 provider、packages/auth、session/退出与部署；Backend 维护用户映射/数据迁移及空间授权；Frontend 实现登录 UI。OAuth client 与 Gemini key 分离。当前准备后续开发，尚未实现或上线；收费前确认仍有效。

## D-009 · 2026-10-03 · 服务归属

来源：用户提供已打开的服务页面；coordinator 结合产品主链路安排。
结论：Backend 优先评估 Tiger Data Shared Free 为单一业务主库，负责可选 Snowflake 脱敏事件分析；Agent 负责 Gemini 规划和 ElevenLabs 服务端语音，Frontend 提供语音控件，DevOps 管私密配置与用量。账号存在不等于 API 已集成，试用不是长期免费承诺。

## D-010 · 2026-10-03 · Jarvis 与持续成长的组件目录

来源：用户认可扩展组件并明确语音对话改站、相机观察与播报的中心设计。
结论：书籍/习惯只是起点，增加变体、强调规则、calendar-grid、精选皮肤及版本化能力注册；语音和相机由新里程碑 LF-180/181/182→185 实现，不再作为长期 optional。组件缺口进入开发/验证/注册流程，不能假装当前已经支持。3D 保持扩展。取代旧“四类组件为上限、语音只是增强”的规划。

## D-011 · 2026-10-03 · Owner 圆圈与匿名浏览

来源：用户明确选择左上角小圆圈放大到中央，输入想法；并回答匿名可浏览、写入再登录。
结论：Owner-only orb 替代聊天侧栏/固定底部命令条；Visitor 看公开网站本身，写入登录后仍须空间授权。Google 登录不是 Owner 凭证。公开投影不含私有字段/草稿；相机/麦克风只属于当前用户主动开启的本地会话。

## R-012 · 2026-10-03 · 框架与前端技能建议（尚待实现验证）

来源：用户询问 Vite 或 Next.js；coordinator 与 DevOps 只读评估。
建议：Vite + React + TS SPA、Motion/Tailwind/Radix，独立 Node API 可同源托管静态资源/认证/SSE/后续媒体会话，LF-100 验证锁定。Next.js 可用于日后需要 SSR/SEO/动态元数据的场景，未被认定不能实现本产品。Frontend 采用 animations 适配要求和 MiniMax frontend-dev 视觉规范节选，排除强制额外素材 API 与冲突的 GSAP 规则；本轮只记录，未安装第三方 skills。

## D-013 · 场景驱动组件库与 Pi 工具创造是两条主线

2026-10-03 用户再次确认：前端的可玩性/变换性、后端通过 Pi 创建和复用工具。团队主动提出并分类 user cases，提前建设丰富可信的前端组件库与 manifest，让 Agent 自主选择、组合、绑定数据和动作。读书/习惯/相机是验证场景，不能变成固定模板或把产品收缩成语音助手。场景与组件候选池见 docs/product/use-case-capability-map.md；候选尚未实现，也不全部纳入首版强制交付。Pi 负责 Agent/工具编排，宿主负责新工具验证、注册、执行边界和持久化；首个 GET 示例是起点而非永久能力上限。

## D-014 · 2026-10-03 · LF-100 实施定稿

已开始应用开发，保留启动时全部未提交修改。采用 pnpm workspace、Node >=22.19、Vite/React/TypeScript/Motion、Fastify 同源生产服务、Zod 契约。Google OIDC 使用 openid-client 6.8.8，由 DevOps 实现，回调 /auth/google/callback。Pi 使用 @earendil-works/pi-agent-core 1.0.1 嵌入路径；安装包 constructor/state.tools 已离线实测。开发默认 PGlite 磁盘 PostgreSQL，生产 pg/DATABASE_URL，Tiger 免费资格由 DevOps 核验。精确 accepted v1 在 interfaces 与 contracts 源码。用户本轮明确授权开发并部署到 livingforma.tech；未授权收费。

## D-015 · 2026-10-03 · 产品语言为英文

用户明确纠正：产品是英文。UI、按钮、错误、示例、邮件/OAuth应用说明等面向用户内容统一英文；开发沟通和角色文档可中文。内部稳定字段ID不因语言调整改变。

## D-016 · 2026-10-03 · 免费生产数据库与持久用量

Tiger Shared Free 已核实，但实际连接未通过严格 TLS 验证；不禁用证书校验。Neon Free 作为本轮生产 PostgreSQL：免费资源已创建，verify-full 真实连接成功，生产 Docker /api/health 返回 postgres。不自动升级/添加付费资源。Render 免费托管准备就绪，创建新账户的条款确认仍待用户回复，正式网站尚未部署。Gemini 请求预算由主数据库原子预留，不能以临时主机本地文件作为生产预算。

## D-017 · 2026-10-03 · 实测模型与媒体计量

Gemini3.5-flash-lite经真实应用创建、patch和Pi调用验证，作为本轮明确配置；3.8临时503，2.5新项目404，均不自动付费fallback。Gemini每请求在Neon预留，开发CLI22次已迁移且后续共27/30。ElevenAPI独立页面已核实includedcredits可用、PAYG零余额、AutoTopUpOFF；官方PAYG规则显示消耗included后在零余额停止，不新增收费。媒体使用按验证期不自动重置的STT秒/TTS字符预算；服务器只收可从bytes验证时长的PCM16mono16kHzWAV，避免压缩音频绕过20秒约束。实际语音/视觉验证仍待LF181/185，不因凭据存在视为已连接。

## D-018 · 2026-10-03 · 媒体与生产验收进度更新

取代D017中的阶段状态，保留当时历史计量。LF181实际STT、Gemini视觉、ElevenLabs TTS适配器均通过；LF185真实语音经用户可编辑草稿及显式Apply发布habit v2，数据保留。Gemini当日30/30硬停止已通过真实相机UI验证，必须等待UTC自然日切后完成最后一帧的完整camera服务往返。Eleven固定验证期使用STT5/60秒、TTS153/1000字符，不自动重置。Owner关闭朗读时不调用TTS；退出后长任务须重新验证会话再发布。工具并发请求在单进程去重、完成结果持久化；横向扩展前需要跨实例pending lease，当前不承诺多实例外部exactly-once。

生产构建与本地Docker连接Neon、公开深链/CSP、匿名UI、测试登录关闭已验证；最终100项自动测试通过。DevOps复核的pg空闲连接error已处理，日志仅固定脱敏信息，活动请求错误仍交由调用者处理。此证据不等于域名部署；Render创建账户条款确认、平台服务、DNS/HTTPS和生产Google回调仍未完成。

## D-019 · 2026-10-04 00:00 UTC · 完整相机UI实调通过

取代D018的最后相机等待状态。UTC自然日切后一帧实际camera UI→Gemini→ElevenLabs→browser播放成功；Stop释放设备/音频，访客零设备零播报且不接收描述，跨space/reload保留业务数据。Gemini新日1/30，Eleven固定期STT5/60秒、TTS316/1000字符。使用合成虚拟设备与短期测试会话，真实Google登录另有LF150证据；不宣称采集了物理设备。LF185验收完成，接独立QA160和DevOps170，正式域名仍未上线。

## D-020 · 2026-10-03 America/Vancouver · Render账户与私密配置授权

用户告知已自行创建并登录Render，随后明确回答“允许，继续免费部署”：允许现有Google OAuth配置、Neon数据库连接、Gemini和ElevenLabs API密钥保存到Render的服务端私密环境变量，用于LivingForma部署，不放入网页或仓库，仅用免费资源且不添加付款方式。该回复解除先前账户与凭据传递阻碍；不是收费授权，也不证明服务或域名已经部署。QA160已通过，DevOps170执行实际发布验证。


## D-021 · 2026-10-03 America/Vancouver · 60 个可调模块与双端适配

用户要求50–100个模块、全部mobile/PC适配，并明确授权跨聊天协调。接受总计60类型（现有12+新增48），保留每页最多24实例；通用width为3–12列/minHeight120–960，手机自动全宽/内容高度，配置仅允许manifest声明的有界键。Owner手动布局通过独立presentation API版本化保存与SSE传播，不需要模型调用、不改记录/schema/actions。所有类型复用版本注册/字段/权限能力，禁止任意生成代码。模块展厅使用显式本地sample；真实space继续授权写入。新增开发仅独立PGlite/local模式；生产7efaa91固定、AutoDeployOff，本轮未发布模块扩展。


## D-025 · 2026-10-03 · General website generation replaces catalog-only ceiling

The user corrected a proposed Tinder-specific component fix: they want any ordinary website request to be attempted through a general generation process. The accepted product direction is code generation → isolated preview → real checks/repair → publish, retaining data and URL. Reusable components remain useful but are no longer the hard frontend expressiveness limit. This supersedes the initial generated-code exclusion inD005/PRD, while preserving Owner authorization, server-only credentials, exactCSRF/Origin, state evolution and confirmed-before-charge rules. Swipe photos is an acceptance input, not a hardcoded planner template. Architecture/security contracts are being specified; no completed implementation is claimed. Session repairLF210/211 remains the immediate isolated release.
