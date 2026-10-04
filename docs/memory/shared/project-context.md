---
title: LivingForma project context
type: note
permalink: livingforma/shared/project-context
---

# 当前项目背景

## 最新状态 · 2026-10-04 01:45 America/Vancouver

https://livingforma.tech 新版精确22f78d2部署dep-db1176id0e5s73dke66g于01:52:46PDT Live。新模块和通用生成已通过本地真实验收，精确提交22f78d2d977049c0c8193705ca6194fed58c3a25的CI37190026028已通过，正式真实生成成功并发布，但普通form-submit兼容修复尚未验收。Render Free/无卡/$0，AutoDeployOFF；push只触发CI。

LF233有意合并热修复历史84e90bf并保留224文件与双方角色日志。LF234/235/236全部完成：人类选择120s截止/相关RPC180s、同预览显式重试、通用ID语法和独立tool.invoke绑定；严格校验、原预算和一次修复不变。最终pnpm check308/308、typecheck和两端构建通过。

真实Pi/Gemini生成了三个不同体验：Photo Drift三张合成照片/上传/收藏/实际左右手势；Kitchen Math生成scale_recipe v1并通过两项QuickJS测试，150份原料4→6人份返回225后保存；Portion Quest复用同一工具，225答对、200答错、Next question和History运行。计算器→测验的原记录逐字段、ID、版本、时间及URL完全保留，定义v1→2；手机390px实际工具操作和匿名历史读取通过。照片进化也保留数据/资源/URL，匿名SSE收到发布事件。

证据来自隔离4347/PGlite和明确本地身份，模型用真实Pi/Gemini、工具用真实QuickJS，不充当Google线上证据。此前无效候选保留；测验一次自动修复后成功，不能保证任意请求首轮有效。原Neon Gemini账本30/30，正式Serving Studio一次真实生成/新工具两测试/发布v1成功，原生form-submit阻止225/save；修复复用同一候选不再生成，不重置、不付费fallback。高级绕过研究已暂停；继续正常功能/会话/隐私/版本验证。

详见[LF227交接](../handoffs/coordinator/LF-227-27d9cbd8-ed2b-4f98-874c-e81f6a6fd28f.md)。LF228由DevOps0840cd91释放未完成，新增LF237/238普通表单修复及独立QA门控，Rootdc062dbe持有LF155共享记忆收尾。部署必须匹配reviewed CI-green SHA，并保留现有Neon数据与Google配置；旧binary不能作为新定义的恢复目标，使用兼容版本重新部署或向前修复。


## Relations

- implements [[decisions]]
- coordinated by [[task-board]]
- governed by [PRD](../../PRD.md)

- [confirmed] 用户开发中明确：产品界面为英文，开发沟通可中文；英文覆盖按钮/错误/示例/生成App默认文案。

- [current] 真实调用全部使用Neon持久预算；2026-10-03 UTC已预留30/30 Gemini请求，已自然日切至2026-10-04且当前1/30，CLI旧JSON22仅历史。ElevenAPI included余额/AutoTopUpOFF已只读核实；固定验证期STT5/60秒、TTS316/1000字符，不自动按日重置，不新增收费。
- [verified] 本地生产Docker镜像连接真实Neon，健康、匿名snapshot、SPA深链、CSP/设备策略、关闭测试登录均通过；证据LF-185-production-smoke.json。此结果不证明livingforma.tech或生产Google回调已上线。
- [confirmed] 用户已自行创建并登录Render，明确批准把现有GoogleOAuth/Neon/Gemini/ElevenLabs配置保存到Render服务端私密环境，继续免费部署且不添加付款方式。LF160已通过，LF170在部署；域名上线仍须实测。


- [implemented/verified locally] 2026-10-03 模块扩展：60类型（12+48）、6皮肤、可调3–12列/高度与配置、全部mobile/PC/container适配，Owner布局版本化保存/SSE，/modules本地sample展厅。170自动测试与前后端构建通过，独立300响应式、22交互/保存/同步、11审查回归通过；camera/tool展厅仅placeholder，未新增provider实调。详见[完整模块目录](../../product/module-catalog.md)。本轮未push/部署，独立PGlite/local服务器；生产继续固定7efaa91由LF170处理。
