---
title: LivingForma task board
type: note
permalink: livingforma/shared/task-board
---

# 任务板

## 当前状态 · 2026-10-04 01:00 America/Vancouver · catalog23

Coordinator27d9cbd8持有LF155。初版eedd1d4已在livingforma.tech，60模块/通用生成仍本地。高级绕过研究暂停，正常开发继续。实时认领以registry为准。

| Task | State | Evidence / next |
| --- | --- | --- |
| LF220/221/222/224/225/226 | verified / closed | 原创页面/工具、持久jobs/assets/history、QuickJS、Studio/真实checkpointUI实现交接 |
| LF223 | verified / closed | 普通独立QA：8/8Chrome、11/11HTTP/QuickJS/restart、28/28回归，生成器fixture |
| LF229 | verified / closed | 独立FreeDocker6/6；1Worker，启动8s/执行4s/总计12s，保留失败证据 |
| LF230 | verified / closed | 请求兼容修复；122+32测试，Root真实候选/IAB启动通过，交互另验 |
| LF232 | claimed frontend01a65ac6 | Owner功能反馈通过原单次修复；本地浏览器4/4，最后样式/取消复验 |
| LF233 | awaits LF232 | Coordinator整合远程403热修复历史，保留所有当前源/角色历史 |
| LF227 | waits LF232/233 | 真实三类页面、原创工具/复用、数据/URL/访客同步、全检查/CI |
| LF228 | waits LF227 | reviewedCI-green exactSHA，原FreeRender/Neon/Google上线验收 |

Root实际PhotoDrift候选已checked但上传双选择需修复；未发布。原Neonledger18后Root一次请求，预计19/30，后续先核对，不退款或重置。


## 本轮开发补充任务

- LF-122（Backend，verified）：已完成LF120之上的工具审批桥接；pending ToolSpec不提前发布，Owner显式enable后重新规划绑定。LF150新增此依赖。
- LF-146（QA，verified report：15/16通过，mobile待修）：早期本地/英文/权限/连续性独立回归，保留LF160真实多模态及最终验收标准。
- 当前catalog revision10（digest 6a2ee3a5…），Google真实roundtrip由DevOps已执行，私密凭据在ignored .env；未上线。

LF-147 独立复验18/18通过：公开投影与320/390/430px rating溢出均修复。catalog revision11（digest7c835706…）。LF150真实云服务整合完成；语音/相机与正式部署尚未完成。


LF-148（DevOps，verified）：生产配置与私密环境已对齐实际 gemini-3.5-flash-lite、真实规划模式、server-only speech 配置；18 项只读发布预检通过。Catalog revision12，digest dd37a964…。Gemini 2026-10-03 UTC 用量30/30，STT5/60秒、TTS153/1000字符，禁止重置额度。Render 条款确认仍待用户回答，尚未部署。

LF185 独立只读 QA 发现并复现等待中的 proposal 可在 logout 后发布，已由 coordinator 修复并通过独立复验；补充工具并发窗口和 includeSpeech=false 复验通过。完整 release QA160 尚未开始，不把这些局部证据标成最终验收。

2026-10-03 16:50 America/Vancouver：最终 pnpm check 100/100、TypeScript、web/API生产构建通过；新增pg空闲连接断开故障处理及回归。QA独立访问生产Docker中两个匿名深链，资源/CSP/SSE/英文UI均通过，无Owner控制、JS错误或横向溢出。实际camera成功链路仍待UTC日切；正式QA160与发布170尚未完成。


## 2026-10-03 · 可调模块扩展（catalog revision14）

用户另一个聊天的50–100模块请求已协调接管，采用60类型/每页24实例。只读生产部署仍由DevOps170在固定7efaa91独立验收；本轮开发使用独立PGlite/local模式，不写云数据库。

| ID | Owner | Status | Evidence / next |
| --- | --- | --- | --- |
| LF-199 | coordinator | verified | 60 manifests及受限size/config/presentation契约；11 contracts tests；[handoff](../handoffs/coordinator/LF-199-5731fe24.md) |
| LF-200 | coordinator | verified | 60注册与通用编辑/展厅；170tests/typecheck/build；300响应式+22交互+11回归+4实际能力面板，见LF200 handoff |
| LF-201 | frontend | verified | 16collection/planning/goals模块；48SSR与48React布局、10组行为；独立handoff |
| LF-202 | agent | verified | 16study/tools/discovery/reading模块，60manifest planner与48offline组合；79单测/49浏览器检查 |
| LF-203 | backend | verified | Owner presentation保存/replay/version/SSE/publicprojection；35针对性测试及disk重开 |
| LF-204 | qa | verified | 300布局、22交互/持久化、11回归、20重测、8变体、4实际camera/tool面板均通过；见QA acceptance |

LF155维护槽当前available。模块任务交付完成，root session5731fe24与QA session440496ff正在finish/close；以实时registry为准。后续生产403热修复由原部署chat接管协调，不混入60模块。


## 2026-10-03 17:44 · Production repair and next generation experience

Coordinator27d9cbd8 holdsLF155, catalog15. LF210 frontend andLF211 QA implement/test isolated session recovery on3325718; LF170 released incomplete with both repair gates before redeploy. Public livingforma.tech HTTPS/Google and two-book persistence/SSE now verified. New user request for freedom/live generation uses swipeable photos as acceptance; design/contract work pending after the repair, without losing60-module primary checkout changes. See [current handoff](../handoffs/coordinator/LF-155-session-recovery-27d9cbd8.md).


## 2026-10-03 18:03 · General generation and production hotfix (catalog16)

- LF155: coordinator27d9cbd8 active. User confirmed all new frontend/backend generation work in this chat. Accepted contract [generated-sites](../../product/generated-sites.md).
- LF210/211: completed; isolated eedd1d4 hotfix112tests/typecheck/build, final independent16/16browser checks. CI37166475387 success. Prior15-check source evidence remains historical.
- LF170: reclaimed after repair gates. ExactSHA Render deploydep-db0q9nvavr4c738sqtqg nowLive; freshbundle/Google rotation/actualprompt hosted gates underway.
- LF220: backend951d4f9f active. Durablejobs/versionhistory/assets/frame/CRUDbridgehost.
- LF221: agent general Pi source generation available, waiting concurrency slot.
- LF222: frontend24abd2ef active. Sessionhotfix merged into primary, studio/progress/source/preview/bridge/default generation path.
- LF223: independentQA awaits implementation dependencies. Generalgeneration not deployed. Root detected nested srcdoc fresh-realm RTC gap in initialbootstrap; repair and adversarial acceptance required.

Primary60modules remain preserved; newgeneralrelease needs integrated reviewed source/CI/explicit exactSHA deploy under existinguserauthorization. Currenthotfix deploy contains no60modules ornewgenerator.
