---
title: LivingForma QA memory
type: note
permalink: livingforma/roles/qa/memory
updated: 2026-10-04
timezone: America/Vancouver
---

# QA 角色记忆

**当前 LF-238：普通生成表单修复已独立 verified，2026-10-04 02:23。** 原线上 Serving Studio HTML/CSS/JS、scale_ingredient@1 spec/source/tests原样复制为显式离线候选，独立Chrome→实际Host/PGlite/SSE/MessageChannel/QuickJS **7/7通过/pageerrors0**。真实click150/4/6→225仅1toolPOST，Save1recordPOST；匿名SSE看到保存值。Enter160/4/6→240为非原fixtures输入、1POST；reload保留source/record/URL，390px Owner/anon无溢出；迟到toolresponse换Participant被丢弃。普通constraint/disabled/typebutton/textarea/submitter通过，无导航、无sandbox/CSP扩权。脚本strictTS/diff/link检查通过，浏览器/端口/临时DB清理。见 [报告](../../../qa/generated-forms/acceptance.md) / [handoff](../../handoffs/qa/LF-238-22c6712b-c2bc-4afd-b400-cbaabf2062ce.md)。只写ownscope、没有provider/Neon/生产写入或新modelcall。已发布22f78d2的正式225/save尚待DevOps部署hostpatch后验证；不能用本地身份代替Google。下文LF223的Free冷启动阻断是历史，已由LF229后续6/6证据解除，不是本轮当前阻断。

**当前 LF-223：本地普通生成验收 verified，2026-10-04。** 独立 Chrome→实际Host/PGlite/SSE/iframe/QuickJS 8/8、HTTP工具/物理重启11/11、既有普通generated/bridge/progress28/28、QA脚本strict TypeScript/diffcheck通过。详见 [报告](../../../qa/generated-sites/acceptance.md) 和 [handoff](../../handoffs/qa/LF-223-78389b52-ff39-48a0-9ffc-2ade937f3f37.md)。生成源码/工具/轮廓明确为离线fixtures，真正的Host/数据库/Guest执行和浏览器交互不是API拦截mock；不证明真实Gemini或新版上线。当前生产仍为eedd1d4历史门槛，Root负责新真实模型/部署验收。高级绕过研究暂停，只审阅旧防御证据、执行普通功能/隐私/权限/stale/invalid-source回归。

发布限制：LF-229 constrained free Docker 的冷初始化/fixture/invocation 仍超时；Backend 的本地 runtime6/API10 通过不能替代此实际资源门槛。性能报告已读、阻断已写入 QA handoff。三类页面双宽交互及晚到账号响应均实际通过，剩余真实模型兼容性、免费容器修复与公网发布由对应任务验收。

负责独立核对事实与验收证据。先读 PRD 和任务板，再验证分配范围。当前以文末 LF-160 最终更新为准：MVP 实现验收通过，正式域名部署仍待 LF-170。以下早期工作流和应用回归记录保留历史状态。

**当前 LF-005：verified（仅为工作流范围）。** coordinator 调整依赖并为检索增加有界等待后，14:24 独立复核最终报告成功。14:22 初次成功和14:23 暂时失败都作为历史证据保留；产品应用和当前 Codex chat 热加载仍不包含在此结论中。

## 已完成

- 独立阅读 setup-workflow、setup-memory、configure-memory、memory/server/smoke 入口与 smoke Python 源码、角色 TOML、工作流文档和本地配置。
- 运行 `python3 scripts/check-workflow.py`；exit 0，角色/记忆文件、本地链接、TOML、shell 语法和本地数据忽略规则通过。
- 运行 `codex mcp get livingforma_memory --json`，仅输出脱敏后的指定项目检查结果；exit 0，CLI 能读取项目配置，stdio 的 command / args / cwd 与 7 个 enabled_tools 匹配。
- 复核 coordinator 已运行的 `.local/memory-smoke-report.json` 和对应脚本；未重复执行 smoke。
- 对用户配置及私密备份做结构化脱敏比较，核对只增加 LivingForma 确切路径的信任。

