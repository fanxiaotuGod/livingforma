---
title: LivingForma accepted decisions
type: note
permalink: livingforma/shared/decisions
---

# 已接受决策

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
