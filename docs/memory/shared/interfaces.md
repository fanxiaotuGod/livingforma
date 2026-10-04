---
title: LivingForma shared interfaces
type: note
permalink: livingforma/shared/interfaces
---

# 公共接口状态

## Generated form compatibility · 2026-10-04 02:11 America/Vancouver

已接受LF237/238的正常DOM适配：可信bootstrap支持submit按钮、Enter和局部requestSubmit派发可取消submit，保留原生约束校验/submitter，禁止重复派发或原生网络提交。iframe/CSP仍sandbox allow-scripts、form-action none，LFbridge/auth/权限契约和browserartifact/tool版本不变。真实Serving Studio原候选保留，LF237普通浏览器8/8、全库312tests/typecheck/build通过；LF238原候选7/7已实际执行，正式修复发布仍待CI。预算2026-10-04UTC30/30，不能再生页面/模型repair或重置。

## Accepted generation/tool v1 · 2026-10-03 23:40 America/Vancouver

以 `packages/contracts/src/generated.ts`、`generated-tools.ts` 为精确契约，见 [generated-tools](../../product/generated-tools.md)。以下为实施契约，尚非真实模型/生产验收。

- SiteGenerator 接收 enabled registeredTools元数据及registeredCatalogTools；Proposal可附codeToolProposals≤3。GeneratedToolGenerator产出新spec或exactversion复用；host验证/测试后才能Publish。
- GeneratedToolSpec=code-js-v1，单一顶层 `run(input,api)`、object input/output schema、sideEffects=none、publicRecordFields/connectors、2–5测试，source≤32KiB。QuickJS Worker guest heap32MiB/stack256KiB/guest execution4s/startup8s/total12s/concurrency1/Broker≤8，JSON≤64KiB；不保证整个Worker RSS硬上限。
- generated-site.toolBindings={actionId,toolId,toolVersion,kind:generated|catalog}，必须绑定允许tool.invoke，action与toolId/version跨kind唯一。lf.ready仅给metadata；lf.runTool返回ToolResult `{toolId,toolVersion,result,reused}`，仅Owner已发布可调用，preview提示Publish to run tool且仍reportReady。
- Owner API code-tools/proposals `{prompt}`；POST code-tools `{spec,enable}`；GET code-tools→`{tools}`；POST code-tools/:toolId/invoke `{requestId,definitionVersion,componentId,actionId,toolVersion,input}`。host验身份/Origin/CSRF/space/action/version；source/tests不进公开frame。
- Progress/Event可附ui={version:1,title?,layout:flow|split|grid,skin?,sections:[{id,kind,label?,columns?,items?}]}、tool={toolId,name,phase:writing|testing|ready|failed,message?}；来自实际模型完整参数快照。GenerationJob可附toolReports。
- API build输出server.js和generated-tool-worker.js；quickjs-emscripten0.32.0已安装，server.ts已在LF227挂接真实适配器，真实模型/生产验收待完成。

LF-100 已建立 `packages/contracts/src/index.ts` 与 `examples.ts` 的代码契约；以下本轮接受项取代后文历史候选。本文件由 coordinator 单独维护。

## Accepted v1 · 2026-10-03