## 已核实

- 安装环境为项目内 Python 3.12.14；Basic Memory 0.23.2、FastMCP 4.0.0b1、MCP SDK 2.3.0。Basic Memory 元数据明确要求 FastMCP 4.0.0b1。
- `.local/basic-memory/config.json` 只有一个 local project，路径为本仓库 `docs/memory`；SQLite、默认项目、关闭 semantic search / auto update / Logfire / frontmatter 自动写入的设置与脚本一致。
- 初次查看的 2026-10-03 14:20:11 America/Vancouver smoke 报告为 `success=true`、`cleanup_reindex_ok=true`。这是调整依赖前的历史证据。源码确实使用独立 stdio 服务器进程，检查 initialize / 工具发现、不同笔记并发写入、互相读取、文本搜索、停止后新进程读取持久内容和已有公共背景。
- 14:23 独立复核最新报告（14:21:58 开始）为 `success=false`、`cleanup_reindex_ok=true`；只完成 initialize/工具发现、双进程不同笔记写入和互读，错误为 ExceptionGroup。coordinator 报告即时搜索未找到新笔记，正在调查索引延迟；根因和修复效果尚未独立核实。
- 14:23 运行项目环境 `python -m pip check`：exit 0，`No broken requirements found.`；这不能代替搜索与重启持久化验证。
- 14:24 读取最终报告（14:23:03 开始）：六项 checks 均通过，success=true、search_attempts=1、cleanup_reindex_ok=true。复核当前脚本后确认全文检索最多尝试十次、间隔一秒，并保留超限失败；不是无限重试或把空结果判为成功。
- AGENTS / WORKFLOW 已记录“已知路径读取、搜索短暂重试、不重复创建笔记”的恢复规则。memory.sh 新增的 FASTMCP_CHECK_FOR_UPDATES=off / FASTMCP_SHOW_SERVER_BANNER=false 与已安装 settings schema 名称和类型一致。
- smoke 日志未找到 ERROR / Traceback / RuntimeError / database is locked / WARNING 文本。此项不是网络流量或所有运行日志的审计。
- 用户配置与备份的唯一结构变化是 `/Users/fanhaocheng/project/livingforma` 项目的 `trust_level=trusted`；其他项目和顶层设置不变，备份文件权限为 0600。未打印用户配置正文。
- 运行报告、运行日志、私密配置备份、索引配置和机器专属 `.codex/config.toml` 均被 Git 忽略。
- 初次配置检查与最终 MCP 报告均无阻塞当前工作流的错误；之前的即时搜索失败已由最终实际报告和有界等待协议覆盖。只写本角色 memory/journal；未改其他文件、未 commit/push。

## 验证边界

- CLI 读取项目配置、真实 stdio 协议已执行不等于当前 Codex chat 已热加载 MCP 或所有 named roles；新 LivingForma chat / 重新连接后仍应确认工具可用。
- smoke 并发写的是不同文件，不能证明同一 Markdown 的并发修改安全。仍遵守单角色单写入、shared 文件 coordinator 单写入。
- 7 个工具通过发现检查；实际调用覆盖 write_note / read_note / search_notes，不表示 edit_note / build_context / recent_activity / list_directory 的全部行为已测。
- Basic Memory 版本固定，实际依赖 freeze 已记录；`memory-installed.txt` 是证据而非完整依赖锁，新机器解析间接依赖仍可能变化。
- 六项不必要的预发布间接依赖已由 coordinator 替换；环境仍有 FastMCP/FastMCP-slim、Logfire SDK 和部分 OpenTelemetry 的预发布版本。不能把安装环境概括为“所有包均稳定版”；版本清单与 pip check 才是具体证据。
- 未验证应用、Gemini/Pi、ElevenLabs、Tiger Data、DNS、部署或任何业务接口。没有产品“测试通过”的主张。

## 待办

