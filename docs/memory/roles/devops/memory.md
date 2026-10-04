---
title: DevOps Memory
type: note
permalink: livingforma/roles/devops/memory
---

# DevOps 当前记忆

更新：2026-10-03 16:36 America/Vancouver。此处为当前摘要；历史进度完整保留在 journal.md 与独立 handoff，不把历史未实现规划当现状。

## 已实现与实际验证

- LF-140：Google Web OAuth/session模块使用openid-client6.8.8，PKCE/state/nonce、显式JWT签名、opaque哈希会话、Origin/CSRF、退出、生产完全禁止本地persona。17安全测试和真实localhost Google登录/刷新/退出通过；Google用户对自己未拥有的fixture仍是Participant。真实生产回调仍待LF170。
- 生产主库是Neon Free。严格TLS `sslmode=verify-full` 的SELECT1、业务与预算持久化、coordinator生产Dockerhealth/session/SPA/local-login404已验证。Tiger Shared Free已创建但证书链验证失败，保留为空备用，未关闭TLS校验或升级。
- LF-148：私密.env与部署Blueprint对齐 `AGENT_MODE=gemini`、`GEMINI_MODEL=gemini-3.5-flash-lite`、日上限30及两个verified=true。3.8曾503、2.5曾404；不付费fallback。公开.env.example保留verified=false给未经核实的新账户，模型/mode明确。
- ElevenAPI真实账户复核：included pool可用，PAYG零余额、AutoTopUpOFF；官方PAYG说明先消耗included并在余额0时暂停，无自动欠费。独立USD余额没有显示，不从价格表推算。服务器专用key cap10000credits，仅TTS/STT/voices-read/models/subscription-read；Agent真实合成fixture STT/vision/TTS已有证据。
- 媒体固定期 `verified-2026-10-03`、STT60秒、TTS1000 UTF-16字符/每bucket每分钟3次，Agent与DB代码共同固定，非环境变量；复用既有Neon，不删除或重置ledger。LF148只读时Gemini30/30（2026-10-03），STT5/60、TTS153/1000；并发整合可推进计数，以DB为准。Gemini耗尽后等待正常UTC日窗口，媒体不每日重置。
- `scripts/deploy/preflight.mjs` 只读检查配置和现有数据库ledger，BEGIN READ ONLY/SELECT/ROLLBACK，无provider请求。18项生产配置及ledger检查通过；unverified flag拒绝且不查DB；YAML解析、固定上限、local links、秘密泄漏、ignore/0600和diff检查通过。

## 部署状态与剩余步骤

- **未上线**：CI/Docker/Render Free Blueprint与读后部署验证脚本已准备。Render账号最终Create Account条款确认仍待用户，未创建托管service/未改DNS/未发布。恢复的Chrome tab1369830686停在 `https://dashboard.render.com/register/github`；保留handoff。
- LF185整合→LF160独立QA→LF170正式发布。Render批准后先核查Free/no-payment-method，任何card/收费需要用户确认；只发布安全应用修改。Blueprint路径infra/render.yaml，secret初次sync:false输入，后续新secret需手工加。
- 部署必须复用当前Neon的定义/记录/用户/额度；生产origin livingforma.tech，Google同域callback已登记。平台HTTPS/实际DNS目标/域名证书/production Google登录退出、Owner隔离、SSE恢复、HTTPS设备权限/Stop等仍须实际验收。
- 凭据只在Git ignored `.env`（0600）与部署secret，禁止输出/前端VITE/公开日志。Render Free超额无卡则停服或停build；不得为了连续服务自动加卡升级。

## 协作与证据

- 当前LF148 session `60aae246-d567-48ba-8809-a5adbfe512e6`，完成准备验收后finish/close；不领取依赖未满足的LF170。
- [LF148交接](../../handoffs/devops/LF-148-60aae246-d567-48ba-8809-a5adbfe512e6.md)、[LF140交接](../../handoffs/devops/LF-140-9a7de296-330f-4b31-9169-c830876362fb.md)、[部署说明](../../../operations/deployment.md)、[Google说明](../../../operations/google-oauth.md)、[媒体真实证据](../../../agent/evidence/LF-181-live-media.json)。
- 公共memory只由coordinator编辑。MCP未在当前工具中提供，依AGENTS从Markdown恢复；BasicMemory0.23.2此前验证可跨进程读写/重启持久化，索引不代替实时claim锁。