- Node >=22.19（本机使用 bundled Node 24），pnpm workspace，Vite React TS + Motion，Fastify API；开发 5173 代理 `/api` 与 `/auth` 到 3001，生产由 API 同源提供 web/dist，业务页面 `/s/:slug`。
- 精确字段以 `@livingforma/contracts` 为准。Definition = definitionVersion/entitySchema/appSpec/summary；Snapshot 含 space、phase、definition、records、stateVersion、eventCursor、role、permissions、loginRequiredForWrite。空空间 definition=null/version=0；首次发布 v1。公开字段裁剪同时作用于 schema、组件 bindings 与 records。
- 字段 ID 不因标签/排列变化而改变；新增可选字段采用默认值，禁止已有字段删除/变型/枚举值删减和由 Planner 改 public 标记。dates 使用空间 timezone 的 YYYY-MM-DD；record.checkin 是同日 toggle，重复 requestId 仅执行一次。recordVersion 用于更新/删除冲突。
- 初批 manifest 统一版本 1：form/cards/list/counter/progress/calendar-grid/streak/chart/kanban/detail/tool-result；camera 保留 planned，媒体阶段验收后启用。六个 skin = linen/sage/ink/clay/sand/rose。manifest 是实现契约，需 Frontend 实现测试才算产品可用。
- 身份用 Google OIDC，库 `openid-client@6.8.8`（替换安装时发现已 deprecated 的 Arctic 候选），PKCE + state + nonce，随机 opaque server session，cookie HttpOnly/SameSite=Lax/生产 Secure，写入 Origin + X-CSRF-Token 校验。DevOps 主责；Backend 通过 store adapter 持久化 session、Google sub→内部 user 映射，不建立第二认证。
- auth 导出 `registerAuth(app, {store, origin, googleClientId?, googleClientSecret?, localDemo?})`，返回 `{getSession(request), requireUser(request), verifyCsrf(request)}`（async）。getSession 返回共享 Session。AuthStore 方法见 packages/auth/src/types.ts（DevOps 创建后交接 Backend）。GET `/api/session`；GET `/auth/google?returnTo=/s/slug`；GET `/auth/google/callback`；POST `/auth/logout`。开发模式可显式 POST `/auth/local` body `{persona:'owner'|'participant'}`，仅 loopback + 非 production + ENABLE_LOCAL_DEMO=true，明确测试身份，不是 Google 登录；生产完全禁止。
- API GET `/api/spaces` → `{spaces:[{id,slug,title,role}]}`，GET `/api/spaces/:slug/snapshot` → Snapshot；POST `/api/spaces` body `{title,slug?,prompt?}` → Snapshot；POST `/api/spaces/:slug/actions` Mutation → Snapshot；POST `/api/spaces/:slug/proposals` ProposalRequest → `{snapshot,proposal}`，Owner 明确提交即校验/原子发布，无第二次确认；GET `/api/spaces/:slug/events?after=cursor` SSE 失效通知，客户端重取快照。
- API 错误 `{error:{code,message,requestId?}}`；401 未登录、403 无权限、409 版本冲突、422 无效规格、503 provider/额度未配置。公开空间默认 participation=authenticated，已登录者仅业务 actions；只有创建者 Owner 可发布定义/注册启用工具。私人空间只成员可读。
- Pi 选择 **agent-core 嵌入**：`@earendil-works/pi-agent-core@1.0.1` 和 pi-ai 同版本，匹配本地 pi 源码；new Agent({streamFn,initialState:{tools}})，动态 `agent.state.tools` / prepareRequest，不混 coding-agent API。Agent 导出 `planProposal({prompt,current:Definition|null,mode?:'local'|'gemini',signal?}):Promise<Proposal>`；本地规则明确标记 source=local-rules，真实 Gemini 仅凭据和免费预算核实后启用。
- Agent 建立 validate/test/register/reuse 的受限 ToolSpec GET 机制，endpointId 来自可信目录，绝不接受任意 URL/命令；Backend 持久 registry 与调用审计。GET tools 返回注册版本，Owner 明确启用后才能 invoke。免费测试端点优先团队 fixture，并如实标注。
- 本地默认 PGlite（真实嵌入 PostgreSQL，磁盘持久化），同一 SQL 适配 pg/DATABASE_URL；生产优先核实 Tiger Shared Free，未获免费资源时不自动开付费数据库。本地模式不等于云集成。

