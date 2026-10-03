---
title: Backend Role Memory
type: role-memory
role: backend
updated: 2026-10-03
timezone: America/Vancouver
permalink: livingforma/roles/backend/memory
---

# Backend 角色记忆

## 已完成

- 阅读 `docs/PRD.md` 的当前通用 App 产品方向和 `README.md`。
- 编写 `docs/architecture.md`，明确 State、AppSpec、ToolSpec 分工，拟议接口与数据模型。
- 描述 stable fieldId + JSONB records 的状态保留演化，以及版本冲突、幂等动作和原子发布。
- 描述持久 stream_events、SSE 游标/重放、snapshot 一致恢复和 PostgreSQL 通知的边界。
- 给出一个只读 HTTP ToolSpec 的受控能力演示候选，服务待确认。
- LF-003 对齐复核：为候选 snapshot 增加服务端 effective `role` / `permissions`，说明前端按权限交集呈现控件、服务端重新鉴权和身份相关快照不可跨用户缓存。

## 已核实

- 截至 2026-10-03，本轮读取时仓库没有可运行应用；架构内容是提案，不能当作实现或测试结果。
- PRD 明确优先通用 App 创建和持续编辑；任务、签到、投票、读书记录等仅为可选示例。
- PRD 要求界面变化保留业务数据和 URL；只有 Owner 发布定义和启用外部有副作用能力。
- PRD 要求任何收费发生前获得用户确认，不自动升级计划。
- 本轮仅写分配的 architecture 与 backend 角色 memory/journal 文件；未修改配置、脚本、共享记忆，未 commit/push。
- 文档已通过本轮静态阅读核对；尚无源代码、数据库或端到端验证。

## 持续约束

- Node.js / TypeScript / Fastify 与 SSE 是实现候选；主库优先 Tiger Data/PostgreSQL，须先核实 Shared Free 条件，不是已创建的服务。
- Google OAuth 登录已确定，DevOps 拥有 packages/auth/provider/session，Backend 拥有用户/Google subject 映射、数据迁移、API 挂载和空间授权。Google 登录不等于任何空间的 Owner。
- 代码归属 apps/api/src/、packages/db/；Snowflake 的脱敏事件分析可选，不做在线第二主库。全部归属见 docs/ROLE-OWNERSHIP.md。
- 开始实现先用 scripts/coordination.py 为 backend 创建 session 并自动领取 LF-120 等可执行任务；依赖未满足时不越界修改。
- 业务值绑定稳定字段 ID；改标签/布局不更换字段键。移除展示不物理删除历史值。
- definitionVersion、schemaVersion、stateVersion 与 eventCursor 分工不同，不混为一个版本。
- 候选快照中定义嵌套在 `definition`，schemaVersion 位于 `definition.entitySchema`，stateVersion/eventCursor/role/permissions 在顶层；拒绝另起 specVersion/stateRevision 别名。最终共享类型待 coordinator 接受。
- 模型只返回声明式提案；不得直接执行生成的代码、SQL、shell 或任意 HTTP 目标。
- 数据写入、版本推进、幂等结果和流事件在同一事务提交；通知只用于唤醒，不替代持久重放。
- Participant 不能通过共享 URL 获得 Owner 权限；接口权限由后端验证。
- ToolSpec 只持 credentialRef；真实凭据只由服务端注入，不进入浏览器、spec 或日志。
- 当前不声称服务集成、数据库或测试已完成。待定项必须保留“拟议/待确认”表述。

## 待办

1. 团队确认前后端接口，尤其完整 FieldSpec、FilterExpression、AllowedActionSpec 与 HTTP 错误契约。
2. 对齐 Google session/用户映射 adapter、Participant 策略、Tiger Data 免费额度和部署长连接支持。
3. 实现持久空间、版本化定义、业务记录与安全演化；优先通用生成主链路。
4. 实现持久 SSE 事件和 snapshot 恢复，验证两个浏览器、并发冲突与幂等重试。
5. 选择并授权一个免费只读 HTTP 测试/真实服务，再实现工具验证、注册、执行和复用。
6. 真实运行后把命令、测试结果、失败条件和确认决定记录在本角色 journal；不得以设计推演替代执行证据。

## 下次启动先读

- `docs/PRD.md`
- `docs/architecture.md`
- 本文件与 `journal.md`
- 团队共享决定文件如已存在；冲突时先向 coordinator 报告，不自行把提案提升为已确认决定。
