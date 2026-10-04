# LivingForma 前端运行时方案

状态：候选设计 · 2026-10-03。当前仓库尚无前端实现。本文保留与 [后端架构提案](../architecture.md) 对齐的候选命名，同时记录用户较新的 Jarvis 式体验决定；**共享类型、公开访问、组件扩展和框架尚未定稿，也没有已实现 API**。产品范围以 coordinator 修订的 [PRD](../PRD.md) 为准；具体体验见 [体验方向](experience-direction.md)。

## 目标

公开空间允许访客无需登录先浏览网站；写入业务记录时才引导 Google 登录，并由服务端验证该空间的实际权限。MVP **只有该空间 Owner** 可用角落 orb 通过文字或语音提出改造需求；“admin”在本轮只是这个 Owner 的别称，不另设可委派管理员角色。受限组件运行时呈现不同类别的轻量 App，支持增量修改布局、字段、交互与视觉语法，已有记录和空间 URL 跨版本保留。读书、习惯、预算、任务、轻量 CRM、签到或投票是同一运行时的配置实例，而不是为每个类别手写页面。

通用性有明确边界：前端只渲染已注册组件与受支持的动作，不解析模型输出的任意 JSX、HTML、脚本或 CSS。前端也不执行 ToolSpec；外部工具由服务端受控运行。

产品的主要可玩性来自可信组件的组合与连续变形，并与后端 Pi 的受控工具创建/复用相接。前端先按用户场景建设可复用的交互部件；Agent 从注册目录选取适配的组件、布局和能力，不直接生成可执行 UI 代码。组件目录不是几张固定业务模板，也不应长期停留在通用 CRUD 表单。

## 1. 定义包、实体 schema 与组件注册表

后端架构现提出按 `phase` 区分候选快照：公共上下文含 spaceId、role、permissions、stateVersion、eventCursor；`phase: "ready"` 才含 definition 与 records，definition 内含 definitionVersion、entitySchema、appSpec、actions 与 toolRefs，entitySchema 内含 schemaVersion。**首次发布前**是 `phase: "unconfigured"`、`definition: null`、空 records；初始提案拟以 `baseDefinitionVersion: 0` 发布 v1。这仍待 coordinator 在共享契约中接受，前端不能在未配置时解引用 definition。AppSpec 描述页面与组件，不嵌入业务记录；records 按稳定的 entity ID、field ID、record ID 存取。展示标签变化不能改变字段身份。

原 `form / list / cards / counter` 是架构草案的**起步目录，不是长期上限**。用户已接受规划 `cards` 的 `cover / compact / hero`、`list` 的 `dense / comfortable`、受限强调规则、`calendar-grid` 与约 4–6 套枚举皮肤 token；具体名称、字段和回退行为待 coordinator 接受共享契约，Planner 不能在接受前视其为已支持。首版 `cover` 建议以稳定标题、色彩 token 和排版生成确定性文字封面，缺标题时有可读回退；真实外部书封面图片需要后续受控资源/字段 schema，不是 v1 的必要条件。标题来自 AppSpec 与 page 的 title 元数据；说明文案所需的 page metadata 仍需协商。筛选/排序是受限属性，表单提交控件属于 form 内部；独立 button、badge、detail 等若要加入，须先注册和验证，不能默认为首版能力。

版本化组件 manifest 应说明适用场景、数据/字段绑定、允许的动作、变体与布局限制、权限、空/错/加载状态、动效稳定身份以及可访问性/移动端回退。Frontend 对多个场景主动设计和验证组件，Agent 只可选择已注册版本进行拼装；具体 manifest shape 待 LF-100 跨角色接受。

Renderer 的输入应是服务端已校验、处于 `phase: "ready"` 的完整快照；未配置空间向 Owner 显示创建入口，访客仅得到未发布提示，不向通用 Renderer 传空定义或泄露草稿。前端再次解析候选定义格式，避免旧版本或网络损坏造成崩溃。未知 kind、字段引用或动作引用应显示安全错误，不回退到通用 HTML 注入。按组件稳定 ID 生成 React key，并用该 ID 做连续动画的身份；若将来需要独立 layout ID，须先扩展共享契约。列表项 key 使用记录 ID，不能用数组下标。

## 2. 增量变更与非破坏性绑定

Owner 首次请求产生 entitySchema + AppSpec 初版；后续请求产生基于当前 definitionVersion 的提案。前端只接收服务端发布后的完整有效快照，不直接应用未经验证的模型 patch。布局和文案变化只替换界面投影；新增字段显示默认值或空值；改标签保持 field ID；隐藏字段不等于删除旧数据。