资料核查：[Vite](https://vite.dev/guide/)、[openid-client](https://github.com/panva/openid-client)；Pi 以本地源码及锁定包 API 为准。实现/验证结果在任务板与角色 handoff 记录。

## 已接受原则

- AppSpec、业务状态、ToolSpec 分离，均有可识别的版本。
- 前端按稳定 ID 绑定数据；改标题、排序和布局不改业务身份。
- 服务端验证模型输出，再保存和广播；失败不能提交半个版本。
- 多人同步需明确事件顺序、重复消息处理、断线恢复。
- 记录的实现状态必须有代码/测试证据。
- Google OAuth 登录为既定需求；DevOps 提供 VerifiedIdentity/session 机制，Backend 通过用户映射 adapter 生成内部 user ID 并按空间授权，Frontend 消费公开 session 结果。认证库及实际 HTTP 回调路径在 LF-100 定稿。

## 等待评审

- frontend / backend 已对齐以下**候选命名**：快照中的 `definition.definitionVersion`、`definition.entitySchema.schemaVersion`、`definition.appSpec`；顶层 `stateVersion`、`eventCursor`、`role`、`permissions`。提案请求使用 `baseDefinitionVersion`，业务动作请求使用 `definitionVersion`。
- 旧四类组件目录已被扩展要求取代：form/list/cards/counter + calendar-grid，组件变体、emphasis、4–6 套皮肤；camera/voice 作为有权限/生命周期的能力类型。精确版本化组件鉴别联合、manifest 和皮肤枚举在 LF-100 定稿，不让 Planner 任意写 CSS/JS。只读 GET ToolSpec 是另一种外部查询能力，不是视觉/语音适配器的全部表达方式。
- snapshot role 候选增加 visitor；公开投影与私有 Owner 响应隔离，匿名写入拒绝；登录后 Participant 的具体可写范围仍由空间策略决定。
- 匿名可见的“登录后添加”入口不属于可执行 actionIds；认证后重取权限，再由用户提交保留的意图。登录提示元数据须由服务端明确投影。未发布空间候选为 phase=unconfigured、definition=null、基准版本 0，首次原子发布 v1 后 ready；LF-100 定稿。
- cover 首版为稳定配色/文字排版，不依赖未定义的外部图片字段；真实图片来源及安全绑定需后续注册。
- Assistant text/voice 共享授权和版本发布；latest snapshot 仅控制展示/动画，不能丢已提交事件、待确认 mutation 或幂等结果。组件/记录 layout identity 需以空间/组件/记录组成命名空间。
- camera/audio 会话不进入业务 State/快照/SSE；当前客户端显式启动，服务端核验媒体会话身份/配额，停止/打断取消请求并丢弃过时结果。
- 这些是已对齐的设计提案，尚非已实现或最终 accepted 的接口。完整 schema、动作类型、Google session 契约和部署约束由自动任务 LF-100 定稿（替代原 LF-010 规划）。
- 详细 schema / API / SSE event 见 [架构提案](../../architecture.md)，前端依赖见 [运行时方案](../../frontend/runtime-plan.md)。
- Pi 已有动态工具注册/执行机制；工具规格生成、验证、持久 registry、空间权限、版本和重启恢复由 LivingForma 实现。LF-100 选定 core 或 coding-agent SDK 接入路径，不能混用 API。Agent 检索组件/工具 manifest 后组装；详细场景与边界见 [场景能力地图](../../product/use-case-capability-map.md)。
- coordinator 对齐之后在此记录 accepted 版本，不能因为某个角色写了文档就视为接口已定稿。

## Language correction · 2026-10-03
User explicitly requires an English-language product. All UI labels, provider/planner summaries, error messages, seed examples and generated default apps use English. Existing stable field IDs remain unchanged. Reading status options are `To read`, `Reading`, `Finished`; habit categories `Wellbeing`, `Learning`, `Everyday`. Natural language input may be multilingual, but generated product UI defaults to English.

## Owner-approved missing-tool bridge · LF-122

`Proposal` may include `toolProposals: ToolSpec[]`; `ProposalResponse` includes optional `requiresToolApproval`. Backend supplies `registeredTools?: RegisteredTool[]` to planProposal. If proposals need new tools, return the existing authoritative snapshot with requiresToolApproval=true, validate specs but do not publish/enable or consume the mutation request ID. Frontend shows the proposed target/name and requires an explicit Enable action. POST /tools with enable=true validates/tests/registers, then the frontend resubmits the original prompt (new requestId) to bind the now-enabled tool. Failed or cancelled enable preserves old data/app. A capability gap with no supported change is never presented as success.

Agent also exports `proposeTool({prompt,registered?,mode?,signal?}):Promise<ToolProposal>`. Owner-only POST /api/spaces/:slug/tool-proposals accepts `{prompt}` and returns this proposal without side effects. ToolSpec never grants permissions itself.

## Durable provider budget · LF-122 / LF-130

Agent exports `configureBudgetStore(store: ProviderBudgetStore)`. Backend supplies an atomic Postgres adapter whose `reserve({provider:'gemini',day,now,dailyLimit,minuteLimit}):Promise<void>` reserves one provider request before it starts. `day` is UTC YYYY-MM-DD and `now` is epoch milliseconds; limits are server configuration, never client inputs. Exhaustion rejects with `Error('FREE_QUOTA_EXHAUSTED')`. Every actual provider call, including repair/retry, reserves independently; aborted/failed calls retain their reservation. Production without an injected durable store fails closed. The database budget survives process restarts and free-host replacement; local JSON is only a development fallback. No automatic paid model fallback.

## Media transport accepted for LF-180 / 181 / 182

Contracts now expose MediaAdapter, MediaCapabilities, MediaSession, MediaTranscript, MediaObservation and MEDIA_LIMITS. The media modules are implemented; LF-185 tracks complete UI service integration. All endpoints below are Owner-only; writes require session + exact Origin + CSRF. No media or device session enters definitions, record persistence, ordinary logs or business SSE.

- GET `/api/spaces/:slug/media` returns MediaCapabilities.
- POST `/api/spaces/:slug/media/sessions` body `{kind:'voice'|'scene'}` returns MediaSession (random opaque id, maximum five minutes, bound to the current authenticated session and space).
- POST `/api/spaces/:slug/media/sessions/:sessionId/transcribe` body `{sequence,mimeType,audioBase64}` returns MediaTranscript. The server accepts only strictly parsed 16 kHz mono PCM16 WAV; 2 MB / 20 seconds maximum, with duration derived from PCM bytes rather than client claims. The browser decodes/resamples its recorded audio into this format; compressed formats remain unsupported server-side until a bounded decoder exists. Final transcript populates the draft; the Owner explicitly applies it through the existing proposal endpoint. Stopping/cancelling never submits a command.
- POST `/api/spaces/:slug/media/sessions/:sessionId/observe` body `{sequence,capturedAt,mimeType:'image/jpeg',imageBase64,includeSpeech?:boolean}` returns MediaObservation. Maximum 400 kB frame, one request in flight, minimum 15 seconds between starts, eight frames per session. Gemini describes only; no editing tools. ElevenLabs speaks the short latest description unless includeSpeech=false; that setting skips TTS entirely and spends no speech allowance. If speech fails, retain the text and a truthful speechError.
- DELETE `/api/spaces/:slug/media/sessions/:sessionId` stops/invalidates the session and aborts pending provider work. Expiry, sign-out, space change, unmount and explicit Stop release tracks/player, abort and reject late results. Replaced/duplicate sequence is rejected. Client connection cancellation aborts current work; consumed budget is never refunded.

Frontend starts microphone/camera only from an explicit current-device gesture and presents cloud processing disclosure, recording/processing/speaking/error states and text fallback. Refresh/SSE never starts sensors. Scene switching preserves schema/records and stable URL. The camera manifest is available after LF-180 module verification (11 real virtual-device browser checks plus media unit tests). Media provider budgets require durable DB reservations and verified included allowance; exact STT/TTS unit limits are accepted with actual provider evidence during implementation, not guessed from key presence.

Media allowance evidence (DevOps read-only 2026-10-03): current ElevenAPI included-credit pool is available; PAYG balance zero and Automatic Top Up OFF. Current official PAYG rules consume included allowance first then pause at zero without auto-top-up; no purchase authorized or performed. The credit/USD UI difference is documented, not converted using invented rates. Start with a non-resetting verified allowance period `verified-2026-10-03`, maximum 60 STT seconds and 1000 TTS characters for this release verification; reserve in Neon before every provider request, including failed/aborted calls. Extend only after checking the remaining included allowance. STT derives ceil(seconds) from server-validated WAV, TTS reserves UTF-16 text length conservatively. Provider retention is not claimed to be zero; client says media is sent to AI services and LivingForma does not save recordings.

Agent exports `createMediaAdapter({budgetStore:MediaBudgetStore}):MediaAdapter`. Backend injects `createMediaBudgetStore(db)` plus existing configureBudgetStore for Gemini vision. MediaBudgetStore.reserve receives `{bucket:'elevenlabs-stt-seconds'|'elevenlabs-tts-characters',period,units,limit,minuteRequestLimit,now}` and atomically reserves units in one bucket/verification period plus rolling-minute request count. Defaults limit=60 seconds or1000 characters, max3requests/minute; provider errors/aborts do not refund. The period must be a configured verified allowance identifier, not an automatically resetting day. Audio MIME is WAV only as above.


## Delayed work and retry authorization · LF-185

After model planning or tool validation, the API revalidates the original session and CSRF before entering its short publication transaction. A completed logout or expired session cannot publish late results or receive an Owner snapshot. Tool GET runs outside business transactions so logout remains responsive. The single-instance host coalesces concurrent identical request IDs, checks durable replay again inside the registered in-flight task, then revalidates session, Owner and enabled tool/spec before atomically recording result, count and audit. Completed results replay across restarts. In-flight coalescing is process-local; multi-instance exactly-once external execution is not promised and would require a durable pending lease design before horizontal scaling. All dynamic tools remain read-only GET.

## LF199 · Bounded module presentation expansion · 2026-10-03

Accepted local-development contract: 60 catalog types, retaining max24 instances/page. Component v1 gains optional `size:{columns:3..12,minHeight?:120..960}` and strict `config` with common showHeader/density plus per-manifest configKeys. No CSS/HTML/code/field IDs inside config. Existing fields/groupBy/dateField/valueField remain bindings. Existing definitions need no migration.

POST `/api/spaces/:slug/presentation` (LF203): `presentationRequestSchema` exports requestId, baseDefinitionVersion, complete components and optional layout. Owner + session/Origin/CSRF required; no planner call. Preserve entitySchema/actions/records; validate definition/evolution, tool references and transaction replay/version conflicts; emit definition.published. Return Snapshot. Frontend LF200 adds/configures modules through this endpoint and handles conflicts without overwriting remote changes.

Module implementation families receive disjoint temporary cross-role paths via LF201/202 catalog tasks. All existing/new modules must pass mobile/PC and narrow container checks. Deployed12-module version remains fixed; new definitions use isolated PGlite only.


## General generated websites — 2026-10-03

User accepted code generation beyond the component catalog. Shared source/job/bridge contracts are now [generated-sites.md](../../product/generated-sites.md) and packages/contracts/src/generated.ts. A bounded HTML/CSS/JS artifact pairs exactly one generated-site surface; schema/actions/records remain existing business state. New Owner-scoped durable jobs expose real stage/source events, isolated preview/one repair and checked explicit publication. Runtime code is browser-only, served with opaque response sandbox and strict CSP; host bridge contains no credentials/private fields. LF220/221/222 implement, LF223 independently verifies. This local registration is not a claim of deployed/verified support; source remains outside the frozen session patch.