1. coordinator 按最终 smoke 及独立检查更新 LF-005 状态，保留已知索引延迟和新 chat 加载限制。
2. 新项目 chat 确认 named roles 和 `livingforma_memory` 工具实际可用，使用本地 Markdown 回退路径恢复。
3. 产品实现任务另行分配后，再执行 PRD 的通用生成、非破坏演化、多人同步、权限和受控能力验收。


## 2026-10-03 16:12 · LF-146 当前状态

- 早期独立回归 deliverable 已完成；不表示最终 MVP/生产验收通过。隔离 Fastify/PGlite + 实际 local-rules + 三个 Chrome contexts 执行16项，最新 **15 pass / 1 fail**；脚本保留失败 exit1。
- 实测英文/匿名无orb/本地身份明确、Owner orb焦点草稿、CRUD刷新、两客户端SSE、Participant权限、CSRF/Origin、登出旧cookie、实际local-rules增rating与cards→list变形保留records/draft/URL、习惯日期、断线恢复、新建habit身份映射。未用model fixture证明这一变形。
- QA-146-01 已复现并由Backend修复：零公开字段或零公开组件不再返回无效Definition；公开空视图不泄漏records，Owner定义保留，独立Chrome复验通过。
- QA-146-02 尚待coordinator LF150修复：390px mobile加rating后宽411px；`.field input` 覆盖`.sr-only`尺寸，绝对定位hidden input越界。不能把本轮标成全部通过。
- 可重跑 `pnpm --filter @livingforma/web build` 后 `pnpm exec tsx tests/e2e/foundation.ts`。用4317隔离端口、内存DB，不读.env，不触碰开发/云数据库，不调用收费服务。
- 证据 [foundation report](../../../qa/foundation-report.md)、[machine results](../../../qa/foundation-results.json)。LF160仍需真实OAuth/provider/media/production证据。


## 2026-10-03 16:15 · LF-147 当前状态

- Coordinator修复rating CSS后，QA独立重跑隔离真实HTTP/PGlite/local-rules/Chrome：**18/18通过，exit0**。此结果取代LF146的15/16当前状态，历史失败仍保留。
- 320/390/430px reduced-motion viewport均无横向溢出，document.scrollWidth分别320/390/430；隐藏rating input实际1×1px、padding0px。视觉检查320px整页截图。
- 既有英文、Owner/Participant/Anonymous、CSRF、logout旧cookie、CRUD/刷新、SSE/离线、实际变形data/draft/URL保留、habit创建与checkin、空公开投影回归继续通过。
- QA-146-01/02均独立复验关闭；当前早期foundation无未修缺陷。LF160仍需真实provider和多模态最终验收，未因本地18项而提前完成。
- 只写tests/docs/ownrole；独立4317服务/内存DB/Chrome已清理，未动root5173或云服务。

## 2026-10-03 17:06 · LF-160 当前状态

