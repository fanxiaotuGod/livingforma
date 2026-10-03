# LivingForma 前端运行时方案

状态：候选设计 · 2026-10-03。当前仓库尚无前端实现。本文与 [后端架构提案](../architecture.md) 对齐候选命名，**尚未构成已接受接口或已实现 API**；产品范围以 [PRD](../PRD.md) 为准。

## 目标

用一套受限组件运行时呈现不同类别的轻量 App，让 Owner 的自然语言请求创建初版，再增量修改布局、字段和交互。已有记录、空间 URL 和在线用户会话跨版本保留。读书、习惯、预算、任务、轻量 CRM、签到或投票是同一运行时的配置实例，而不是为每个类别手写页面。

通用性有明确边界：前端只渲染已注册组件与受支持的动作，不解析模型输出的任意 JSX、HTML、脚本或 CSS。前端也不执行 ToolSpec；外部工具由服务端受控运行。

## 1. 定义包、实体 schema 与组件注册表

后端候选 SpaceSnapshot 包含 spaceId、role、permissions、definition、stateVersion、eventCursor 和 records。definition 内含 definitionVersion、entitySchema、appSpec、actions 与 toolRefs；entitySchema 内含 schemaVersion。AppSpec 描述页面与组件，不嵌入业务记录；records 按稳定的 entity ID、field ID、record ID 存取。展示标签变化不能改变字段身份。

**MVP 候选组件目录仅为 form、list、cards、counter。** 标题来自 AppSpec 与 page 的 title 元数据；如需要说明文案，应由双方先约定可选 page metadata，不能假定后端当前候选类型已有 description 字段。筛选和排序是组件的受限配置属性，不是额外组件。表单提交控件属于 form 内部。独立的 button、badge、detail 等组件是后续扩展，不能被 Planner 当成首版已支持能力。

Renderer 的输入应是服务端已校验的完整快照；前端再次解析候选定义格式，避免旧版本或网络损坏造成崩溃。未知 kind、字段引用或动作引用应显示安全错误，不回退到通用 HTML 注入。按组件稳定 ID 生成 React key，并用该 ID 做连续动画的身份；若将来需要独立 layout ID，须先扩展共享契约。列表项 key 使用记录 ID，不能用数组下标。

## 2. 增量变更与非破坏性绑定

Owner 首次请求产生 entitySchema + AppSpec 初版；后续请求产生基于当前 definitionVersion 的提案。前端只接收服务端发布后的完整有效快照，不直接应用未经验证的模型 patch。布局和文案变化只替换界面投影；新增字段显示默认值或空值；改标签保持 field ID；隐藏字段不等于删除旧数据。

服务端必须为字段重命名、类型变化和真正删除给出明确迁移语义。前端不能自行猜测迁移映射。无法安全映射时保留当前版本，并向 Owner 展示具体冲突。表单只提交当前 entitySchema 允许的字段；提交过程若发生定义升级，保留草稿并提示重新核对，不能悄悄丢失输入或向过期定义写入。

候选版本含义：definitionVersion 标记完整定义包发布；entitySchema.schemaVersion 标记业务 schema 变化；stateVersion 标记业务记录状态变化；eventCursor 是已提交事件的重放游标。布局变化不应伪造记录更新，记录变化也无需重新生成定义。收到序号跳跃、旧事件或互不兼容的版本时，重新请求服务端权威快照，而非靠客户端猜测合并。

## 3. 页面状态与多人同步

页面可分成空间外壳（分享/权限/状态）、Owner 指令区、运行时画布和精简进度区。Participant 看不到发布定义或工具配置入口。候选快照的 role 和 permissions 来自服务端当前会话，只用于决定显示什么；真正权限在每次请求和 SSE 访问时由服务端重新验证。业务动作控件必须同时被 AppSpec 引用且列在 permissions.actionIds 中，工具控件亦须与 permissions.toolRefs 相交。权限缺失默认为不可执行。

