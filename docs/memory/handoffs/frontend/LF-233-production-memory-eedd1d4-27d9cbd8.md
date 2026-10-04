# Preserved production session-hotfix role memory

Source: origin/main eedd1d450b45ff36062bbc7281040fddb0d462ca. Historical accepted hotfix state; newer generation summary remains in role memory.

---
title: LivingForma Frontend Role Memory
type: memory
date: 2026-10-03
permalink: livingforma/roles/frontend/memory
---

# 前端角色记忆

## Current release hotfix · 2026-10-03 LF-210

- 本次实现位于隔离 `/Users/fanhaocheng/project/livingforma-release-fix` / `fix/session-recovery`，base `3325718`；没有触碰主checkout的后续组件扩展。提交、整合及部署由coordinator负责。
- `lib/session-client.ts`统一每次protected write的no-store session预检；相同account刷新CSRF后单次发送，变化account/匿名零write；401/403刷新身份但不自动重放。记录、提案、建空间、工具、媒体、退出均覆盖。仅旧媒体session的best-effort原token DELETE和显式local auth入口使用raw传输。
- identity/page/intent revision防迟到成功清草稿或重现旧权限视图；导航同步改slug，身份变化/强制鉴权失败清snapshot并close SSE，sameaccount tokenrotate保留表单挂载但停media和旧inflight。force/logout淘汰旧session GET；较旧并发GET可消费最新已接受session，不会无故拒同account并行写。
- 草稿使用account-scoped v2 key，创建title/prompt也持久化；logout保留原account草稿，key变化不复制旧值。legacy Owner command仅当前已确认Owner迁移；storage失败不崩溃。用户需显式重试被拒的意图。
- 已验证guard12/12 + media5/5、完整tsc与release webbuild，最新bundle `index-DE19SV4l.js`。独立QA LF-211在最终build上真实HTTP/PGlite/Chrome+local fixtures回归15/15通过，真实Google/provider或线上部署不从这些测试推断。行为说明见 [session-recovery](../../../frontend/session-recovery.md)。

## Current implementation · 2026-10-03 LF-180

本节补充 LF-110 并取代其“媒体未实现”的历史限制；全产品 UI 继续为英文。

- 已实现 Owner orb 显式语音采集 → PCM16 mono 16kHz WAV → 转录草稿 → 用户明确 Apply；相机组件 Start 仅本地 preview，Describe 才传帧，可选自动间隔≥15s/单请求/最多8帧/5分钟session，支持文本与可中断语音。设备从不随 SSE 自动开启。coordinator 审核后将 camera manifest 升为 available，目前共12组件。
- `lib/media.ts` 管理设备/会话 epoch、AbortController、tracks、AudioContext、audio/objectURL 与清理；Stop/close/unmount/切space/logout/后台隐藏/退出均终止，迟到采集许可和媒体结果丢弃。服务端按真实 WAV bytes 校验，客户端不发送时长声明。最大录音20秒、JPEG≤400kB。
- 工具结果改为可复用书籍卡片（title/authors/year），只允许受限 Open Library HTTPS record URL；q label 为 Book title or author，record/day/star 单复数修正。保留 coordinator 的 sr-only/320px CSS 修复。
- 验证：媒体单测5/5、真实Chrome虚拟设备+native media APIs 的11项生命周期场景通过、all12 manifest 组件回归6项通过、完整tsc与web build通过。所有媒体浏览器 API 请求是显式 fixture，未调用真实provider、未录私人人像/声音。真实provider+Neon链路由 coordinator LF-185 集中验证，不把fixtures当云服务证据。
- 详见 [生命周期与启动](../../../frontend/media-lifecycle.md)、[媒体证据](../../../frontend/browser-evidence/media-results.json)、[交接](../../handoffs/frontend/LF-180-ea35c50c-42ee-4ef3-b9e6-24b8500e704a.md)。web源码已冻结供LF-185实测。无新依赖/付费调用；未采集DevTools帧轨迹，build有535.59kB chunk体积提示但成功。