服务端必须为字段重命名、类型变化和真正删除给出明确迁移语义。前端不能自行猜测迁移映射。无法安全映射时保留当前版本，并向 Owner 展示具体冲突。表单只提交当前 entitySchema 允许的字段；提交过程若发生定义升级，保留草稿并提示重新核对，不能悄悄丢失输入或向过期定义写入。

候选版本含义：definitionVersion 标记完整定义包发布；entitySchema.schemaVersion 标记业务 schema 变化；stateVersion 标记业务记录状态变化；eventCursor 是已提交事件的重放游标。布局变化不应伪造记录更新，记录变化也无需重新生成定义。收到序号跳跃、旧事件或互不兼容的版本时，重新请求服务端权威快照，而非靠客户端猜测合并。

## 3. 页面状态与多人同步

页面首先是生成的网站本身；空间外壳只保留必要的分享、状态与登录入口。Owner 指令入口是左上角小圆 orb，点击后放大至中心输入，提交后收回角落并显示真实高层阶段；不是固定聊天侧栏或底部建议条。Frontend 负责访客只读、写入触发登录、redirecting、resolving-session、signed-in、expired/error 等可见状态；OAuth provider 配置、回调与服务端会话由 DevOps 的 packages/auth 负责。任何已登录者不自动成为 Owner：仅服务端确认的本空间 Owner 才显示 orb。Participant 和访客看不到发布定义或工具配置入口。候选快照的 role 和 permissions 只用于决定显示什么；真正权限在每次写入、发布和 SSE 访问时由服务端验证。**可执行的**业务动作须同时被 AppSpec 引用且列在当前主体的 permissions.actionIds 中；工具控件亦须与 permissions.toolRefs 相交。匿名访客可以看到独立的“登录后添加/修改”提示入口，它不是可执行 action，也不增加 actionIds、不得发送匿名 mutation；登录回来仍需重新取得权限并复核草稿。权限缺失默认为不可执行。

候选启动流程：访问公开且已配置的空间时 GET 经服务端裁剪的访客 snapshot → 渲染 definition.appSpec 与公开 records；访客点登录提示入口时保存本地草稿/返回位置，再进入 Google 登录和会话解析，重新取得当前主体的权限快照后才可尝试业务动作。Owner 新建的未配置空间走独立创建态；初版发布后再进入 Renderer。公开快照的可见字段、匿名订阅和缓存键尚待 Backend/DevOps 契约决定。已获授权的客户端以 snapshot.eventCursor 订阅 `events?after=`；收到定义发布或业务事件后拉取权威快照。并发拉取用请求序号加版本/游标只让最新**有效**快照进入呈现层，过期响应不覆盖新画面；版本维度不可比较则重拉。此规则不能取消或遗漏业务 mutation 的服务端回执、错误与用户草稿，它们按 requestId 独立追踪。断线重连先拉 snapshot，再从其 eventCursor 订阅。身份/权限失效时撤去 orb、停止本地设备采集、关闭该用户的实时连接并重新获取访问状态；登出时清除用户范围的界面/快照缓存。带 role/permissions 的快照不可按 spaceId 跨用户共享缓存。业务 mutation 由后端确认后再视为成功；局部乐观反馈失败后须回滚并保留输入。

Owner 提交自然语言请求后，orb 收回角落；只在后端提供可信状态时显示“理解需求 / 校验变更 / 发布界面”等阶段，否则显示不确定进度。旧网站在发布前继续可用，收到成功快照才进入新版本。普通记录事件仅局部反馈，不触发整页 morph。不要展示模型内部推理、伪造精确进度或未验证的中间规格。语音/摄像头是新增的重要里程碑：本地显式开启、可停止、权限失败可退回文字；通过 Agent/Backend 调用 Gemini 视觉与 ElevenLabs 语音，浏览器不保存密钥。设备流和采集状态不随 SSE 广播，也不能由其他客户端事件远程启动。

## 4. 变形动画与可访问性

Motion 可用稳定组件 ID 做 orb 的角落↔中心转场、定义发布时的尺寸/位置过渡、淡入淡出和短暂状态提示。组件身份相同才 Morph；字段含义改变却复用旧视觉身份时应退化为清晰替换。动画不阻塞表单、业务写入或实时数据更新。检测 `prefers-reduced-motion` 后缩短或关闭位移动画，同时保留可读状态反馈。复杂时间线若需独立 GSAP，须隔离其控制节点，不与 Motion 在同一元素争夺 layout；选用依据见 [skills-guide](skills-guide.md)。

orb 展开后聚焦输入，关闭后焦点回到左上角触发按钮；展开态需有可读标题、键盘关闭与对话框焦点管理。表单必须有可见标签、错误说明和键盘可达的提交控件；状态变化用简短 `aria-live` 通知。版本发布时保留合理焦点：若原组件仍在，继续聚焦；若已移除，移至新页面标题或首个可操作元素。颜色不能单独表达状态，移动端保持可读和可点按；摄像头/麦克风运行时显示清晰停止控件。

