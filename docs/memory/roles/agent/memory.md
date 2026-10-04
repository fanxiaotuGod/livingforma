---
title: LivingForma agent-development memory
type: note
permalink: livingforma/roles/agent/memory
---

# Agent 开发角色记忆

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
