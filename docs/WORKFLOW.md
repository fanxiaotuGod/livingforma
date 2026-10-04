# LivingForma 多 agent 开发工作流

## 如何开始

从 LivingForma 仓库启动 Codex。根目录 `AGENTS.md` 会提供统一规则，`.codex/agents/` 提供 frontend、backend、agent、devops、qa 的职责。主 agent 担任 coordinator。

固定角色意味着**职责和记忆可恢复**，不意味着多个进程一直运行或永远保留聊天上下文。每次启动角色都先读 PRD、公共记忆和自己的日记。当前环境并发上限为主 agent 加三个子 agent；按依赖分批启动五个角色。

给主 agent 的开发请求示例：

> 按 AGENTS.md 开始下一个 MVP 里程碑。先读任务板，拆分独立任务，安排 frontend、backend、agent 角色并行工作，必要时让 devops 和 qa 接续。完成后整合并验证，更新各自日志和公共记忆。

已安装 `frontend-dev` 与 `animations` 的完整本机 skill 包；前端按 [适配约定](frontend/skills-guide.md) 使用。可直接复制 [新窗口启动指令](product/start-development.md) 开始开发，先由 coordinator 完成 LF-100 骨架，再按依赖分派角色。

## 一个主对话，还是多个角色对话？

**日常推荐一个主对话。** 在 Codex 中打开 `livingforma` 仓库并新建主对话，把上面的开发请求发给 coordinator。主 agent 负责启动需要的子 agent、分配文件、等待结果、整合与验证。你继续在主对话提出需求和调整方向即可；可打开子 agent 的活动查看进度，不需要手动创建五个窗口。这个工作方式也符合 [OpenAI 官方子 agent 文档](https://learn.chatgpt.com/docs/agent-configuration/subagents)。

**多个独立对话可以自动领取角色任务。** 都关联同一 LivingForma 项目，开头指定角色即可；agent 根据共享记忆、[文件归属](ROLE-OWNERSHIP.md)和任务目录自动查找下一任务及文件范围。对话标题不会自动指定角色，也不会自动互通聊天历史。例如：

> 你负责 frontend。先阅读 AGENTS.md、.codex/agents/frontend.toml、docs/PRD.md、公共记忆和自己的日记，创建角色 session 并自动领取下一项依赖已满足的任务。在认领范围内自行判断文件；需要公共接口变更时交接。完成后更新日记、记录验收证据并结束认领。

保留一个 coordinator 维护公共任务目录和共享记忆。主对话启动的子 agent 和独立对话都使用同一认领协议；活跃的同角色任务或父子路径重叠会被拒绝。同一 Git 仓库的 worktree 共用认领数据库，仍按先后顺序修改重叠路径；隔离目录并不自动允许突破归属。不同 worktree 的 Markdown 记忆与索引仍独立，需先交接/合并文档。不同 clone/机器不共用本地认领数据库。

共享记忆依赖角色主动更新笔记；它不自动记录每句话，也不让所有对话立即知道其他人的变化。恢复任务先读公共任务板和个人日记，完成任务再写结果与下一步。

## 自动发现、认领与释放

下列命令由 agent 执行，用户不必手工填文件名。任务目标、路径和依赖位于 `.codex/coordination.json`；`status` 返回实时状态，公共 Markdown 任务板是 coordinator 的摘要。

```bash
python3 scripts/coordination.py status
python3 scripts/coordination.py session --role frontend
# 保存上一条返回的 session.id；每个聊天使用自己的 ID。
python3 scripts/coordination.py next --session SESSION_ID
python3 scripts/coordination.py check --session SESSION_ID --path apps/web/src/app/page.tsx
python3 scripts/coordination.py heartbeat --session SESSION_ID
# 写完日记、验收通过后才完成任务：
python3 scripts/coordination.py finish --session SESSION_ID --task LF-110 --evidence "实际测试命令、结果与交接路径"
python3 scripts/coordination.py close --session SESSION_ID
```

依赖未完成时不会自动越过它。可先做只读检查，等待上游证据。任务未完成就退出时，先写交接，再 `release --session SESSION_ID --task LF-110 --reason "原因与剩余工作"`，最后关闭 session。需要指定任务时用 `claim --session SESSION_ID --task TASK_ID`，仍检查角色、依赖和冲突。

coordinator 先领取 LF-100 建立应用骨架和接口，验证 Vite SPA 建议并锁定框架/会话/扩展组件契约；完成后领取 LF-145 保持公共任务板和依赖协调，再启动或等待其他角色。frontend/backend/agent/devops 的首个实现任务都依赖 LF-100。LF-150 完成文字生成、持久化与公开/Owner 视图整合；随后 frontend LF-180、agent LF-181、backend LF-182 并行接入语音与相机，coordinator LF-185 整合，之后 LF-160 QA、LF-170 正式部署。当前不会因为目录里列了任务就自行运行应用开发。

coordinator 可在完成 LF-150 后领取 LF-155，在多模态并行工作、QA/上线期间维护目录和安排返工；进入 LF-185 整合前先释放 LF-155，避免同角色重叠认领。LF-155 刻意不依赖产品任务，避免修改上游验收时连带使负责发布目录的认领失效；正常领取顺序仍优先骨架、并行协调与整合。这个持续维护任务在会话结束时写交接并 `release`，不永久 `finish`，供后续主对话继续领取。QA/生产发现缺陷时先释放受影响任务，coordinator 新增有范围的修复任务并调整下游依赖，修复后重新验收。

任务目录使用共享的已接受版本。`status.catalog.digest` 是当前版本，`local_catalog_digest` 是当前 checkout 的版本；旧 worktree 不会自动覆盖新状态。目录变动须由持有目录范围的 coordinator 显式发布：

```bash
python3 scripts/coordination.py sync-catalog --session COORDINATOR_ID --expected-digest CURRENT_DIGEST --reason "新增返工任务及重新验收依赖"
```

`CURRENT_DIGEST` 取自修改前核对的 `status.catalog.digest`；若其他对话先更新，会拒绝旧 digest。不要从落后的 worktree 把旧目录重新发布，先合并到最新目录。改变已完成任务的角色、路径、依赖或验收标准，会使该任务及依赖后继重新验收；影响活跃认领时拒绝更新，先让 owner 交接并释放。标题/说明变化也需同步发布，但不改变完成证据。

SQLite 认领库位于 Git common directory 下，不提交；脚本用事务使两个进程竞争时仅一个能获得重叠范围。没有超时自动抢锁。崩溃后由 coordinator 确认原聊天/进程停止、检查遗留差异，再使用 `recover --session COORDINATOR_ID --target-session ABANDONED_ID --reason "已核实停止及恢复依据"`。恢复只释放认领，不替原任务验收。

认领是协作约定，不能阻止绕过脚本的手工编辑。无需新付费服务，不依赖 MCP 搜索及时更新；代码文件归属查询直接走本地 registry。程序不判断验收文字是否属实，QA 与 coordinator 仍需检查证据。

## 本地安装与验证

```bash
python3 scripts/setup-workflow.py --trust
bash scripts/setup-memory.sh
python3 scripts/check-workflow.py
python3 scripts/test-coordination.py
python3 scripts/coordination.py status
bash scripts/memory.sh --version
bash scripts/memory.sh project list
bash scripts/memory-smoke.sh
```

上面的配置/检查脚本需要 Python 3.11+；如果系统 `python3` 较旧，请改用已安装的 `python3.12`。Basic Memory 安装需要 Python 3.12+；可通过 `LIVINGFORMA_PYTHON=/absolute/path/python3` 指定解释器。它使用项目内独立虚拟环境，不修改系统 Python。首次安装从 PyPI 下载固定版本 Basic Memory；实际依赖会记录在 `.local/memory-installed.txt`。索引和运行配置在 `.local/`，不入 Git。

`setup-workflow.py` 根据 `.codex/config.toml.example` 生成被 Git 忽略的本机 `.codex/config.toml`，写入绝对路径，避免 MCP 工作目录解释差异。已有非本脚本生成的配置不会被覆盖。换目录或新机器运行脚本即可重新生成。

项目级配置必须在被信任的项目中加载。`--trust` 仅把本仓库的确切路径加入用户 Codex 配置，原文件私密备份在被 Git 忽略的 `.local/config-backups/`；不改模型、sandbox 或审批设置。省略该参数时，可在 Codex 打开此仓库并信任该项目。安装后新开一个以 LivingForma 为项目的 chat，或在 MCP 设置里重新连接；当前 chat 不保证热加载新角色/工具。

## 日常流程

1. **理解**：coordinator 对照 PRD 与 `docs/product/jarvis-vision.md` 确定用户意图、当前状态和本次边界。Frontend 必读体验方向与 skills-guide；先用短分镜验证 Owner 圆圈、形态变化和访客视图，不把固定一天设计当硬性日程。
2. **分工**：coordinator 维护任务目录；各角色自动原子领取依赖已满足的任务，获取 ID、文件范围、验收标准；每批编辑前检查归属。
3. **并行**：没有依赖的任务并行；公共接口先讨论，确认后再实现。
4. **验证**：每个角色检查自己负责部分，qa 独立验证关键用户路径，coordinator 检查跨层联通。
5. **交接**：角色写自己的日记与摘要，向其他角色输出明确的接口/问题/证据。
6. **汇总**：任务有实际证据后结束认领；coordinator 更新公共决策、接口和任务板，再向用户报告可运行成果及限制。

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
- `docs/memory/handoffs/<role>/`：每份交接用任务 ID + session ID 独立命名，写入属于角色已认领的范围。
- `docs/PRD.md`：产品需求的权威文档。记忆中的摘要不能替代它。

Basic Memory 的 project 固定为 `livingforma`，索引范围只有 `docs/memory/`。角色内存是协作分区，不是安全访问隔离；所有项目 agent 可以读取公共需要的内容。

启动先搜索相关主题，例如 `search_notes(query="AppSpec", project="livingforma")`，再用 `read_note` 查看全文。创建交接时使用唯一标题和 `write_note(overwrite=false)`。MCP 不可用时直接读写同一批 Markdown，随后运行 `bash scripts/memory.sh reindex --project livingforma --search` 重新索引。

全文索引可能晚于文件写入。新笔记暂时搜不到时，先按已知路径读取，再短暂重试搜索；不要因为一次空结果重复创建同一笔记。烟雾验证允许最多十次、间隔一秒的检索尝试，并在本地报告记录实际次数。

## 恢复与并发

中断后先看 Git 状态、任务板和最近日志，确认哪个产物真实存在。不要根据旧聊天猜测成功。初始化数据库/迁移先顺序完成，再启动多个客户端。同一角色同一时间只运行一个写入任务。不要把本地 SQLite 放在网络共享盘上并发写。

代码、文档、角色定义可通过 Git 共享给队友；每台机器重新建立自己的索引。这不是自动跨机器同步服务。

## 当前边界

应用功能仍在开发前期，基础工作流安装不等于产品已经实现。方向为通用 App 持续演化，以及语音驱动、获准后观察场景的 Jarvis 体验；文字基础与语音/相机分期验收，3D 仍为 stretch。匿名可浏览，写入再 Google 登录，只有空间 Owner 有左上角编辑圆圈。Google 登录由 DevOps 主责，目标部署域名 livingforma.tech；Tiger Data 优先核查免费方案。预算为免费额度优先，任何收费行为须先得到用户确认。集成状态见 [服务职责](integrations.md)，待定细节见 [产品问题](product/open-questions.md)。
