---
title: LivingForma QA journal
type: note
permalink: livingforma/roles/qa/journal
updated: 2026-10-03
timezone: America/Vancouver
---

# QA 工作日志

## 2026-10-03 · America/Vancouver · LF-005
- Status: in-progress
- Scope: 多 agent 工作流的配置、文档与 MCP 验证。
- Planned checks: 本地链接、角色 TOML、Codex strict parser、MCP initialize/tools/read/write/search、跨进程共享。
- Results: 尚未执行；由 coordinator 填入实际运行结果或交给 qa 后追加。

## 2026-10-03 14:22 · America/Vancouver · LF-005 独立复核

- Status: verified（范围仅为开发工作流；应用尚未实现）。
- Owned files: `docs/memory/roles/qa/memory.md`、`docs/memory/roles/qa/journal.md`。

### 已完成

- 阅读 AGENTS/PRD/WORKFLOW、公共记忆、QA 原有记忆，核对工作流脚本、项目配置模板及角色 TOML。
- 运行 `python3 scripts/check-workflow.py`：exit 0，输出 `PASS: roles, ownership memory files, local links, Codex config, shell syntax, and ignored local data.`
- 运行 `codex mcp get livingforma_memory --json` 并脱敏：exit 0；项目 server 为 enabled stdio，command / args / cwd 正确，允许工具为 read_note/search_notes/write_note/edit_note/build_context/recent_activity/list_directory。
- 用环境包元数据核对 Python 3.12.14 / Basic Memory 0.23.2 / FastMCP 4.0.0b1 / MCP 2.3.0；核对隔离 Basic Memory 配置的关闭选项与 local 项目目录。
- 运行 `git check-ignore`，确认 smoke 报告/日志、配置备份、索引配置及机器专属 Codex 配置被忽略。
- 结构化比较用户 Codex 配置与私密备份，输出布尔核对结果；未输出配置正文、模型设置或其他用户配置内容。

### 已核实的现有执行证据

- `.local/memory-smoke-report.json` 时间为 2026-10-03T21:20:11Z，即 Vancouver 14:20:11；success 和 cleanup_reindex_ok 均为 true。
- 审阅 smoke 源码后确认报告的六项检查确实对应：真实 MCP initialize/工具发现、两个独立进程对不同笔记并发写入、跨客户端互读、文本检索、新进程重启后读取持久内容、读取已有 shared context。
- smoke 日志关键错误/警告文本搜索无匹配。按 coordinator 要求没有重跑 smoke，避免无新原因重复测试。
- 用户配置只新增本仓库确切项目路径的 trusted 状态；其他项目与顶层设置相等，备份权限 0600。

### 结论与限制

- 本轮未发现阻塞当前工作流的错误；可把 LF-005 的脚本/配置与上述 MCP 证据范围交给 coordinator 标记 verified。
- named roles / MCP 是否在当前或新 Codex chat 中实际加载仍需界面/会话确认；CLI 成功不能当作热加载证据。
- 不同文件并发和重启持久化已由现有报告覆盖；同文件并发覆盖、全部工具行为、跨机器共享及产品端功能不在本轮证明范围。
- 依赖 freeze 为当前安装证据，不是完整可重现锁；当前 requirements 固定 Basic Memory，升级或新机器安装时仍需核对间接依赖。
- 仅修改分配的两个 QA 文件；无其他修复、外部服务调用、commit 或 push。

### 下一步 / 共享事实提案

- coordinator 记录安装版本、真实 stdio smoke 成功、精确项目信任范围和新 chat 加载限制。
- 新 LivingForma chat 验证角色/工具加载后，再由 coordinator 单独授权产品实现和产品 QA 验收。

## 2026-10-03 14:23 · America/Vancouver · LF-005 新环境验证等待

