---
title: LivingForma shared interfaces
type: note
permalink: livingforma/shared/interfaces
---

# 公共接口状态

当前尚无已实现的代码接口。此文件由 coordinator 单独维护。

## 已接受原则

- AppSpec、业务状态、ToolSpec 分离，均有可识别的版本。
- 前端按稳定 ID 绑定数据；改标题、排序和布局不改业务身份。
- 服务端验证模型输出，再保存和广播；失败不能提交半个版本。
- 多人同步需明确事件顺序、重复消息处理、断线恢复。
- 记录的实现状态必须有代码/测试证据。

## 等待评审

- frontend / backend 已对齐以下**候选命名**：快照中的 `definition.definitionVersion`、`definition.entitySchema.schemaVersion`、`definition.appSpec`；顶层 `stateVersion`、`eventCursor`、`role`、`permissions`。提案请求使用 `baseDefinitionVersion`，业务动作请求使用 `definitionVersion`。
- 最小候选组件为 `form/list/cards/counter`；页面标题属于 metadata，筛选/排序属于受限属性。首个外部能力候选仅为只读 GET。
- 这些是已对齐的设计提案，尚非已实现或最终 accepted 的接口。完整 schema、动作类型、身份机制和部署约束仍需 LF-010 定稿。
- 详细 schema / API / SSE event 见 [架构提案](../../architecture.md)，前端依赖见 [运行时方案](../../frontend/runtime-plan.md)。
- agent 提交规划输出和工具调用边界。
- coordinator 对齐之后在此记录 accepted 版本，不能因为某个角色写了文档就视为接口已定稿。
