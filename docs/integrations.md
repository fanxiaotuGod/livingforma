# 外部服务与集成职责

更新：2026-10-03，America/Vancouver。以下职责已分配；账号页面可见不等于 API 已接入。

| 服务 | 在产品里的用途 | 主负责人 | 验收证据 |
| --- | --- | --- | --- |
| Google OAuth / OpenID Connect | Google 登录、稳定用户身份、退出与会话 | **DevOps**；Backend 授权，Frontend 登录 UI | 本地与 livingforma.tech 登录回调成功；登出后旧 session 无效；其他用户无法改 Owner 空间 |
| Tiger Data / PostgreSQL | 用户/身份映射、空间、定义版本、业务记录、变化及工具事件；首选主库候选 | **Backend**；DevOps 创建经核实免费的资源、配置连接 | 迁移可重复运行，刷新/服务重启后数据仍在，多租户隔离；确认实际免费套餐与停止策略 |
| Gemini | 理解需求，生成受约束的 AppSpec / schema patch / ToolSpec 提案 | **Agent** | 读书记录+习惯打卡由同一 runtime 生成；无效提案被拒绝；记录实际模型和用量 |
| ElevenLabs | 自然语言语音输入、简短结果播报；文字主链路优先 | **Agent** 服务端适配，Frontend 麦克风/播放器，DevOps 凭据与额度 | 真实 STT/TTS 至少一条路径端到端可演示；失败回退文字；不把网页 Creative 额度直接当 API 额度 |
| Snowflake | 候选：对脱敏的应用演化/工具事件做分析，并生成简短使用洞察 | **Backend**；如采用 Cortex，Agent 协助摘要 schema | 必须有真实查询/调用、可解释输入输出和用量记录；不承担在线业务主库，不阻塞 MVP |
| .Tech 域名 / 托管平台 | 发布正式 HTTPS 入口 livingforma.tech | **DevOps** | 平台 URL 可用后配置真实 DNS 记录，域名 HTTPS 与 OAuth 回调同时验收 |

Gemini 的结构化输出可约束 JSON 形状，但业务引用/权限/迁移仍由宿主验证。[官方文档](https://ai.google.dev/gemini-api/docs/structured-output)

ElevenLabs 分别提供[文字转语音](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)与[语音转文字](https://elevenlabs.io/docs/api-reference/speech-to-text/convert)接口。开发前核实该账户 ElevenAPI 下的实际额度、模型权限与超额策略，不因网站能生成语音就宣称 API 可用。

Snowflake Cortex REST API 可调用模型，鉴权/角色/地区/模型可用性需要验证；试用额度并不证明目标 API 已获准。[官方文档](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api) 先完成主链路，再判断分析用途是否值得接入；不用同一请求同时调用多个模型来凑赞助商。

## 当前浏览器核查结果

本轮仅做只读检查。域名管理页确认 livingforma.tech 已注册，DNS/HTTPS 与部署尚未验证。Tiger Data 可见 Shared Free，但选中的 0.5 CPU 是收费 compute；Snowflake 仍为试用，ElevenLabs 的 API 计费与续订仍需核验，Gemini 本轮未调用。

本机当前套餐、剩余额度、续订提示和用户提供的控制台入口保存在被 Git 忽略的 `.local/service-status.json`。后续 DevOps 可读取后再核对控制台；不要把账号级用量、联系方式或凭据复制到公共记忆/仓库。新机器没有该文件时重新只读核查，不猜测账户状态。

Google 登录使用 OAuth client ID/secret；Gemini 使用模型 API key，两者不能互相替代。浏览器处于已登录状态也不代表服务端应用已经获得凭据。认证细节见 [Google 登录约定](operations/google-oauth.md)，部署见 [部署记录](operations/deployment.md)。