- Status: in-progress，supersedes 14:22 中对当前完整工作流的 verified 状态；历史检查结果仍有效。
- coordinator 报告已将六项不必要的预发布间接依赖替换为稳定解析版本，并重新运行 smoke；即时搜索未找到新笔记，正在调查索引延迟和补充有界重试。
- QA 没有重跑 smoke。独立读取当前 `.local/memory-smoke-report.json`：运行开始于 14:21:58，success=false、cleanup_reindex_ok=true，仅前三项通过，错误为 ExceptionGroup。
- QA 运行 `.local/memory-venv/bin/python -m pip check`：exit 0，`No broken requirements found.`。包元数据仍为 Basic Memory 0.23.2 / FastMCP 4.0.0b1 / MCP 2.3.0。
- 当前限制：根因与修复尚未核实；此前全链路通过报告不能作为新环境最终结果。等待 coordinator 通知完成后复核新脚本、报告和证据，再更新 QA 状态。

## 2026-10-03 14:24 · America/Vancouver · LF-005 最终证据复核

- Status: verified（开发工作流范围），supersedes 14:23 的等待状态；没有新增产品验收结论。
- 读取最终 `.local/memory-smoke-report.json`：2026-10-03T21:23:03Z，六项实际检查均通过，success=true、search_attempts=1、cleanup_reindex_ok=true。
- 阅读变更后的 smoke 源码：检索有界为十次、每次空结果后等待一秒；超限仍抛出失败并保存检索结果。没有通过忽略 assertion 或无限重试掩盖失败。本次实际首个搜索就命中；并未实际触发所有重试路径。
- 阅读 AGENTS / WORKFLOW 新增恢复约定：用已知路径确认文件已写入，搜索短暂重试，不能因为空结果重复创建笔记。
- 阅读 memory.sh 与已安装 FastMCP settings.py：FASTMCP_CHECK_FOR_UPDATES=off、FASTMCP_SHOW_SERVER_BANNER=false 字段名和类型受当前版本支持。此项为设置核对，不是网络抓包审计。
- 查看当前依赖元数据：仍有 fastmcp / fastmcp-slim 4.0.0b1、logfire-sdk 6.0.0b7、opentelemetry-semantic-conventions / opentelemetry-instrumentation 0.65b0；不声称所有依赖为稳定版。14:23 已独立运行的 pip check 为 clean。
- 无新阻塞发现；按要求未重复 smoke 或其他已通过测试。最后修改仍只有 QA memory/journal，无 commit/push。
- 交接：coordinator 可按最终证据完成 LF-005。剩余边界是新 Codex chat 工具/角色加载、同文件并发和产品功能，需对应后续任务验证。


## 2026-10-03 16:12 · America/Vancouver · LF-146 独立应用基础回归

- Status: verified early-review deliverable, with one open frontend defect; not final product acceptance.
- Session: 50ae5acd-5331-41d4-8b35-1caa548282c1。保留既有未提交修改；只写tests/e2e、docs/qa、本角色日志/记忆/独立handoff，编辑批次check通过。
- 新增可重跑 `tests/e2e/foundation.ts`，隔离真实Fastify HTTP + PGlite内存DB + Agent local-rules，Chrome三个独立上下文；当前webdist生产资源实际渲染，无API拦截。未读取秘密、未调用云或收费API。
- 三轮实际执行：首轮12pass/3fail中一项为QA选择器仅支持cards；修正为稳定record ID后第二轮12pass/2真实fail；Backend修projection并补新建空间/工具prompt边界后第三轮15pass/1fail。报告保留历史，没有把失误算产品缺陷。
- 通过：英文、local Owner/Participant/Anonymous权限、Origin/CSRF、创建更新删除和刷新、实际SSE、实际local-rules加rating/list/rose同时保留data/draft/URL、习惯checkin日期、offline/reconnect、Participant创建自己空间获得Owner、logout旧session无效、无browser pageerror。
- QA-146-01：全private字段或零可见components投影违反frontend min1校验，实际Chrome显示Zod。Backend当前LF122修为安全空公开视图；QA已独立验证anonymous/participant无records且Owner定义不变。
- QA-146-02：mobile 390px document.scrollWidth=411，rating的sr-only input越界。实际截图和DOM尺寸证据已交root；由LF150合规scope修复，QA不改product文件。最新脚本exit1保留此缺陷。
- `git diff --check`通过。证据docs/qa/foundation-report.md、JSON与PNG；没有commit/push。
- 后续：重建webdist后复跑mobile；LF160继续真实Google/Gemini/tool/voice/camera/production验收，不把local identity或local-rules称真实Google/Gemini。


