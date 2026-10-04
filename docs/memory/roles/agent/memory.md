---
title: LivingForma agent-development memory
type: note
permalink: livingforma/roles/agent/memory
---

# Agent 开发角色记忆

## LF-230 真实请求兼容 · 2026-10-04 America/Vancouver
- site/tool新增provider-only compact schema投影：去regex和length/item/range decoding约束，结构/required/enum保留；原Pi schema与Host严格限制未变。原ANY schema实际HTTP400generic INVALID_ARGUMENT，瘦身后真实toolcall/source，Root进一步完整候选+actualIAB checked通过。无法断定某一个keyword是唯一原因。
- provider-diagnostics输出固定English分类+脱敏短reason；nested/arrayGoogle wrappers可识别。Pi1.0.1引用TypeBox1.3已移除error.message导致字段说明undefined，现捕捉tool_execution_end并用Compile.Errors恢复仅白名单path/rule，永不存Received arguments全文。
- 受控createSiteGenerator({onCandidate})可保存实际complete toolcall候选（去private defaults/credentialpattern/160k cap），默认generateSite不保存。此callback不是thinking/rawcontext日志。
- Agent3次明确授权普通实调原Neon15→18；第三次provider通过但candidate fail，当时没有留存args，具体原因未知，未冒称optionalnull等。Root实际确认11.607s/3793in4747out、source+outline与完整candidate/sharedchecks+IABstartup checked。完整upload/swipe/save留LF227+LF232正常Owner修复。
- 图片bridge提示明确lf.pickImage自身负责chooser/upload、每gesture一次、不加child fileInput前置二次选择；纯localfileparser不全局禁用。Preview文案为Preview only. Publish to save changes.
- 全Agent122/122，最终prompt后定向32/32、全仓typecheck、diffcheck过；harness无provider时actualSDK onPayload capture beforetransport。无ledgerreset/refund/付费/业务云迁移/高级绕过/Git发布。hand off LF-230-b064ec16-3675-4fef-b4b7-b5c6ba4f5860.md。最新部署/剩余额度以coordinator实时证据为准。

## LF-225 通用后端工具生成 · 2026-10-04 America/Vancouver
- `generateTool` export接shared GeneratedToolGenerator：真实Pi一次submit_tool创建任意受控原始JS+JSONschemas+2–5syntheticfixtures，或选择enabled exactversion。无关键词生产模板；不在生成器中执行/登记/启用源码。
- `generateSite`同一次submit_site返回页面与codeTools+toolBindings，解析JSONstring模型表示为shared `Proposal.codeToolProposals`；保留tool.invoke和稳定schema/componentID。lf.runTool读取response.result，preview明确Publish to run tool且仍reportReady，只有Owner运行。
- enabled registry显式投影去source/tests/endpoint/session；当前与repair私字段defaults剔除；actualPi源码快照→writing，Host负责actualtesting/ready/failed。SDK整块快照限制如实记录，无计时假流/额外planningcall。
- 每次1providerrequest/6000tokens/60s，共用既有durablebudget，缺失即拒绝，取消不refund；Host一次repair覆盖页面/工具/浏览器，shape-valid坏源码交Host修复，malformedshape失败。
- 107/107 Agent tests+全仓typecheck+diffcheck通过；新增11包括四类不同逻辑真实Pi fixturetransport→Backend真实QuickJS、synthetic brokers、wrongalgorithm实际失败再hostrepair、单页+tool生成/精确复用/privacy/cancel/budget。无真实provider/.env/费用/账本变更/高级绕过/部署。
- 文档 [generated-tools](../../../agent/generated-tools.md)，交接LF-225-a8fbbea3-b931-4885-8a65-231277d202f8.md。LF227由root接真实模型/浏览器与registry发布；本角色实现不宣称该整体验收已完成。

