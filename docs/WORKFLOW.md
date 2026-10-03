# LivingForma 多 agent 开发工作流

## 如何开始

从 LivingForma 仓库启动 Codex。根目录 `AGENTS.md` 会提供统一规则，`.codex/agents/` 提供 frontend、backend、agent、devops、qa 的职责。主 agent 担任 coordinator。

固定角色意味着**职责和记忆可恢复**，不意味着多个进程一直运行或永远保留聊天上下文。每次启动角色都先读 PRD、公共记忆和自己的日记。当前环境并发上限为主 agent 加三个子 agent；按依赖分批启动五个角色。

给主 agent 的开发请求示例：

> 按 AGENTS.md 开始下一个 MVP 里程碑。先读任务板，拆分独立任务，安排 frontend、backend、agent 角色并行工作，必要时让 devops 和 qa 接续。完成后整合并验证，更新各自日志和公共记忆。

## 一个主对话，还是多个角色对话？

**日常推荐一个主对话。** 在 Codex 中打开 `livingforma` 仓库并新建主对话，把上面的开发请求发给 coordinator。主 agent 负责启动需要的子 agent、分配文件、等待结果、整合与验证。你继续在主对话提出需求和调整方向即可；可打开子 agent 的活动查看进度，不需要手动创建五个窗口。这个工作方式也符合 [OpenAI 官方子 agent 文档](https://learn.chatgpt.com/docs/agent-configuration/subagents)。

**多个独立对话适合分别跟进长期任务。** 可以都关联同一 LivingForma 项目，但对话标题不会自动指定角色，也不会自动互通聊天历史。每个对话开头要明确角色、任务 ID、允许修改的文件，并要求读取角色配置和记忆。例如：

> 你负责 frontend。先阅读 AGENTS.md、.codex/agents/frontend.toml、docs/PRD.md、公共任务板，以及 docs/memory/roles/frontend/ 下的记忆和日记。只执行 coordinator 已分给 frontend 的任务与文件范围；需要修改公共接口时先交接，完成后更新自己的日志和摘要。

始终保留一个 coordinator 维护公共任务板。不要同时让独立的 frontend 对话和主对话启动的 frontend 子 agent 修改同一范围。不同文件可以共用 checkout；需要并行改相同文件时，用各自的 worktree，由 coordinator 合并。不同 worktree 默认有各自的记忆文件和索引，需先交接/合并文档，不能假设 MCP 会实时跨 worktree 同步。

共享记忆依赖角色主动更新笔记；它不自动记录每句话，也不让所有对话立即知道其他人的变化。恢复任务先读公共任务板和个人日记，完成任务再写结果与下一步。

## 本地安装与验证

```bash
python3 scripts/setup-workflow.py --trust
bash scripts/setup-memory.sh
python3 scripts/check-workflow.py
bash scripts/memory.sh --version
bash scripts/memory.sh project list
bash scripts/memory-smoke.sh
```

上面的配置/检查脚本需要 Python 3.11+；如果系统 `python3` 较旧，请改用已安装的 `python3.12`。Basic Memory 安装需要 Python 3.12+；可通过 `LIVINGFORMA_PYTHON=/absolute/path/python3` 指定解释器。它使用项目内独立虚拟环境，不修改系统 Python。首次安装从 PyPI 下载固定版本 Basic Memory；实际依赖会记录在 `.local/memory-installed.txt`。索引和运行配置在 `.local/`，不入 Git。

`setup-workflow.py` 根据 `.codex/config.toml.example` 生成被 Git 忽略的本机 `.codex/config.toml`，写入绝对路径，避免 MCP 工作目录解释差异。已有非本脚本生成的配置不会被覆盖。换目录或新机器运行脚本即可重新生成。

项目级配置必须在被信任的项目中加载。`--trust` 仅把本仓库的确切路径加入用户 Codex 配置，原文件私密备份在被 Git 忽略的 `.local/config-backups/`；不改模型、sandbox 或审批设置。省略该参数时，可在 Codex 打开此仓库并信任该项目。安装后新开一个以 LivingForma 为项目的 chat，或在 MCP 设置里重新连接；当前 chat 不保证热加载新角色/工具。

## 日常流程

1. **理解**：coordinator 对照 PRD 确定用户意图、当前状态和本次边界。
2. **分工**：在公共任务板分配 ID、owner、文件范围、依赖、验收方式；一个文件只有一个写入者。
3. **并行**：没有依赖的任务并行；公共接口先讨论，确认后再实现。
4. **验证**：每个角色检查自己负责部分，qa 独立验证关键用户路径，coordinator 检查跨层联通。
5. **交接**：角色写自己的日记与摘要，向其他角色输出明确的接口/问题/证据。
6. **汇总**：coordinator 更新公共决策、接口和任务板，再向用户报告可运行成果及限制。

任务分配模板：

```text
Task: LF-xxx
Role:
Goal:
Owned files:
Dependencies:
Acceptance checks:
Deliverable:
```

日记/交接模板：

```text
Time: YYYY-MM-DD HH:MM America/Vancouver
Task:
Status: proposed / in-progress / implemented / verified / blocked
Changes:
Evidence and checks:
Blockers:
Next:
Shared facts or interface changes:
```

## 记忆怎么共享

- `docs/memory/roles/<role>/memory.md`：角色的当前状态，短且可直接恢复工作。
- `journal.md`：追加式日志，只记录事实、结果、测试和下一步。
- `docs/memory/shared/`：公共背景、已接受决定、接口和任务板；coordinator 单一写入。
- `docs/memory/handoffs/`：每份交接独立文件，避免并发覆盖。
- `docs/PRD.md`：产品需求的权威文档。记忆中的摘要不能替代它。

Basic Memory 的 project 固定为 `livingforma`，索引范围只有 `docs/memory/`。角色内存是协作分区，不是安全访问隔离；所有项目 agent 可以读取公共需要的内容。

启动先搜索相关主题，例如 `search_notes(query="AppSpec", project="livingforma")`，再用 `read_note` 查看全文。创建交接时使用唯一标题和 `write_note(overwrite=false)`。MCP 不可用时直接读写同一批 Markdown，随后运行 `bash scripts/memory.sh reindex --project livingforma --search` 重新索引。

全文索引可能晚于文件写入。新笔记暂时搜不到时，先按已知路径读取，再短暂重试搜索；不要因为一次空结果重复创建同一笔记。烟雾验证允许最多十次、间隔一秒的检索尝试，并在本地报告记录实际次数。

## 恢复与并发

中断后先看 Git 状态、任务板和最近日志，确认哪个产物真实存在。不要根据旧聊天猜测成功。初始化数据库/迁移先顺序完成，再启动多个客户端。同一角色同一时间只运行一个写入任务。不要把本地 SQLite 放在网络共享盘上并发写。

代码、文档、角色定义可通过 Git 共享给队友；每台机器重新建立自己的索引。这不是自动跨机器同步服务。

## 当前边界

应用功能仍在开发前期，基础工作流安装不等于产品已经实现。首要方向是通用 App 生成和持续编辑；活动场景只是示例。预算为免费额度优先，任何收费行为须先得到用户确认。上线平台、鉴权及首个外部能力仍见 `docs/product/open-questions.md`。