## 2026-10-03 16:15 · America/Vancouver · LF-147 修复后独立复验

- Status: verified。新session117d3109-4e43-4ca9-b3c1-6536e0050d1b自动next领取LF147；仅QAscope写入，check通过，既有修改保留。
- 读取当前CSS修复：rating container relative，`.field input.sr-only`明确1×1px/0padding/left0/top0；body min-width320。QA未修改产品代码。
- 扩展foundation.ts的reduced-motion rating检测至320/390/430px并检查隐藏input实际几何尺寸，保留LF146最后失败报告及before截图。
- 执行 `pnpm exec tsx tests/e2e/foundation.ts`，18项全部通过、exit0；真实隔离HTTP/PGlite/local-rules和三个Chrome上下文。document.scrollWidth严格等于320/390/430；overflow空；hidden input1×1px/0padding。
- 视觉检查mobile-rating-320.png；更新docs/qa/foundation-report.md、foundation-results.json、各尺寸截图与mobile-dimensions.json。公开projection及既有权限/CRUD/SSE/实际变形回归继续通过。
- 结论QA-146-01/02均关闭。本次无未修foundation缺陷；真实OAuth/provider/voice/camera/production仍由LF160/170验证，不能由本地结果替代。
- 自己服务/浏览器/内存DB已由finally清理，未关闭root开发或integration服务。`git diff --check`通过；未commit/push。

## 2026-10-03 17:06 · America/Vancouver · LF-160 最终独立验收

- Status: verified，范围为上线前 MVP 实现验收；不提前完成 LF-170 生产部署。
- 恢复 AGENTS/PRD/shared/ownrole/ownership/integrations/catalog 与各角色最终证据；新 session `e0fc0cdc-6791-469f-8976-5af922c6083a` 在 LF185 finish 后原子 next 领取 LF160。此前只读检查未越过依赖写文件。
- 独立 gh read-only 获取 run37163223781 状态与精选日志：exact current source `7efaa919361be0165f8bc0bf20852f0c0e2b37b6`、success，100/100 tests、11 files、TypeScript、web/API build通过。未重复通过的全套测试或provider请求。
- 审核LF150真实GoogleOwner/Gemini/Pi/Neon/OpenLibrary、LF181真实STT/vision/TTS、LF185语音/配额停止/相机成功及Docker证据，逐项对照源码harness断言。视觉查看实际camera screenshot，英文caption/control和habit记录仍可见；画面内“delete records”是刻意的不可信测试文字，无应用权限。
- 14项数据/日志/source一致性检查实际运行通过，包括18项foundation均pass、habit record跨LF150→quota→camera完全相等、schema/v2相等、quota失败ledger不变、成功playing/Stop/visitor隔离、临时session删除、新日Gemini与Eleven固定period分离、CIcommit一致。保存artifact SHA256以便追踪。
- 记录此前只读独立repro闭环：late proposal logout后由200/v2变401/v1/noOwnerSnapshot；tool lookup并发窗口由external2/audit1变external1/audit1；includeSpeech false的真实hostroute fixtureadapter speechCalls0/noaudio。保留PGlite/deferredfixtures范围，coordinator已将9项revocation与media断言加入正式CI。
- 记录QA先前实际Docker匿名Chrome两深链：英文JS/CSS/SSE完整，0资源/CSP/pageerror、无orb/overflow。最终image后端idleerror修复由Docker HTTP和CI证据覆盖，不能误称该backend改动后又跑过同一浏览器。
- 产品门槛全部通过。证据准确区分：真实Google另证；媒体用temporarytestsession+virtualdevices；frontend lifecycle全部APIfixtures；语音旧wait超时仍failed、随后durablev2证明完成，且camera指令是草稿中增加的文字。物理设备/其他浏览器、publicdomain/生产Google仍未证明。
- 修改 docs/qa/LF-160-acceptance.md、LF-160-evidence.json、自己的memory/journal、唯一handoff；不改产品/shared，不调用provider，不重置额度，不收费，不commit/push。下一步是coordinator更新shared，DevOps领取LF170完成实际发布与域名验收。

