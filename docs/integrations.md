# 外部服务与集成职责

更新：2026-10-03，America/Vancouver。以下职责已分配；账号页面可见不等于 API 已接入。

| 服务 | 在产品里的用途 | 主负责人 | 验收证据 |
| --- | --- | --- | --- |
| Google OAuth / OpenID Connect | 创建/写入/管理时 Google 登录、身份与会话；公开浏览免登录 | **DevOps**；Backend 授权，Frontend 登录 UI | 本地与 livingforma.tech 登录回调成功；登出后旧 session 无效；其他用户无法改 Owner 空间 |
| Neon / PostgreSQL | 用户/身份映射、空间、定义版本、业务记录、变化及工具事件；当前主库 | **Backend**；DevOps 创建经核实免费的资源、配置连接 | Neon Free严格TLS与真实读写已验证；迁移可重复、刷新数据保留；Tiger未启用，见下方状态 |
| Gemini | 理解文字/语音意图与相机画面；生成受约束的 AppSpec / schema patch / ToolSpec 提案 | **Agent** | 读书记录+习惯打卡由同一 runtime 生成；无效提案被拒绝；记录实际模型和用量 |
| ElevenLabs | Jarvis 语音输入/回应与相机描述播报；先建立文字基线，再完成明确语音里程碑 | **Agent** 服务端适配，Frontend 麦克风/播放器，DevOps 凭据与额度 | 语音改站及真实 camera→Gemini→TTS 链路有证据，支持打断/停止；失败保留文字/当前界面；不把网页 Creative 额度直接当 API 额度 |
| Snowflake | 候选：对脱敏的应用演化/工具事件做分析，并生成简短使用洞察 | **Backend**；如采用 Cortex，Agent 协助摘要 schema | 必须有真实查询/调用、可解释输入输出和用量记录；不承担在线业务主库，不阻塞 MVP |
| .Tech 域名 / 托管平台 | 发布正式 HTTPS 入口 livingforma.tech | **DevOps** | 平台 URL 可用后配置真实 DNS 记录，域名 HTTPS 与 OAuth 回调同时验收 |

Gemini 的结构化输出可约束 JSON 形状，但业务引用/权限/迁移仍由宿主验证。[官方文档](https://ai.google.dev/gemini-api/docs/structured-output)

ElevenLabs 分别提供[文字转语音](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)与[语音转文字](https://elevenlabs.io/docs/api-reference/speech-to-text/convert)接口。开发前核实该账户 ElevenAPI 下的实际额度、模型权限与超额策略，不因网站能生成语音就宣称 API 可用。

Snowflake Cortex REST API 可调用模型，鉴权/角色/地区/模型可用性需要验证；试用额度并不证明目标 API 已获准。[官方文档](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api) 先完成主链路，再判断分析用途是否值得接入；不用同一请求同时调用多个模型来凑赞助商。

## 当前浏览器核查结果

当前实现与实测：域名 livingforma.tech 已注册，DNS/HTTPS 与公开部署尚未验证。Google OAuth已完成本地真实登录/刷新/退出；Neon Free为唯一业务主库并通过严格TLS验证。Tiger Shared Free虽已创建，但证书链验证失败，未使用且未禁用TLS校验。Gemini实际使用gemini-3.5-flash-lite，已验证Pi规划、工具装配和视觉；ElevenLabs已核实included API额度、PAYG余额0及AutoTopUp关闭，并完成真实STT/TTS。完整camera UI服务往返、播放、停止与访客隔离已实测通过；生产Google回调仍待部署后验收。Snowflake保持未集成的可选分析层。

本机历史套餐核查及控制台入口保存在被 Git 忽略的 `.local/service-status.json`；最新部署核查见DevOps交接记录，不能将历史缓存当作当前额度。后续 DevOps 应重新核对控制台；不要把账号级联系方式或凭据复制到公共记忆/仓库。新机器缺少私密配置时重新只读核查，不猜测账户状态。

Google 登录使用 OAuth client ID/secret；Gemini 使用模型 API key，两者不能互相替代。浏览器处于已登录状态也不代表服务端应用已经获得凭据。认证细节见 [Google 登录约定](operations/google-oauth.md)，部署见 [部署记录](operations/deployment.md)。

视觉理解由 Gemini 负责，ElevenLabs 的语音接口负责转录/发声，不能把摄像头直接当作 TTS 输入。SSE 只同步公开/获授权的业务定义与数据，不上传媒体或自动启动其他用户设备。采样帧播报与真正双向 Live 分期，具体模型与额度实测；规划见 [多模态方案](agent/multimodal-plan.md)。
