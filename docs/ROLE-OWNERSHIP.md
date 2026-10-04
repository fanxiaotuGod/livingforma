# 角色、文件归属与自动领取

更新：2026-10-03。这是当前开发的职责约定；应用骨架及主要模块已经实现，验收与发布状态见共享任务板，不能从文件职责推断功能完成。

## 谁负责什么

| 角色 | 必须交付 | 主要文件范围 | 跨角色交接 |
| --- | --- | --- | --- |
| coordinator | 产品与共享接口定稿、目录/依赖初始化、任务依赖、最终整合 | 根配置、各 package manifest、`packages/contracts/`、公共记忆、任务目录 | 独占公共依赖与 lockfile 修改；整合阶段才领取跨层代码 |
| frontend | Owner 圆圈与满幅网站、可扩展 renderer/皮肤/calendar-grid、变形/同步体验、写入登录、相机/语音本地生命周期 | `apps/web/src/`、`apps/web/public/`、`docs/frontend/` | 使用 DevOps 的 session 接口、Backend API、Agent 的语音接口；不放服务密钥 |
| backend | Tiger Data/Postgres 表与迁移、用户映射、空间成员权限、数据/API/版本/SSE、工具执行记录 | `apps/api/src/`、`packages/db/`、`packages/integrations/snowflake/`、`docs/backend/` | 消费已验证的 Google 身份；挂载 auth/agent 适配器；为可选 Snowflake 分析提供脱敏事件 |
| agent | Pi + Gemini 意图/视觉理解、AppSpec/ToolSpec 提案与能力目录、ElevenLabs 转录/播报和中断 | `packages/agent/`、`packages/integrations/gemini/`、`packages/integrations/elevenlabs/`、`docs/agent/` | 模型不直接写库；Backend 决定是否提交；Frontend 控制录音/播放 |
| devops | **Google OAuth 登录集成主负责人**：provider、服务端认证/session/退出模块、环境变量；CI、托管、DNS、HTTPS、部署到 **livingforma.tech** | `packages/auth/`、`infra/`、`.github/`、`scripts/deploy/`、`.env.example`、`docs/operations/` | Backend 负责 users/identities 表与业务授权，Frontend 负责登录 UI；DevOps 对完整登录与线上可用性验收负责 |
| qa | 匿名浏览/登录写入/Owner权限、两种生成 App、变形保留数据、同步、真实语音/相机、费用降级与上线独立验证 | `tests/e2e/`、`docs/qa/` | 产品代码缺陷交给相应 owner；自己的测试文件按任务领取 |

每个角色也独占 `docs/memory/roles/<role>/`。交接笔记使用任务 ID + session ID 的唯一文件名。上表是默认归属；本次真正允许修改的范围以认领成功返回的 `paths` 为准。

LF-100 先建立目录和公共接口；LF-145 让 coordinator 在四个实现角色并行时维护共享类型、App manifest 和根 lockfile。模块内部 manifest 随模块 owner 修改，依赖请求须向 coordinator 交接。LF-155 保留独立的目录维护入口，通常在 LF-150 整合后用于 QA/部署返工；它不依赖产品验收，以便安全更新上游任务；该持续任务空闲时释放，便于后续会话追加返工。

## 自动意识到该改哪些文件

1. Agent 读取 PRD、公共记忆、自己的日记及本文件，理解需求和既有接口。
2. 从 `.codex/coordination.json` 中为自己的角色领取下一个依赖已完成的任务；原子认领返回目标、文件范围与验收标准。
3. 阅读代码后，在允许范围内自行确定具体文件。新文件沿用同一目录边界；每次开始一批修改前用 `check` 确认归属。
4. 如果需求落到别的角色，写交接给该 owner；如果没有合适任务，coordinator 扩充目录，而不是让用户逐个报文件名。
5. 完成检查和日记后，记录 evidence 并 `finish`；下游角色才能领取依赖这个结果的任务。

**共享记忆解释原因；认领数据库记录当前占用。** MCP 搜索存在索引延迟，不能拿“暂时没搜到任务”来判断文件空闲。认领通过 SQLite 事务处理，同一路径及父子目录冲突会被拒绝。同角色可存在多个空闲会话，但同时仅有一个活跃任务认领，保护个人日记。

这是 agent 遵守的协作协议，不是操作系统的写入防护；绕过脚本的编辑仍可能冲突。程序不会凭自然语言自动修改文件，也不会常驻运行所有角色。

## 新对话入口

主对话可以直接使用：

> 按 AGENTS.md 开始开发。先读共享记忆、ROLE-OWNERSHIP 和任务目录，创建 coordinator session，自动领取可开始任务。完成基础约定后，按依赖安排 frontend、backend、agent、devops、qa；所有角色先认领再编辑，并更新自己的日记。Google 登录由 DevOps 主责，目标域名 livingforma.tech，主数据库优先 Tiger Data；收费前确认。

独立角色对话只需改变角色名：

> 你负责 frontend。读取 AGENTS.md、ROLE-OWNERSHIP、PRD 和自己的记忆，创建 frontend session，自动领取依赖已满足的下一任务。自行判断范围内需要修改的文件；遇到占用或依赖未完成就报告阻塞，不接管别人文件。完成后更新记忆、记录验收证据并释放认领。

前端必须读取 [体验方向](frontend/experience-direction.md) 和 [Skills 使用约定](frontend/skills-guide.md)。语音/相机以 LF-180/181/182 → LF-185 接在基础整合 LF-150 后，再进入 LF-160 QA 和 LF-170 部署。操作命令、恢复和多 worktree 边界见 [WORKFLOW](WORKFLOW.md)。
