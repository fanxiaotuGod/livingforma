# 前端技能选用与适配

状态：2026-10-03，两个第三方 Codex skill 已按用户要求安装在个人目录；**LivingForma 应用尚未实现，也未因此安装项目依赖或调用素材/API 服务。** Skill 是开发时的指导材料，不会使产品自动获得视觉生成或 3D 功能。实际产品仍遵守受限 AppSpec、共享契约、免费优先和本仓库文件认领。

| 下一开发对话使用的准确名称 | 本机目录 | 上游固定版本与核验 |
| --- | --- | --- |
| `frontend-dev` | `/Users/fanhaocheng/.codex/skills/frontend-dev/` | [`MiniMax-AI/skills`](https://github.com/MiniMax-AI/skills/tree/60aaae52bb2af8162732751a4332f62a5fef518b/skills/frontend-dev)，commit `60aaae52bb2af8162732751a4332f62a5fef518b`；98 个上游源文件的 Git blob hash 全部匹配 |
| `animations` | `/Users/fanhaocheng/.codex/skills/animations/` | [`mthines/agent-skills`](https://github.com/mthines/agent-skills/tree/dfd1a495c850678f247dfccdfe761d74164f5be5/skills/design/animations)，commit `dfd1a495c850678f247dfccdfe761d74164f5be5`；23 个上游源文件的 Git blob hash 全部匹配 |

两个安装目录保留了完整上游子目录与未修改的 `SKILL.md`。根目录另附上游仓库 MIT `LICENSE` 与各自的 `INSTALLATION.json`（包括固定 commit、文件数和比对结果）；安装没有运行上游脚本、安装 npm 包或调用其 API。coordinator 用全新本地 Codex app-server 的 `skills/list` 核验：两项均 `enabled: true`，路径指向上述 `SKILL.md`，无 skill 错误；这不是打开 GUI 新对话或执行模型任务的证据。**安装与可发现不表示技能产出的 UI、动效或资产已实现或验证。** 新对话应按准确名称显式选择技能，并先阅读本页的项目适配约束；不能假设新对话已自动调用它们。

## 当前采纳

| 来源 | 用于 LivingForma 的部分 | 不照搬的部分 |
| --- | --- | --- |
| [`animations` 原始 SKILL.md](https://github.com/mthines/agent-skills/blob/dfd1a495c850678f247dfccdfe761d74164f5be5/skills/design/animations/SKILL.md) | 按需要阅读已安装的 `rules/`、`references/`、`templates/`，借鉴状态编排、稳定 key/layout 身份、焦点与 reduced-motion 约束；用于 Owner orb 与定义发布的连续性设计 | 原文“JavaScript 动画库只用 Motion、禁止 GSAP”是该 skill 的完整 DoD，不等于本项目永远禁用 GSAP。引用的 `Skill(screen-recorder)`、`Skill(video-analyser)`、`Skill(confidence)` 以及 `/ux`、`/visual-design`、`animations-native` 未随这两个安装包一同安装；缺少这些能力时跳过并记录，用实际可用的浏览器/测试手段验证，不伪称已完成对应阶段 |
| [MiniMax `frontend-dev` 原始 SKILL.md](https://github.com/MiniMax-AI/skills/blob/60aaae52bb2af8162732751a4332f62a5fef518b/skills/frontend-dev/SKILL.md) | 按需要阅读已安装的 `references/`、`templates/`，借鉴视觉方向、排版层级、响应式构图、真实素材审查与动效节奏的设计工程节选；在读书、习惯等生成 App 上按内容适配 | 不执行其要求 `MINIMAX_API_KEY` 的素材 Phase 3 流程，也不让营销页面文案偏好、固定字体禁令、Next.js Server Components 默认或特定 Tailwind 版本规则覆盖 LivingForma 的产品/技术决定；不自动运行 `scripts/` 或添加依赖 |

使用任一已安装 skill 时，先读实际需要的 `rules/`、`references/`、`templates/`，再按本项目约束取舍；仅读一页 `SKILL.md` 会遗漏前提。采用“设计原则的一部分”必须这样表述，不能声称完整执行了原 skill 的 DoD。MiniMax 素材生成涉及账户、密钥与可能费用；当前排除该流程，任何收费前仍须用户确认。前端框架当前推荐 **Vite + React + TypeScript SPA** 与独立 Node API，由 LF-100 锁定；不要因为 skill 的 Next.js 默认模板提前改变架构。

## Motion、GSAP 与 3D 的位置

- **主运行时首选 Motion** 处理 React 中 orb 展开/收回、稳定组件身份的布局转场，以及状态反馈。新代码按 [Motion React 官方文档](https://motion.dev/docs/react-layout-animations) 评估 `motion/react` 与 layout 动画；减少动画时长和位移不是取消必要反馈。
- **GSAP 只在明确的独立动效需求中评估。** 若 Motion 无法清楚表达某段复杂时间线，可按 [GSAP 官方 skills 仓库](https://github.com/greensock/gsap-skills) 的对应 React/timeline 指南评估，隔离其生命周期和控制范围，避免与同一 DOM 节点的 Motion layout 动画抢控制权。GSAP 的 Flip 是插件能力，不是该仓库里已核实存在的独立 `gsap-flip` skill。选择 GSAP 时不得称为完整遵循原 `animations` 的禁 GSAP 规则。
- **R3F/Three.js 属于 3D stretch。** [OpenAI Game Studio 的 `react-three-fiber-game`](https://github.com/openai/plugins/blob/main/plugins/game-studio/skills/react-three-fiber-game/SKILL.md) 是 React 场景的优先参考；[nonaxanon/r3f-skills](https://github.com/nonaxanon/r3f-skills) 有场景架构内容，但默认安装指向 Claude 且若干技能仍为 stub；[Picaresco/threejs-skill](https://github.com/Picaresco/threejs-skill/blob/main/SKILL.md) 偏原生 Three.js/WebGPU 与特定版本、浏览器验证环境。当前二维 App 运行时不因这些资料引入 3D 包、物理引擎或任意场景代码。若将来引入 SceneSpec，也必须先定义受限 schema、验证与隐私/性能边界。

上述 GSAP 与 3D 技能是参考来源，**没有安装**。开始实现时应核对具体 API、依赖和许可证；`frontend-dev` 与 `animations` 的本次安装已固定版本，但不代表新开发对话已经调用它们，也不代表产品功能已完成。