## 5. 不支持请求与失败路径

Planner 或校验器返回 unsupported / needs-clarification 时，旧 App 原样继续工作，Owner 获得“缺少哪种字段、组件或动作”以及可选替代方案。不能把复杂需求静默缩水成无关页面，也不能把“无法表示”转成任意代码执行。新快照解析失败、网络中断、权限不足、设备权限拒绝或免费额度耗尽都有独立提示；最后一个有效版本留在屏幕上，orb 草稿/写入草稿不被错误响应抹掉。额度耗尽不触发自动付费升级。

## 6. 与后端需确认的候选接口

下表沿用 [架构提案](../architecture.md) 的**旧候选字段**，并列出新访问/体验决定带来的契约缺口；须由 coordinator 更新共享类型后才能实施。现有候选中定义提案请求使用 **baseDefinitionVersion**，业务动作使用 **definitionVersion**，并未定义名为 expectedDefinitionVersion 的请求字段。

| 需求 | 当前候选接口 / 字段 | 前端依赖 |
| --- | --- | --- |
| 访客/登录 | 公开浏览免登录；首次受保护写入才进入 Google OAuth，具体匿名快照、登录回跳和公开空间可见性契约待 DevOps/Backend 定稿 | 前端保留写入草稿与返回位置，不处理服务端凭据、不独自判断空间角色 |
| 加载空间 | 候选 GET /v1/spaces/:spaceId/snapshot；公共上下文含 role、permissions、stateVersion、eventCursor；`phase: "ready"` 含 definition{definitionVersion、entitySchema{schemaVersion}、appSpec、actions、toolRefs} 与 records；首次发布前 `phase: "unconfigured"`、`definition: null`，初始提案拟用 `baseDefinitionVersion: 0`；公开 SSE/提示元数据细节待定稿 | 只对 `ready` 分支渲染 App；Owner 创建态不解引用 definition；orb 只按服务端 Owner 身份显示，最终授权仍由 Backend 执行 |
| 生成提案 | POST /v1/spaces/:spaceId/proposals；requestId、baseDefinitionVersion、intent | 版本冲突处理、旧版本回退、用户可读的 unsupported 反馈 |
| 发布变更 | POST /v1/spaces/:spaceId/proposals/:proposalId/publish；服务端复核提案绑定的 baseDefinitionVersion | 成功后获取完整快照；409 冲突时不覆盖当前界面 |
| 业务动作 | POST /v1/spaces/:spaceId/actions；requestId、definitionVersion、actionId、可选 recordId、更新时 expectedRecordVersion、input | 服务端验证权限/字段/冲突并返回新记录及版本 |
| 实时事件 | GET /v1/spaces/:spaceId/events?after=eventCursor；事件含 ID、definitionVersion、schemaVersion、stateVersion | 重放和顺序处理；游标失效或序号不连续时重新拉快照 |
| 能力状态 | ToolSpec 创建、校验、注册、执行的高层状态；无密钥或内部推理 | 只展示 Owner 需要的真实进度，不让浏览器执行外部工具 |
| 本地设备会话 | 摄像头/麦克风由本人显式打开，Gemini 视觉和 ElevenLabs 语音通过受控服务端适配器；具体会话/媒体端点待跨角色设计 | 不将本地设备流写入公开快照或 SSE，不因远端事件自动打开设备；拒绝权限时可退回文字 |

共享类型、公开空间权限、扩展组件 schema、字段迁移规则、身份会话、Tiger Data 免费方案、媒体会话与 SSE 支持需要跨角色锁定。前端框架**推荐但未定稿**为 Vite + React + TypeScript SPA，配独立 Node API；这是向 coordinator 的 bootstrap 选型建议，不是已经实现的栈。Frontend 后续代码范围仍以认领为准，预期在 apps/web/src/ 与 apps/web/public/，登录控件在 apps/web/src/components/auth；DevOps 独占 packages/auth 核心会话模块，Backend 负责 API 路由挂载、用户映射与权限。Agent 负责 Gemini 规划器及 ElevenLabs 服务端适配器；Frontend 负责本地麦克风/摄像头/播放 UI，第三方密钥只留服务端。

建议的开发顺序是：Owner/访客/参与者分镜与 orb 状态 → 静态有效规格的 Renderer、扩展视觉语法与 morph 实验场 → 接入真实持久动作、授权和版本/事件恢复 → 语音与摄像头的本地授权及真实适配。fixture、MSW、BroadcastChannel 和 mock SSE 都必须标为模拟，不构成云端多人或真实第三方服务证据。读书与习惯由同一 Renderer 呈现，避免先写领域专用页面再伪装成生成器；以上不是固定天数承诺。
