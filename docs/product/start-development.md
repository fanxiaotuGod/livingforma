# 新窗口启动 LivingForma 开发

在 Codex 中选择本机项目 `/Users/fanhaocheng/project/livingforma`，新建一个主对话。先由 coordinator 建立 LF-100 共享骨架，再按依赖分派 frontend/backend/agent/devops/qa；当前应用尚未实现，不要让几个窗口各自创建一套骨架。

## 推荐：一个主窗口管理多 agent

把下面整段作为第一条消息：

```text
你担任 LivingForma 的 coordinator，请开始实际开发。
项目目录：/Users/fanhaocheng/project/livingforma。

先读 AGENTS.md、docs/PRD.md、docs/product/use-case-capability-map.md、docs/frontend/skills-guide.md、公共 memory 和各角色最近日记，保留现有未提交修改。按 scripts/coordination.py 创建自己的 session、领取任务、检查文件范围，完成后更新日志和共享记忆。

产品两条主线：
1. 丰富可复用的前端组件，由 Agent 判断如何组装；界面能持续变形，旧数据和 URL 保留。
2. 后端以 Pi 编排能力，创建、验证、注册并复用工具，把真实结果绑定到界面。

从 LF-100 建立可运行骨架和共享契约，优先采用 Vite + React + TypeScript + Motion 与 Node 后端。用多 agents 分担 frontend、backend、agent、devops、qa；遵守依赖和文件认领，按并发上限分批推进，不需要替我创建其他用户对话。

前端任务明确使用 $frontend-dev 和 $animations，按 docs/frontend/skills-guide.md 做项目适配：保留 Vite/Motion 方向，跳过 MiniMax 付费素材流程，不需要为不存在的辅助 skills 停工。先交付本地可运行的读书记录与习惯打卡、Owner 左上角圆球、组件组合和变形实验场，再接真实数据/API；模拟功能要明确标注。

访客匿名可浏览、写入时 Google 登录，只有空间 Owner 能改网站。语音与相机按已记录里程碑接续。默认免费额度，收费前先问我。请落实代码、运行并验证，告诉我启动方式、实际完成内容和剩余阻塞，不只停在计划。
```

## 如果要单独跟进某个角色

仍在同一个本地项目里新建对话，第一句话固定角色即可。前端示例：

```text
你只负责 LivingForma 的 frontend 角色。先读 AGENTS.md、.codex/agents/frontend.toml、前端体验与 skills-guide、公共记忆和自己的日记。使用 $frontend-dev、$animations，并按项目适配要求工作。
创建自己的 session，自动领取依赖已满足的 frontend 任务，按认领范围开发和更新个人 memory/journal；公共契约交接给 coordinator。保留现有未提交修改，不改其他角色文件。优先实现可复用组件库、Owner orb、不同场景的组合和保留数据的连续变形。
```

Backend / Agent / DevOps / QA 窗口用相同的启动方式，换成对应角色并读取 `.codex/agents/<role>.toml`。依赖尚未满足时做只读准备，不擅自跳过 LF-100 或扩展认领；由主窗口协调。每个窗口使用自己的 session，不共享活跃 session ID。

独立对话不会自动共享完整聊天记录；它们通过仓库文档、Basic Memory 与任务认领恢复进度。同一 clone 或同仓库 worktree 可以共享本地认领；其他 clone/电脑需要另行同步。

## 已安装的开发技能

本机用户目录中安装 `frontend-dev` 与 `animations`，完整支持目录与许可证保留，来源版本记录在 `.codex/third-party-skills.json`。下一轮可使用，新窗口可直接按上述名称指定；安装不需要调用模型、素材 API 或设置 MiniMax 密钥。

技能原文与项目约定冲突时遵循用户和项目约定；引用原文的设计/动画部分，并如实记录未采用的阶段。技能文件不是应用 npm 依赖，也不意味着组件已经实现。新机器需按 [前端 skills 约定](../frontend/skills-guide.md) 安装，Git pull 不会同步用户目录里的技能。

Codex 支持显式指定 skills，也可按任务选择；它们与项目 AGENTS、记忆和子 agent 配合使用，见 [OpenAI 官方说明](https://learn.chatgpt.com/docs/customization/overview#skills)。