## 2026-10-03 17:52 · America/Vancouver · LF-211 session recovery 独立回归

- Status: verified；session `f71ec8b2-0694-46f8-8686-7cc559e826a1` 自动 next 领取 LF211，保留既有修改，每批 scope check通过。工作仅 release-fix checkout；Frontend LF210独占产品src，QA未写产品文件。
- 新增 `tests/e2e/session-recovery.ts`，localhost4327真实HTTP/PGlite/Chrome，多独立context/localOwner/Participant。每场景独立API实例保留产品限流，fixture media/tool和实际local-rules planner，选择性延迟真实响应。没有绕过API的auth/CSRF/persistence。
- 最终00:49:30UTC执行 `pnpm exec tsx tests/e2e/session-recovery.ts` exit0，15/15pass，无JSerror，测试最终bundle `index-DE19SV4l.js`。serverPOST计数验证同owner一次、changedidentity零次、真实CSRF403没有自动replay；显式retry200。覆盖跨页/跨账户迟到proposal/create/tool/identity、private404、camera停止不播音、Participantbook/habit、两类logout及并发session读乱序。
- 历史首轮7pass后setup/429：测试集中复用一个限流器，改每场景API实例解决，未改产品配置。第二轮13pass+初始OwnerOrb等待超时，未进入stale logout正文；最终frontend refinement及9sec有界setup后15通过。保留旧JSON，不把未归因setup超时当产品缺陷。
- 最终只读审阅 centralguard所有write入口、force/intent/page revisions、pendingpreflight及旧session读隔离、draftmigration/storage异常、media原token清理。12guard+5media由Frontend执行通过，独立Browser15为QA实际结果；无开放热修阻断。
- Scoped strict TypeScript发现QA脚本cleanup的api definite-assignment类型问题，补编译期assertion并移除unused import后exit0；不改变已测试runtime。新增report/sourcefingerprint/media结果、role记忆与唯一handoff。最终diff/link/evidence检查后finish/close；不commit/push。
- 交接：root全pnpmcheck、整合/部署，DevOps线上真实Google跨tab轮换与生产验收。本地测试不替代Google/physicalmedia/hostedprovider；没有provider调用、秘密读取、quota改写或收费。


## 2026-10-03 17:55 · America/Vancouver · LF-211 最终补测与缺陷关闭

- Coordinator要求追加同user/同CSRF private membership撤销，LF211保持active未提前finish。真实PGlite member移除→snapshot404，初版 `index-BDe--QL3.js` 清除了private内容，但focus刷新catch留下无限skeleton。QA额外error/Reconnect断言实际失败，保存JSON及PNG，通知Frontend修复。
- Frontend在current snapshot401/403/404分支补error/loadingfalse/offline，并校验identity revision、page scope、slug三者。QA只读复核后，对最新 `index-Bt_tUXM1.js`完整重跑全部16场景：00:54:55UTC exit0、16/16pass、browserJSerrors0。原15和新会员撤权case均通过。
- 视觉查看 `membership-revocation.png`，英文A little pause/This space does not exist or is not accessible/ Reconnect均显示，无旧private值。更新最终report/handoff/sourcehash；保留中间15pass、初次404加载失败JSON和截图，不覆盖历史。
- 独立strict TypeScript testscript检查再次exit0；最终JSON/hash/link/whitespace与端口清理核对后finishclose。无开放的session热修缺陷；线上Google/部署仍由root/DevOps验证。

## 2026-10-03 17:35 America/Vancouver — LF-204 module expansion acceptance

Session `440496ff-3b82-495f-8bf4-641aee81b0f5` atomically claimed LF-204 after LF199/LF203. Restored QA/shared/project context and live catalog; preserved concurrent team changes. Every edit batch checked for scope; wrote only tests/e2e, docs/qa/module-expansion and own notes.