## LF-221 通用网站生成 · 2026-10-03 America/Vancouver
- 用户已取代“只能60目录组件”的旧上限；`generateSite`通过同一Pi/Gemini工具生成任意普通页面的HTML/CSS/JS，不按Tinder等关键词挑整站模板。仅在浏览器隔离边界执行，禁止host执行/新费用/自动付费fallback。
- `packages/agent/src/site-generator.ts`导出SiteGenerator，outline作为首字段，实际Pi message_update/toolcall_*快照→sharedvalidated Progress.ui/source；无thinking/原始文本/假计时代码流。SDK当前Google函数参数快照可能整块返回，不能宣称逐字符流。
- 每调用1providerrequest/6000tokens/60s，生产与开发均需注入durablebudget，仍共用已验证30/day、5/min、一并发与无retry；本轮没有读.env/实际调用provider/改用量。
- schema-valid候选先做shared静态/演化check，失败如实checkpoint并交host权威拒绝与唯一repair，不内部偷修；malformedproposal直接fail。Private defaults在current+repair再次剔除，Host恢复原metadata；不接records/session额外输入。
- lf.ready与CRUD都返回fullpublicstate，JS正确绑定listeners/reportReady；preview只读、照片走pickImage/image，不伪造外部服务。60模块planner排除generated-site并拒绝从legacy路径改generatedapp。LF225后续接backend code tools。
- 新17项realPi+fixtureprovider tests，连同已有tests共96/96与全仓typecheck通过。三类不同source、actualevent/outline、privacy/evolution、repair、cancel/concurrency/durablebudget均有离线证据，不当作真实模型质量/浏览器实调/已部署。
- 详细文档 [generated-sites](../../../agent/generated-sites.md)。LF221完成后由coordinator/Backend接server export并实际验收；随后按依赖领取LF225，无自行provider calls。

## LF-202 最新模块扩展 · 2026-10-03 America/Vancouver
- 实现 `apps/web/src/modules/tools.tsx` / `tools.css` 的 16 个 study/discovery/local-tool 模块：flashcards、quiz、random-picker、pomodoro、stopwatch、breathing-guide、calculator、unit-converter、search-panel、filter-panel、tag-cloud、text-reader、word-counter、markdown-viewer、link-directory、recipe-scaler。临时跨角色 scope 由 LF-202 catalog 明确授予，其他 frontend/shared 文件未编辑。
- `planner.ts` 识别全部60 manifests，增加 bounded size/config TypeBox；最终 columns 为3–12、minHeight120–960，保留既有配置。`module-composer.ts` 按单独 module IDs/元数据及数据原语组合全部48新增类型，不增加整App模板；无外部provider调用。每页24实例，新增字段保持可选/稳定IDs，主机校验仍权威。
- 79/79 agent tests、全仓typecheck、49/49 realChrome检查通过。32项覆盖16模块×320px手机/1440px桌面3列窄容器；其他交互与timer pause/unmount interval清理实测。首次reader range默认margin导致2px内部溢出已修复并复验；其余首次失败为测试定位器歧义。截图已实际查看。
- 证据 `docs/memory/handoffs/agent/LF-202-a903b374-browser.json` / `LF-202-a903b374-reader-mobile.png`；可复验脚本 `packages/agent/scripts/module-browser-smoke.ts`。样例数据/受控browser clock，不冒称真实服务调用或生产用户数据。无quota修改/付费/推送/部署。
- 后续：coordinator完成所有60模块的整合、完整布局持久化与mobile/PC验收；本角色完成LF-202后释放session。以下较早媒体账本与待办是历史记录，最新跨角色服务/上线状态以shared memory为准。

## 已确认
- 负责 Pi runtime、Gemini 规划、AppSpec/ToolSpec 生成、受控能力注册和复用。
- 通用 App 生成优先，业务示例不限于活动。
- 模型输出先验证，再由宿主执行。模型不直接决定数据库写入或任意代码执行。
- 开发团队的 Basic Memory 不等于用户 App 的业务数据库或产品能力记忆。
- Gemini 与 ElevenLabs 服务端适配由本角色负责；Frontend 负责录音/播放控件，DevOps 配置私密环境与额度，Backend 挂载 API 并控制业务授权。
- 开始前读取 docs/ROLE-OWNERSHIP.md 与 docs/integrations.md，使用 scripts/coordination.py 创建 agent session，自动领取依赖已满足的任务；不要求用户手工指定文件。
- Google OAuth 登录由 DevOps 主责，不能用 Gemini API key 代替 OAuth client。
- 2026-10-03 最新方向：Jarvis 式语音对话改变正在运行的网站，Owner 左上 orb 放大到中央输入/语音；语音是核心方向，文字同时保留，不再沿用“永远可选增强”。
- 访客可免登录浏览公开空间，业务写入需 Google 登录及动作权限；只有 Owner 编辑/发布定义和能力。
- 用户要求相机场景：本设备 camera → Gemini 画面理解 → ElevenLabs 说话。设备需本客户端显式启动和浏览器许可，SSE 不能启动其他访客 camera/mic。
- Owner 明确提交文字/语音命令后，允许的非破坏性修改经宿主校验即发布并变形，不强制第二次审批；工具启用、破坏性/收费/外部动作具体确认。STT 回调不等于提交，partial/背景语音/取消录音不能发布。
- 新方向同时以有趣的前端组件拼装和后端动态工具创建为主轴；Agent 规划、验证、登记、复用受控能力，不只是语音包装或固定 CRUD 模板。

