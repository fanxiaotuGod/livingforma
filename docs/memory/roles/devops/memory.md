---
title: DevOps Memory
type: note
permalink: livingforma/roles/devops/memory
---

# DevOps 当前记忆

更新：2026-10-03。

## 事实

- LivingForma 聚焦通用 App 生成与持续演化；任务、签到和投票是可选例子。应用尚未实现。
- 仓库是公开的 `fanxiaotuGod/livingforma`。coordinator 最新只读核对域名页：`livingforma.tech` 已注册，2026-10-03 至 2027-10-03，自动续费关闭；DNS、HTTPS 和部署可访问性尚未验证。先前只记录“已申请”是历史证据状态。
- 用户指定 DevOps 负责 Google OAuth 完整接入与 `livingforma.tech` 部署。当前只准备下一开发 chat；没有实现登录或部署。拟拥有 `packages/auth/**`、`infra/**`、`.github/**`、`docs/operations/**`、`scripts/deploy/**`；Backend 拥有 `packages/db/**` 的用户映射/会话迁移与 `apps/api/src/authz/**` 的空间授权，Frontend 拥有登录 UI。
- Tiger Data 是首选数据库候选。coordinator 只读核对创建页：选中收费 0.5 CPU，另有 Shared Free；账户额度和报价细节保存在忽略的 `.local/service-status.json`。未验证实例已创建；Shared Free 具体额度与资格待核对，不能把试用余额视为长期免费。
- Google 登录需要单独的 Cloud OAuth 同意/品牌配置与 Web client，Gemini API key 不代替 OAuth 客户端。认证库与实际回调仍待定；服务端验证 ID token 后，以 `google + sub` 映射内部用户，并独立执行空间权限。
- 用户要求免费额度优先；任何收费发生前必须确认。未创建部署资源或修改 DNS。
- 协作记忆选择 Basic Memory 0.23.2：隔离 venv 在 `.local/memory-venv/`，配置/索引在 `.local/basic-memory/`，Markdown 在 `docs/memory/`。关闭语义搜索、自动更新和 telemetry；不需要云账号或付费模型 API。
- 主协调 agent 已完成两个 memory wrapper 与本地安装；固定版本、跨进程读写/检索与重启持久化已有 smoke 报告。当前 chat 不自动热加载磁盘上的角色和 MCP 配置，应新开仓库根目录 chat 或重连 MCP。
- 新笔记检索可能有索引延迟；测试最多每秒重试一次、共 10 次。已知路径可先直接读取，不因未命中而重复创建。wrapper 同时关闭 FastMCP 更新检查与 banner。
- DevOps 只维护自己的记忆；共享笔记采用主协调 agent 单一写入。没有开通云服务、发生云费用或部署产品。

## 证据

- 产品范围与费用要求：`docs/PRD.md`、`docs/product/open-questions.md`，以及本次用户确认，由主协调 agent 传达。
- 部署选项、最新域名/创建页证据和免费/试用边界：`docs/operations/deployment.md`，引用提供商官方文档；尚未部署 App 或创建本轮资源。
- Google 登录职责与验收：`docs/operations/google-oauth.md`，引用 Google 官方 OIDC、Web 客户端与 token 验证文档。尚未实现或验证登录。
- 本地记忆比较与配置依据：`docs/research/local-memory.md`，引用 Basic Memory 与 MCP reference server 官方资料。
- 最终测试：`.local/memory-smoke-report.json`（2026-10-03 14:23 America/Vancouver / `21:23:03Z`），`basic_memory=0.23.2`、`success=true`、`search_attempts=1`、`cleanup_reindex_ok=true`；DevOps 已阅读报告。14:20 的历史通过记录保留在 journal。
- 主协调 agent 的验证结果：限定本仓库的 Codex trust、目标 MCP 配置读取成功、strict config 无 malformed role；本地检查不证明当前聊天已载入新工具。

## 待确认 / 待验证

- 在新开的仓库根目录 chat 中实际使用 `livingforma_memory`；当前会话热加载不作保证。
- Tiger Data Shared Free 实际资格/限制、实时传输、前后端托管和额度停止策略。
- Google OAuth 认证库、实际 origin/回调、内部用户与 session adapter/迁移、真实双用户登录与登出验收。
- 实际构建/启动命令、健康检查、重连恢复和多客户端验收。
- 实际部署 URL、部署 commit、域名 DNS、HTTPS 与无登录访问结果。