- **Verified：predeployment MVP implementation gate passed**。无未关闭的已发现实现阻断；可接 LF-170。不能称 livingforma.tech、公开 HTTPS、生产 Google 回调或托管环境已验收。
- 新 session `e0fc0cdc-6791-469f-8976-5af922c6083a` 在 LF-185 正式完成后自动 next 领取；每批编辑 check 通过，只写 docs/qa 与自己的 memory/journal/handoff。保留已有修改，不 commit/push/deploy。
- [最终报告](../../../qa/LF-160-acceptance.md) / [证据 manifest](../../../qa/LF-160-evidence.json)：逐项映射独立 QA 执行、真实服务与明确 fixtures；14 项 artifact/ledger/record/source 一致性检查通过。独立读取 GitHub run37163223781：exact HEAD `7efaa919361be0165f8bc0bf20852f0c0e2b37b6` 的 100 tests / 11 files、typecheck、web/API build 均成功。
- 继承实际 LF-147 18/18 与 LF-185 只读期间独立重现实证。曾发现 logout 后 late proposal 发布，修复后同一 gated planner 复现为401/v1/无Owner snapshot；工具 registry-read 窗口双调用修复后两响应200/调用1/audit1；includeSpeech=false 实际路由 fixtureadapter 返回description而speechCalls0/noaudio。Coordinator保留9项revocation回归与media断言。
- QA 独立 Chrome 浏览生产Docker真实Neon两匿名深链：实际资源/SSE/英文UI、无orb、无溢出、无资源/CSP/pageerrors。该容器已由root停止；此证据不等于域名部署。
- 已审计真实 Google local login/refresh/logout、实际 Owner 创建两个 Gemini/Pi/Neon app、Open Library 明确审批/两次调用证据。真实媒体用合成虚拟设备与临时测试session；Google roundtrip证据另列，不互相替代。
- 语音真实STT填入sage草稿、无自动发布；之后手工补入camera文字再Apply。原15秒wait超时保留为failed，后续Neon/Owner/visitor证据确认该一次请求已发布habit v2且schema/records保留。camera全UI实调通过：vision14517ms/TTS2351ms/140896B MP3/playing1，Stop trackended/audioempty、visitor设备0/播放0，跨space/reload保留数据。
- 预算以真实自然UTC日切为准：GeminiOct4 1/30，固定period STT5/60秒/TTS316/1000字符；此前30/30失败前后ledger相同。QA本轮真实provider调用0、budget/clock修改0。
- 发布限制：待LF170实际host/domain/HTTPS/Google生产及代理SSE/secure-context媒体；物理设备和其他浏览器未由虚拟Chrome替代。仅单实例工具in-flight合并，跨实例完成结果持久replay；不声称跨实例external exactly-once。收费和Render新账户条款遵循用户确认。

## 2026-10-03 17:35 · LF-204 60-module expansion

- Verified local-development module acceptance; no confirmed open defects in tested scope. Independent Chromium matrix60×5=300 passed at320/390/768/1440 and318px desktop component width; no overflow/content escape/clipping/pageerrors. Changed-module post-fix geometry20/20 also passed.
- Gallery analytics/input behavior plus actual local HTTP/PGlite Owner add/config/drag/save/reload, anonymous SSE, numeric persistence/login guard and stale layout conflict22/22 passed. Camera/tool-result gallery placeholders are expressly excluded from new device/provider execution claims.
- Coordinator review fixes independently verified11/11: invalidbins/precision safety, leaderboard rank-before-limit, text/range switch-record drafts, concurrent real-record conflicts, controls locked during delayed real presentation, card variants. Legacy form/calendar/kanban compact and detail hero atmobile/narrowPC8/8 passed.
- [Report](../../../qa/module-expansion/acceptance.md) includes JSON, reusable4scripts, screenshots and harness limitations. Scoped QA TypeScript and diff check passed. Original transient hero369px measurement settled320 and no escaped element; bounded settled assertion passed, not an open defect.
- No provider/cloud/paid/production call, commit or push; local fixture spaces only. QA browsers closed, coordinator's local server retained. Handoff [LF-204-440496ff](../../handoffs/qa/LF-204-440496ff-3b82-495f-8bf4-641aee81b0f5.md).

### 17:40 supplemental real capability shells

- Actual idle CameraScene and enabled ToolResult at320/1440 narrow passed4/4 on separate local4319 PGlite. Explicit metadata fixtures only; media-session requests/provider/tool invokes all0. Browser and temporary server closed.
- Found collapsed camera icon, then aspect-ratio width expansion from initial fix. Coordinator final CSS independently reverified: previews234×240/260×240, icon34px, contained text/controls and exact document widths. Final screenshot visually inspected. No open defects in tested scope.
- All5 QA scripts pass scoped TypeScript; capability-shells.json and actual-camera/tool screenshots supplement the report. Gallery placeholders remain clearly distinguished from actual idle controls and provider/device execution.


Historical production403 hotfix summary preserved during LF233 Git integration: [eedd1d4 memory](../../handoffs/qa/LF-233-production-memory-eedd1d4-27d9cbd8.md). Current generated-application state above remains authoritative.