Created four standalone Chromium scripts. Full60×5geometry matrix300/300 passed with exactdocumentwidth at320,390,768,1440 and3column318pxdesktopcontainers. After coordinator fixes, affected10modules×2conditions20/20 passed. Actual first16analytics/input behaviors and localOwner testlogin/create/add/config/drag/save/reload/anonymousSSE/recordwrite/login guard/stale-layoutconflict passed22/22. New reviewregressions passed11/11, including held actualHTTP presentation request and realPGlite concurrent record updates. Fourlegacyvariant CSS checks atmobile/narrowdesktop passed8/8. Scope is localgallerysamples plus real isolated PGlite, notproviderverification.

Early harness runs needed corrected relative modal locators, accessible names after coordinator label changes, and tsx named-function support for DOM callbacks. Reported apparent hero overflow369at320 immediately after viewportchange, then independently found no escapedelement, fresh320fit and settledwidth320within500ms; informed coordinator to avoid an unnecessary patch, boundedpoll finalpassed. No confirmed product defects remain open. Coordinator's six code-review findings were subsequently independently checked and pass.

Saved machine JSON, realpersisted component evidence and screenshots. Visually inspected mobile detailhero, narrowcalendar, anonymouspersistedmobile and analytics/planninggallery screenshots. Scoped TypeScript for all4QA scripts and diff/linkchecks passed. No productsource changed, no cloud/provider/paid/deployment/commit/push. Testbrowserprocesses closed; coordinator localserver left intact. Final acceptance report and uniquehandoff written for integration release.

### 2026-10-03 17:40 America/Vancouver — supplemental actual capability shells

Added fifth QA script to start separate local4319 PGlite with actual CameraScene and enabled ToolResult, explicit metadata adapters, and throwing provider/invoke methods. No device start or tool invocation. Initial320 camera icon collapsed0px; coordinator fix exposed aspect-ratio minimum-width expansion363px documentwidth. Reported both; final coordinator CSS independently retested4/4, exit0. Preview234×240 at320 and260×240 at1440 narrow, icon34px, text/controls contained, exact viewport documentwidths; media starts/provider/tool calls/pageerrors all0. Visually inspected actual-camera-320. Scoped TypeScript all5scripts passed. Temporarybrowser/server closed. Updated report/memory/uniquehandoff; no productcode edits or outstanding discovered defects.
# 2026-10-04 00:23 America/Vancouver · LF-223 independent ordinary generation gate

- Status: verified local implementation, real model/new hosted release remain pending separate coordinator gates. Session78389b52-ff39-48a0-9ffc-2ade937f3f37 initially waited read-only for LF224/225; next atomically claimed07:02:36UTC. Catalog17→18→19 accepted by coordinator while task fields unchanged. Each edited path check passed.
- Added tests/e2e/generated-sites.ts and generated-tools.ts; docs/qa/generated-sites and generated-tools reports/screenshots; uniqueLF223 handoff and ownQA memory. All prior module/source/role changes preserved, no application edits.
- Actual Chrome→real generation HTTP/SSE/PGlite/opaque frame/MessageChannel/assets/QuickJS:8/8, errors0. Three custom interactions photo pointerdrag/search+recordwrites/backendcalculator; true fixture outline/source events visibly morph UI; tested explicit publication/reuse, data/asset/URL preservation and anonymous no-reload SSE. Preview read-only, private state absent, anonymous login zero toolPOST, one failed-source repair leaves live intact.
- Rotated same-ownerCSRF actualsave exactly1POST; newframe shows persisted record. Completed realtool response delayed only in local transport, then Participant change discards oldresult; Ownerorb gone, nextParticipant tool action zeroPOST. Readingtime source computes969min/5books from actual scoped progress; exactdigest/source reuse passes.
- HTTP→realQuickJS/disk restart11/11: fixtures fail honestly, immutable v1/v2 source, distinct16.9/17.4 outputs, role/origin/CSRF/input/binding, source-free discovery, privatefield rejection, durable completedreplay/audit and interruptedpendingfixture, disable/logout.
- Independent existing ordinary suites28/28 (generated12/bridge11/progress5), scoped strictTS/diffcheck pass. Opened representative mobileformation/photo/calculator and desktopsearch. 390/1440 nohorizontaloverflow; onepixelraster is storagefixture. FinalChrome run uses maxConcurrent1; LF229/freeDocker rework remains upstream evidence.
- Historical harnessfailure files preserved: target nativeimage drag switched to actualcardtextdrag, emptytoolBindings key assertion fixed to emptyarray, rotatedsession status assertion fixed to authoritative savedlist. No productfix hidden by tests. ExistingLF220 defensive evidence reviewed; no advancedPoC added/rerun.
- No.env/provider/Neon/production request, budgetchange, newcharge, commit/push/deploy. RootLF227/228 owns realprovidercompatibility/threeprompts/publicrelease. Report and handoff link concrete evidence; do not claim localfixtures prove live AI generation.

