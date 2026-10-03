# LivingForma 部署记录

更新：2026-10-03。本文是下一开发阶段的部署交接；应用尚未实现，未部署 App，本次不创建云资源。

## 已知状态

- 公开仓库：[fanxiaotuGod/livingforma](https://github.com/fanxiaotuGod/livingforma)。应用仍待实现，当前规划以通用 App 生成与持续演化为主。
- 用户已指定 DevOps 负责 Google OAuth 的完整接入和部署到 `livingforma.tech`。当前指令是准备下一开发 chat；实际实现与上线尚未开始。
- coordinator 只读核对域名管理页：`livingforma.tech` 已注册。DNS、HTTPS、上线版本和外部可访问性仍未验证；注册成功不代表 App 已上线。账户续订细节仅保留在忽略的 `.local/service-status.json`。
- Tiger Data 是首选数据库候选。coordinator 只读核对创建页：另有 Shared Free 选项，但当前选中的 0.5 CPU 为收费 compute。没有验证实例已创建，也没有接受该收费选项；账户试用余额及具体报价仅保留在忽略的 `.local/service-status.json`。
- 先使用免费额度。任何会产生费用的资源、调用、升级或超额计费，必须在发生前获得用户确认；不能把“有免费层”当作不会收费的保证。
- 本地 Basic Memory 是开发协作记忆，不是线上 App 的业务数据库；不把 `.local/` 或开发笔记作为用户数据存储。

## 候选部署组合

以下是待选方案，没有代表已经开通的账号、已接受的套餐或已实现的集成。

| 选项 | 可以承担的职责 | 需要先确认的条件 |
| --- | --- | --- |
| Vercel Hobby | 候选 Next.js 前端、预览部署与适合其执行时限的 API 请求 | Hobby 面向个人、非商业项目；核对演示的适用性、函数执行时限和免费限额。长期 Agent 任务与实时连接不能仅凭“Next.js 支持”推断可部署。[官方说明](https://vercel.com/docs/plans/hobby) |
| Render Free Web Service | 候选常驻 Node.js Agent/API 服务与 WebSocket 服务 | 空闲 15 分钟会休眠，恢复有延迟；文件系统不持久化。若有付款方式，带宽或构建额度超限可能产生费用，需先确认不会进入收费路径。[免费服务说明](https://render.com/docs/free)、[计费 FAQ](https://render.com/docs/faq) |
| Supabase Free | 候选 PostgreSQL、身份与托管实时同步 | 免费计划有数据库、连接、消息与流量额度，闲置项目可能暂停；以创建时控制台和当前计划为准，不自动升级。[定价说明](https://supabase.com/pricing) |
| Tiger Data + 自建实时传输 | 首选候选 PostgreSQL；业务 schema 与迁移由 Backend 负责，实时推送由 API 服务提供 | 先核对 Shared Free 的资格、容量、连接与区域限制，再做纵向验证；不要把当前选中的收费 compute 或试用信用额度当作长期免费实例。[官方计费文档](https://www.tigerdata.com/docs/deploy/tiger-cloud/tiger-cloud-aws/pricing-and-account-management) |

先核实 Tiger Data Shared Free，再验证单一数据源的纵向流程：Google 登录 → 创建读书记录与习惯打卡空间 → 写入记录 → 增量修改 AppSpec → 第二个用户收到版本与数据更新。免费条件不适合时再评估其他 PostgreSQL；不同时维护两套业务主数据库。

## Tiger Data 免费与试用的边界

- 当前官方文档提供无需信用卡的 30 天、$1000 Performance / Scale 试用；期满剩余额度失效，未添加付款方式时数据可能被移除。用户账户的实际剩余时间以控制台为准。[官方试用说明](https://www.tigerdata.com/go/trial)、[计费文档](https://www.tigerdata.com/docs/deploy/tiger-cloud/tiger-cloud-aws/pricing-and-account-management)
- 官方文档说明各计划包含最多两个 free services，当前为 beta；这与按量计费的 standard service 分开。精确免费容量、连接数、扩展支持、区域和生命周期需要下一轮核对 Shared Free 后记录，不能从试用余额推导。[计费文档](https://www.tigerdata.com/docs/deploy/tiger-cloud/tiger-cloud-aws/pricing-and-account-management)
- standard service 的 compute 按小时、storage 按用量计费，活跃但未使用也可收费；附加项可能收费。没有用户确认前不选择付费资源、添加收费附加项或自动升级。若最后使用试用资源，需在额度结束前明确导出/迁移/停止策略，并先保存数据。[计费文档](https://www.tigerdata.com/docs/deploy/tiger-cloud/tiger-cloud-aws/pricing-and-account-management)

## 文件与角色交接

以下路径是下一轮的归属规划，并不表示模块已经存在。

| Owner | 范围 | 交接 |
| --- | --- | --- |
| DevOps | `packages/auth/**`、`infra/**`、`.github/**`、`docs/operations/**`、`scripts/deploy/**` | Google provider/客户端配置、服务端认证模块、回调与会话/登出、私密环境、CI、发布、域名、HTTPS、回滚；登录设计见 [Google OAuth 交接](google-oauth.md) |
| Backend | `packages/db/**`、`apps/api/src/authz/**` 及业务 API | 用户/账户/会话数据模型与迁移；把已验证 Google 身份映射到内部用户；每次业务操作检查空间成员与 Owner/Participant 权限 |
| Frontend | `apps/web/**` 的登录/登出 UI 与会话状态 | 使用 DevOps 提供的认证入口与会话契约，不把按钮状态当作服务端授权 |
| Coordinator | 共享契约、应用路由适配与跨目录整合 | 在认证库与框架确定后指定实际 route adapter 文件 owner；避免多人修改同一文件 |

## 上线前需留下的证据

1. 记录实际选择的提供商、计划、免费条件、额度上限与停止策略；如仍可能收费，先给用户具体费用方案并取得确认。
2. 按已实现项目填写构建命令、启动命令、运行目录、Node.js 版本及健康检查路径。当前没有可填写的应用命令。
3. 服务端保存 OAuth client secret、会话密钥、模型、数据库与工具凭据；公开仓库、浏览器包和日志不得包含密钥。完成 Google OAuth 与会话验收；Owner 与 Participant 权限必须由 Backend 服务端执行。
4. 为版本发布和业务记录使用持久数据库。服务重启、页面刷新与断线重连后恢复最新快照，不能依赖服务器进程内存或免费主机临时磁盘。
5. 先验证平台提供的部署 URL，再按平台返回的实际 DNS 记录配置 `livingforma.tech`。认证库与实际回调路径确定后，在 Google 客户端登记完整 HTTPS redirect URI；不要预填供应商 IP 或虚构回调路径。
6. 从未登录的浏览器验证 HTTPS、Google 登录/登出、分享链接、两类生成 App、已有数据的非破坏性演化、两个用户同步和失败后恢复。保留有效的备用部署 URL。

## 待补充

- 核对 Shared Free 后确定数据库；选定实时传输、前后端托管、认证库和会话方式，验证 Pi / 模型调用适配及执行时限。
- 实际部署 URL、DNS 记录来源、HTTPS 检查时间、部署 commit、构建与验收结果。
- 演示前检查免费服务休眠、数据库暂停与额度状态；额度耗尽时停止或降级，不自动升级。
