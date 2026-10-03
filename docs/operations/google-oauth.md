# Google OAuth 登录交接

更新：2026-10-03。Google 登录/登出是已确认的 MVP 需求；DevOps 负责完整接入。本文是待实现方案，尚未核对或配置本应用的 Google OAuth 客户端，也未验证凭据或登录。本次只为下一开发 chat 准备文档。

## 接入需要什么

Google 登录使用 OAuth 2.0 / OpenID Connect 身份流程，需要 Google Cloud 项目中的 OAuth 品牌/同意配置和 Web application 客户端。候选服务端授权码流程使用 OAuth client ID 与 client secret；它们与调用 Gemini 的 API key 不同，已有 Gemini key 不证明登录配置完成。[Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)

DevOps 下一轮在选定认证库和框架后配置 Branding、Audience/测试用户（如适用）、Web client、实际 origin 与 redirect URI。JavaScript origin 是协议、主机与可选端口；redirect URI 包含实际回调路径，必须与请求完全匹配。开发 localhost 端口和 `livingforma.tech` 的生产回调先由实际应用确认，本文不假设回调路径。[Google Web 客户端配置](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)、[Web server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)

仅为登录申请 `openid` 及展示所需的 `email` / `profile`。当前不需要 Drive、Calendar 等 Google API 权限，也不默认请求离线 refresh token。OAuth client secret 与应用会话密钥只放服务端私密环境；准确环境变量名由选定认证库确定，不把实际值写进仓库或记忆。

## 角色与目录

| Owner | 实现职责 | 边界 |
| --- | --- | --- |
| DevOps | `packages/auth/**`：provider、服务端登录/回调、Google token 验证、应用会话、登出、前端接入契约；Google 客户端/环境配置；`infra/**`、`.github/**`、`scripts/deploy/**` 和运维文档 | 对完整登录链路负责；应用框架 route adapter 的文件归属由 coordinator 指定 |
| Backend | `packages/db/**`：内部用户、provider 账户映射及选定会话方式需要的表/迁移；`apps/api/src/authz/**`：空间访问与 Owner/Participant 检查 | 通过约定 adapter 将已验证身份映射为内部用户；认证成功本身不授予空间权限 |
| Frontend | 登录/登出控件、加载/取消/失败/会话过期状态、登录后返回原空间 | 调用约定入口与会话接口；不处理 client secret、不自行提升 Owner 权限 |
| Coordinator / QA | 定稿身份/session 契约和跨目录整合；验证真实登录及权限隔离 | 文档/凭据存在不能代替实际验收 |

先约定 `VerifiedIdentity → resolveUser → Session` adapter、会话查询结果、失效语义和登录后返回位置，再开始并行代码。DevOps 提供身份验证与会话机制，Backend 实现用户映射持久化和业务授权；不重复各写一套认证模块。

## 候选服务端流程

采用与最终 Node.js / Web 框架兼容、维护中的 OIDC/认证库，使用 Google discovery 与签名密钥，避免手写协议。候选流程是：前端启动登录 → 服务端记录一次性 `state` / `nonce` → Google 返回授权码 → 服务端交换并验证 ID token → Backend adapter 查找/创建内部用户 → DevOps 签发应用会话 → 前端加载会话后打开空间。具体库、会话存储和 HTTP 路由仍待定。[Google 服务端登录与库建议](https://developers.google.com/identity/openid-connect/openid-connect)

- 服务端验证签名、Google issuer、audience 对应本应用 client ID、到期时间，以及该次登录的 `state` / `nonce`；让库处理验证与适用的 PKCE。Google ID token 不能仅解码后信任，也不接受浏览器自行声称的用户 ID。[Google ID token 验证](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)、[OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- 使用 provider=`google` 与已验证的 `sub` 作为稳定 provider 身份，映射到内部 user ID。邮箱用于资料展示，不作为稳定身份主键；不能依据同邮箱自动取得另一账户/空间权限。[Google 身份字段](https://developers.google.com/identity/openid-connect/openid-connect)
- 应用会话使用库支持的服务端可验证机制；生产 cookie 设置 `HttpOnly`、`Secure`，按实际回调和部署拓扑选择 `SameSite`、作用域及过期时间。优先同源部署简化 cookie；跨域时先约定 cookie/CORS/CSRF 行为。业务写操作保留库要求的 CSRF 防护，日志不记录 token、secret 或完整授权码。
- 登出销毁/撤销本应用会话并清理 cookie；不承诺退出用户的 Google 账户。过期或无效会话应使受保护 API 和实时流失效；由 Backend 在请求及流访问中执行空间授权。返回地址只允许本应用认可的位置。

## 下一开发 chat 的验收与依赖

1. coordinator 锁定认证库、路由归属、内部用户/session adapter、部署 origin；Backend 提供对应迁移，DevOps 列出需要私密设置的变量名。
2. 在实际 localhost 和部署域名上完成 Google 登录、取消及错误处理；同一 Google 账户再次登录映射到同一内部用户，刷新后会话行为符合约定。
3. 错误 `state` / `nonce`、无效签名、错误 issuer/audience、过期 token 被拒绝；登出后受保护动作及流不能继续使用。
4. 用户 A 与用户 B 登录后仍受空间权限约束；Participant 直接请求发布定义或注册工具被拒绝；共享 URL 不带 Owner 凭证。
5. DevOps 在 [部署记录](deployment.md) 记录真实 HTTPS、注册的回调、部署 commit 和验收证据。应用尚不存在，当前不能提供登录成功或已上线证据。