## Current implementation · 2026-10-03 LF-110

本节取代下方历史“尚未实现”的时间点描述。用户最新要求是 **English product UI**；交流/开发记忆可以中文。

- `apps/web/src` 已实现 Vite React/Motion 真实 API UI：11 manifest 的通用 Renderer（form/cards/list/counter/progress/calendar-grid/streak/chart/kanban/detail/tool-result）、六 skin、实体字段与动作绑定、CRUD、习惯打卡/日历、Owner orb、session/CSRF/SSE。没有硬编码整页模板、角色切换或任意模型代码执行。
- Owner orb 的提案自动发布消费 `ProposalResponse`；`requiresToolApproval=true` 时保持现有 App，展示受信任 endpoint 的只读 tool spec，明确点击 Enable tool 后才注册，再重新提案。typed 参数与结构化 text-only 结果已实现。
- 本地浏览器实测身份/CRUD/数据刷新/匿名 SSE/打卡；fixtures 独立实测 11组件、6皮肤、工具审批、变形保留草稿/ID/URL、reduced-motion 与安全结果文本。见 [证据](../../../frontend/browser-evidence/results.json) 和 [组件fixture结果](../../../frontend/browser-evidence/components-results.json)。本地测试地址须用 `localhost:5173`，因为 APP_ORIGIN 的 CSRF 不接受同端口 127.0.0.1。
- 未实测 DevTools 帧时序、真实模型/工具外部请求、媒体设备或正式生产部署。不要把界面/fixture 测试转写成这些集成成功。Google OAuth 真回调由 DevOps 验证。
- 所有依赖沿用 LF-100；字体本地 Geist latin；无付费素材或调用。未来 schema 变更继续按 field/component/record 稳定 ID；草稿存 sessionStorage，退出清理；UI latest snapshot 使用 cursor 与身份 epoch，不丢 mutation 回执。

## Historical context (superseded where above)

