---
title: LivingForma accepted decisions
type: note
permalink: livingforma/shared/decisions
---

# 已接受决策

## D-001 · 2026-10-03 · 通用生成优先

来源：用户明确选择“优先通用 App 生成，弱化活动场景”。
结论：自然语言创建 App 并持续修改布局、字段、交互和能力为主线。Todo、签到、投票等只是示例。3D 暂为扩展，不强制 Discord 集成。

## D-002 · 2026-10-03 · 免费优先

来源：用户确认。
结论：先用免费额度；任何新增收费、付费资源、套餐升级前须确认。DevOps 提供可审核的方案和费用再行动。

## D-003 · 2026-10-03 · 固定角色、按任务启动

来源：用户授权多 agent 分工，coordinator 采用本环境并发限制。
结论：frontend / backend / agent / devops / qa；主 agent 协调。最多同时三个子 agent；不指定模型覆盖。角色通过文件恢复记忆，不依赖永续会话。

## D-004 · 2026-10-03 · 本地记忆

来源：本次研究与工作流设计，见 docs/research/local-memory.md。
结论：Basic Memory 0.23.2，项目独立运行环境和索引，Markdown 在 docs/memory。关闭云端路由、自动更新、语义模型下载与遥测。角色各自日志；公共文件 coordinator 单一写入。
安装与验证结果单独记录，决策本身不证明服务已连接。

## D-005 · 2026-10-03 · 先生成受约束的规范

来源：原始产品 brief，适用于通用生成。
结论：AppSpec / ToolSpec 表达能力内优先生成规范；由程序校验执行。通用不等于无限代码执行，未支持的请求应说明限制或进入后续能力规划。

## D-006 · 2026-10-03 · 首轮演示样例

来源：用户明确选择“读书记录 + 习惯打卡”。
结论：两类 App 由同一套运行时生成；读书空间先创建记录，再加评分字段和排序，证明旧数据保留。样例不改变产品的通用生成定位。

## D-007 · 2026-10-03 · 自动任务与文件认领

来源：用户希望不同独立对话通过共享记忆自行判断文件职责。
结论：Markdown/MCP 保存上下文与交接，Git common directory 下的 SQLite 记录实时认领；agent 从预先分工的任务目录自动领取依赖已满足的工作。父子路径冲突、同角色的第二个活跃任务拒绝；无自动过期抢锁。coordinator 对新任务扩充目录，用户不必逐个指明文件。机制为协作协议，不能阻止绕过脚本的写入。

## D-008 · 2026-10-03 · Google 登录与生产域名

来源：用户明确指定 DevOps 负责 Google OAuth，网站部署到 livingforma.tech。
结论：DevOps 主责 provider、packages/auth、session/退出与部署；Backend 维护用户映射/数据迁移及空间授权；Frontend 实现登录 UI。OAuth client 与 Gemini key 分离。当前准备后续开发，尚未实现或上线；收费前确认仍有效。

## D-009 · 2026-10-03 · 服务归属

来源：用户提供已打开的服务页面；coordinator 结合产品主链路安排。
结论：Backend 优先评估 Tiger Data Shared Free 为单一业务主库，负责可选 Snowflake 脱敏事件分析；Agent 负责 Gemini 规划和 ElevenLabs 服务端语音，Frontend 提供语音控件，DevOps 管私密配置与用量。账号存在不等于 API 已集成，试用不是长期免费承诺。
