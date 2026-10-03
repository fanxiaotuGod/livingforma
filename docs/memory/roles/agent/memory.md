---
title: LivingForma agent-development memory
type: note
permalink: livingforma/roles/agent/memory
---

# Agent 开发角色记忆

## 已确认
- 负责 Pi runtime、Gemini 规划、AppSpec/ToolSpec 生成、受控能力注册和复用。
- 通用 App 生成优先，业务示例不限于活动。
- 模型输出先验证，再由宿主执行。模型不直接决定数据库写入或任意代码执行。
- 开发团队的 Basic Memory 不等于用户 App 的业务数据库或产品能力记忆。

## 当前状态
- 仅角色与工作流配置就绪，尚无 Pi/Gemini 应用集成。
- 之前 API 的简单连通测试不能证明工具循环、schema 输出或应用链路可用。
- 具体模型 ID、免费额度及 Pi 兼容性在实施时重新验证。

## 下一步
对齐接口版本和规划输出 schema；设计最小工具集；测一个真实规划→验证→提交闭环。密钥只在服务端环境，日志和记忆只写变量名。