- **最新用户方向（2026-10-03，LF-007）：**LivingForma 是 Jarvis 式可对话、在本地设备获准时观察场景并持续改变同一网站的通用空间。读书记录 + 习惯打卡仍是起点而非范围上限；读书空间需演示旧记录存在时新增评分并排序。通用仍是受限规格的生成，不是任意代码执行。
- 用户确认两项核心价值：前端的可玩性/变形与后端 Pi 的受控工具创建/复用。Frontend 主动分类用户场景并建设可信、可复用的丰富组件和元数据（数据/动作/布局/权限/状态/动效/无障碍）；Agent 选择已注册组件与能力拼装，不能把产品缩成固定模板或 CRUD，也不能直接运行模型代码。具体 manifest 契约待 LF-100。
- 公开空间访客可免登录浏览；“登录后写入”CTA 与可执行 `actionIds` 分离，匿名不能发送 mutation，登录后还要重新核验权限。左上小圆 orb 仅给**该空间 Owner**；“admin”只是 Owner 的别称，MVP 不另设可委派管理员。点击后放大到中心输入文字/语音，提交后回到角落；访客或普通已登录参与者没有 orb。不是聊天侧栏或底部建议条。
- 摄像头场景 + Gemini 视觉 + ElevenLabs 语音是新的重要里程碑，不应永久降格为“可选”；设备采集必须本地显式开启并可停止，不随 SSE 广播或远端自动启动。具体媒体协议、隐私与费用边界待 Agent/Backend/DevOps 协作。文本仍是失败时的可靠回退。
- 现阶段是文档规划；仓库尚无可运行前端。前端框架推荐 **Vite + React + TypeScript SPA + 独立 Node API**，但需 coordinator 在 LF-100 锁定；不得把它、Motion 或任何 API 描述成已实现。
- 用户已确定先用免费额度，任何收费发生前必须确认。Tiger Data 是主 PostgreSQL 的优先候选，Shared Free 资格/额度待核实；截图中 0.5 CPU 为收费路径，未核实有实例存在。前端呈现额度耗尽或服务不可用状态，不触发自动付费。
- Google OAuth 仍是受保护写入的登录方式。Frontend 负责 apps/web/src/、apps/web/public/、apps/web/src/components/auth 的登录/登出 UI、回跳/草稿、麦克风/摄像头/播放 UI；DevOps 负责 packages/auth provider/核心会话，Backend 负责公开快照裁剪、用户映射、API 授权与主库迁移，Agent 负责 Gemini 规划器/视觉与 ElevenLabs 服务端适配。共享权限与匿名访问契约尚待 coordinator 修订。
- 前端边界：只渲染服务端校验后的声明式实体 schema、AppSpec 和共享状态；不执行模型生成的 JSX、HTML、脚本、任意代码或 ToolSpec。
- 数据与界面定义解耦。字段 ID、组件 ID、记录 ID 应稳定；新增字段/改标签/隐藏字段不应自动删除旧数据。候选契约使用 definitionVersion、entitySchema.schemaVersion、stateVersion、eventCursor；尚未正式接受。
- `form/list/cards/counter` 只是旧起步目录。用户接受继续规划 cards `cover/compact/hero`、list `dense/comfortable`、受限强调规则、`calendar-grid`、约 4–6 套枚举皮肤 token；确切 schema/降级规则未接受。首版 `cover` 用标题/稳定色彩/排版生成文字封面；外部真实图片需要未来受控资源 schema，不是 v1 必需。标题是页面元数据，筛选/排序是受限属性。后端提案请求字段 `baseDefinitionVersion`，业务动作 `definitionVersion`。
- 多人同步以服务端快照为权威；过期响应只从展示层淘汰，不能丢 mutation 回执/错误/草稿。事件丢失、乱序或重连时重拉。权限快照只决定显示，真正授权在服务端；身份相关快照不能跨用户缓存。普通记录事件局部更新，不触发整页 morph。
- Orb 与定义发布可用 Motion 的稳定身份过渡；焦点、键盘、`aria-live`、reduced motion 必需。动画与表单/业务动作解耦；真实阶段来自后端，不伪造百分比。未登录写入草稿应在跳转前保存。
- 技能现状（LF-011，2026-10-03）：用户要求的 Codex skill `frontend-dev`、`animations` 已安装于个人 `~/.codex/skills/`，固定上游 commit 分别为 `60aaae52bb2af8162732751a4332f62a5fef518b`、`dfd1a495c850678f247dfccdfe761d74164f5be5`；完整上游子树分别 98、23 个源文件 Git blob hash 匹配，MIT LICENSE 与 INSTALLATION.json 附在安装目录。全新本地 Codex app-server 的 `skills/list` 实测两项 `enabled: true` 且无 skill 错误；未打开 GUI 新对话或执行模型任务。未运行上游脚本/API 或安装项目依赖，前端应用仍未实现。项目只采纳 [`skills-guide`](../../../frontend/skills-guide.md) 中适配的视觉与状态编排原则：Vite SPA 推荐待 LF-100 锁定，排除 MiniMax 素材 Phase 3 和额外密钥/收费，Motion 为核心，独立 GSAP 仅在明确需求下评估，R3F 为 3D stretch。未安装的 `Skill(...)` 依赖不能假装可用；新对话需按准确名称选择技能，不假设已自动调用。
- 后续需锁定公开快照/写入门槛、扩展组件 schema、媒体会话、阶段事件、迁移规则与部署栈。首次发布前的快照拟采用 `phase: "unconfigured"`、`definition: null`，初始提案基准版本 0→v1；这仍是架构候选，不得对空定义调用 Renderer。参考 [体验方向](../../../frontend/experience-direction.md)、[运行时方案](../../../frontend/runtime-plan.md) 与 [PRD](../../../PRD.md)；公共契约由 coordinator 在 LF-100 定稿。