候选启动流程：GET 空间 snapshot → 渲染 definition.appSpec 与 records → 以 snapshot.eventCursor 订阅 events?after=游标 → 收到定义发布或记录变化事件后串行拉取权威快照并原子替换。断线显示可见状态并重连；重连先拉 snapshot，再从其 eventCursor 订阅。身份/权限失效时撤去 Owner 控件并重新获取访问状态；带 role/permissions 的快照不可按 spaceId 跨用户共享缓存。业务 mutation 由后端确认后再视为成功；可有局部乐观反馈，但失败必须回滚并保留用户输入。

Owner 提交自然语言请求时显示“理解需求 / 校验变更 / 发布界面”等高层阶段。界面在发布前仍显示旧版本；收到成功响应才转入新版本。不要向用户展示模型内部推理或未验证的中间规格。

## 4. 变形动画与可访问性

Motion 可用稳定组件 ID 做尺寸/位置过渡、淡入淡出和短暂状态提示。组件身份相同才 Morph；字段含义改变却复用旧视觉身份时应退化为清晰的替换。动画不应阻塞表单和实时数据更新。检测 prefers-reduced-motion 后缩短或关闭位移动画。

表单必须有可见标签、错误说明和键盘可达的提交控件；状态变化用简短 aria-live 通知。版本发布时保留合理焦点：若原组件仍在，继续聚焦；若已移除，移至新页面标题或首个可操作元素。颜色不能单独表达状态，移动端应保持可读和可点按。

## 5. 不支持请求与失败路径

Planner 或校验器返回 unsupported / needs-clarification 时，旧 App 原样继续工作，Owner 获得“缺少哪种字段、组件或动作”以及可选替代方案。不能把复杂需求静默缩水成无关页面，也不能把“无法表示”转成任意代码执行。新快照解析失败、网络中断、权限不足或免费额度耗尽都有独立提示；最后一个有效版本留在屏幕上。额度耗尽不触发自动付费升级。

## 6. 与后端需确认的候选接口

下表逐项采用 [架构提案](../architecture.md) 当前字段；仍须由 coordinator 在共享接口文件中接受后才能实施。架构当前定义提案请求使用 **baseDefinitionVersion**，业务动作使用 **definitionVersion**，并未定义名为 expectedDefinitionVersion 的请求字段。

| 需求 | 当前候选接口 / 字段 | 前端依赖 |
| --- | --- | --- |
| 加载空间 | GET /v1/spaces/:spaceId/snapshot；spaceId、role、permissions{canProposeDefinition、canPublishDefinition、canRegisterTools、canEnableTools、actionIds、toolRefs}、definition{definitionVersion、entitySchema{schemaVersion}、appSpec、actions、toolRefs}、stateVersion、eventCursor、records | 一致的定义与业务状态；有效角色/权限来自当前会话，身份实现仍待确认 |
| 生成提案 | POST /v1/spaces/:spaceId/proposals；requestId、baseDefinitionVersion、intent | 版本冲突处理、旧版本回退、用户可读的 unsupported 反馈 |
| 发布变更 | POST /v1/spaces/:spaceId/proposals/:proposalId/publish；服务端复核提案绑定的 baseDefinitionVersion | 成功后获取完整快照；409 冲突时不覆盖当前界面 |
| 业务动作 | POST /v1/spaces/:spaceId/actions；requestId、definitionVersion、actionId、可选 recordId、更新时 expectedRecordVersion、input | 服务端验证权限/字段/冲突并返回新记录及版本 |
| 实时事件 | GET /v1/spaces/:spaceId/events?after=eventCursor；事件含 ID、definitionVersion、schemaVersion、stateVersion | 重放和顺序处理；游标失效或序号不连续时重新拉快照 |
| 能力状态 | ToolSpec 创建、校验、注册、执行的高层状态；无密钥或内部推理 | 只展示 Owner 需要的进度，不让浏览器执行外部工具 |

共享类型、字段迁移规则、身份会话、实际数据库与 SSE 支持需要跨角色锁定。前端开发顺序建议为：静态 Renderer 与四种候选组件 → 两种不同类别的固定有效定义验证 → 表单动作与持久状态 → 版本切换/动画 → 实时订阅与恢复 → Owner 指令和错误反馈。两种类别应由同一 Renderer 呈现，避免先写领域专用页面再伪装成生成器。