## 当前状态
- LF-130 已完成：Pi/Gemini manifest组件规划、数据保留演化、缺口提案、Owner启用后受控OpenLibrary工具注册/执行/复用；详见 [text runtime](../../../agent/text-runtime.md)。
- LF-181 已完成角色验收并真实provider验证：`createMediaAdapter({budgetStore})` transcribe/describe/speak，Scribe v2、Pi/Gemini隔离无工具vision、ElevenLabs River Flash v2.5。状态与具体证据见 [media runtime](../../../agent/media-runtime.md)。跨角色真实voice Apply已发布habitv2+camera+sage并保留schema/record；原浏览器断言15s超时但数据库确认成功。实际cameraUI仍待自然预算日切由LF185整合；角色验收结合Agent23+Frontend11+Backend13media/4budget证据完成。
- 默认模型明确 `gemini-3.5-flash-lite`。只有实际核实免费的模型可用，禁止自动付费fallback。用户产品必须English；规则fallback标`local-rules`。
- 生产和媒体必须注入共享durable DB budget。LF-130开发账本22已由coordinator carryforward进Neon，LF-150累计27，LF-181vision后28，coordinator一次voiceApply用了2次providerrequest并已成功发布，现 **30/30**。等待自然UTC日切再cameraUI；不得旧文件账本重跑绕限。失败/取消不refund。
- ElevenAPI已由DevOps实际核实included131000credits/PAYG0/AutoTopUpOff，key cap10000；非自动按日期重置的`verified-2026-10-03`应用预算STT60s/TTS1000chars/各3min，LF-181后STT2s/TTS153chars，coordinator浏览器STT后为STT5s/TTS153chars。调用前GETsubscription与durable预留，flags不符或quota失败则停；不推断另一套USD余额。
- 严格16kHz monoPCM16 WAV从bytes算时长0.1–20s；JPEG<=400k/2048px；TTS<=300chars/600k，输出audio/mpeg。无媒体磁盘或businessDB/SSE/log写入。fixture明确synthetic、非物理camera/mic，真实服务调用证据不可冒称浏览器/实机效果。
- `planner.ts`与local composer按camera manifest.status决定可用，camera fields/actionIds为空，不增加媒体字段，不因发布启动设备。Schemaenum在module import时构建，promote后API要重启。
- 最新23个agent tests与typecheck通过；Backend另报13媒体host+4预算tests通过。所有role普通tests无provider用量。

## 已验证与未验证
- 实际STT合成命令识别1.998s、Gemini书和杯场景2.092s、TTS2.365s/8.803sMP3；这是服务处理延迟，不是首声/browserlatency。
- vision fixture包含“删除记录”恶意图像文字；模型只描述场景，Pi工具空目录且无发布接口，无法写入。
- STT只draft，必须Owner显式Apply才进入同一受控planner/host授权验证/发布；取消/迟到不返回结果。免费用尽停止且不自动retry。
- 当前不承诺providerzero-retention：官方Elevenlogging=false只Enterprise；免费Gemini条款单独适用。生产用户媒体默认不保存与provider处理区分。
- 尚待coordinator跨角色浏览器Apply/camera narration、最新播放/Stop、访客设备隔离、真实OAuth结合与部署HTTPS、目标手机播放。GeminiLive/双向常开语音非当前实现。

## 下一步
LF-181已完成，finish/close释放scope供coordinator LF185实际cameraUI与整体回归，随后独立QA。应用启动和上线由coordinator/DevOps推进，本角色不自行增加provider调用、付费、gitpush或修改shared文件。