## 2026-10-04 00:34 America/Vancouver · LF-223 final phone interaction and release boundary

- Final Chrome 8/8 rerun adds actual 390px photo selection via keyboard, search filtering and Owner QuickJS calculator invocation; all three types also interact at1440. Actual guest calls now four: desktop, phone, reused page, and the completed response deliberately delayed before account change. No physical touch-device claim.
- Final source TypeScript, doc artifact references and whitespace are checked separately. Representative Owner phone calculator screenshot added; final reports supersede prior harness diagnostics.
- Backend LF229 reports local runtime6/API10 passed, but constrained free Docker cold fixture/invocation still time out after worker-size reduction. Read its actual performance report. This is an unresolved deployment blocker, not covered by successful local QA. Coordinator/Backend must clear it and real provider compatibility before new public release.

## 2026-10-04 02:23 America/Vancouver — LF-238 ordinary generated form acceptance

- Status: verified local implementation gate. Fresh22c6712b-c2bc-4afd-b400-cbaabf2062ce restored AGENTS/PRD/shared/ownrole/catalog and prepared read-only; next initially returned LF237dependency pending. Only after Backendfinishclosed did next atomically claimLF238, catalog26. Every edit batch pathchecked, concurrent Root/Backend/DevOpschanges preserved.
- Added docs/qa/generated-forms/acceptance.mts and original publicproposal JSON fixture extracted from actualDevOpschecked/publishedjob metadata. Onlypublicentity/browser/tool copied, noledgers/auth/privatebaseline. ExactHTML/CSS/JS sourcehashes fixed tooriginal; exacttoolsource/spec/testsequality checkedbefore/afterpub/reload. No generatedsourcefix or modelcall.
- Actual installedChrome→Host HTTP/diskPGlite/SSE/servedopaqueiframe/MessageChannel/QuickJS **7/7 passed exit0/pageerrors0** at09:23:02UTC. LocalOwner/Participant explicitlytestauth, offline candidate replay1call. Actual original guestfixtures225/300 rerun beforeOwnerpub; previewtoolPOST0. RealCalculateclick150/4/6→225 exactly1toolPOST; Save1actionPOST/noextratoolsubmit→persistedFlour225; anonymousSSEdisplayedrow. RealinputEnter160/4/6→240(nonfixtureinput) exactly1POST. Reloadretainsrecord/source/URL; Owner/anon390widthcontained.
- Thirdrealtool170/4/6→255 completedserver resultdelayed onlylocaltransport; Participantchange discardsoldresult/removesorb andnextCalculate0POST; recordunmodified. SeparateofflineDOMfixture verifiesnestedclick/default/external/nullsubmitter, constraints/disabled/typebutton/cancel/textarea/multipleinputs/no navigation. HostCSP/sandbox unchanged; noadvancedresearch/tests.
- ScriptstrictTypeScript exit0. Desktoprow225 and Owner/anonymousphone plusDOMscreenshots visuallyinspected; phoneviewportcapturesmaykeep savedrowbelowfold. OriginalmodelUXlimitations recorded: genericPublishrequiredfornonOwner andSave reenabledbutemptystatehandlerreturnswithoutwrite. No productfix requiredforthisscope.
- ChangedownQA docs/memory/journal/handoff only. No.env/credential/provider/Neon/productionmutation/quota/newcharge/commit/push/deploy. Own4351/4352/browsercontexts/tempDBcleaned, Rootservices untouched. Rootfull312tests/typecheck/build evidence not duplicated. Final artifact/link/whitespacechecks thenfinish/close; Rootreview/CI and DevOpscanonical225/save remainrequired.
