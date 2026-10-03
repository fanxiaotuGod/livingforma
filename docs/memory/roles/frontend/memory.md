---
title: LivingForma Frontend Role Memory
type: memory
date: 2026-10-03
permalink: livingforma/roles/frontend/memory
---

# 前端角色记忆

- 产品主线是“受限规格内的通用 App 生成与持续演化”，不是固定的任务→签到→投票流程。用户已选读书记录 + 习惯打卡作为首轮验收演示；它们不是产品边界。读书空间需演示旧记录存在时新增评分并排序。
- 现阶段是文档规划；仓库尚无可运行的前端。不要把 Next.js、Motion 或任何 API 描述成已实现。
- 用户已确定先用免费额度，任何收费发生前必须确认。Tiger Data 是主 PostgreSQL 的优先候选，Shared Free 资格/额度待核实；截图中 0.5 CPU 为收费路径，未核实有实例存在。前端呈现额度耗尽或服务不可用状态，不触发自动付费。
- Google OAuth 登录是 MVP 要求。Frontend 负责 apps/web/src/、apps/web/public/、apps/web/src/components/auth 的登录/登出 UI 和会话状态；DevOps 负责 packages/auth provider/核心会话，Backend 负责用户映射、API 授权及 Tiger Data / PostgreSQL 迁移。Agent 负责 Gemini 规划器与 ElevenLabs 服务端语音适配，Frontend 仅负责可选麦克风/播放控件。
- 前端边界：只渲染服务端校验后的声明式实体 schema、AppSpec 和共享状态；不执行模型生成的 JSX、HTML、脚本、任意代码或 ToolSpec。
- 数据与界面定义解耦。字段 ID、组件 ID、记录 ID 应稳定；新增字段/改标签/隐藏字段不应自动删除旧数据。候选契约使用 definitionVersion、entitySchema.schemaVersion、stateVersion、eventCursor；尚未正式接受。
- MVP 候选组件仅 form、list、cards、counter；标题为页面元数据，筛选/排序为受限属性，其他组件待扩展。后端提案请求字段是 baseDefinitionVersion，业务动作使用 definitionVersion。
- 多人同步以服务端快照为权威；事件丢失、乱序或重连时重新拉取。候选快照含服务端解析的 role/permissions；动作需与 actionIds、工具需与 toolRefs 相交后展示，缺失权限默认禁用，真正权限仍须服务端验证。身份相关快照不能跨用户缓存。
- 动画要遵循组件身份，支持 reduced motion、键盘、焦点恢复和 aria-live 状态提示。
- 与后端/数据角色尚需锁定共享类型、迁移规则、实时传输协议、Owner 身份与业务动作接口。参考 [运行时方案](../../../frontend/runtime-plan.md) 和 [PRD](../../../PRD.md)。