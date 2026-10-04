---
title: LivingForma project context
type: note
permalink: livingforma/shared/project-context
---

# 当前项目背景

## 最新状态 · 2026-10-04 01:00 America/Vancouver

初版 https://livingforma.tech 和403补丁eedd1d4 已上线并完成真实Google/Neon/页面变化/访客SSE/合成相机播放验收。Render Free、AutoDeployOFF；push仅触发GitHub检查构建。

当前goal：AI原创前端页面、原创后端工具、生成中的真实UI变化。LF220/221/222/224/225/226完成；独立LF223普通QA完成8/8浏览器、11/11真实QuickJS/HTTP/重启、28/28回归，生成器明确为fixture。LF229在0.1CPU/512MiB完成6/6独立Docker验证，单Worker、启动8s/执行4s/总计12s；旧失败证据保留。LF230真实Gemini请求兼容已修复，Root完整候选和IAB启动通过；真实照片上传交互发现双选择问题，LF232提供显式功能反馈并使用原单次修复。LF233随后整合远程403热修复历史，LF227负责三类真实页面/工具/复用/数据保留/CI，LF228再免费部署。60模块与新生成仍本地，不宣称新版上线。

高级绕过研究暂停；正常功能、身份、隐私和版本检查继续。原Neon免费额度不重置；收费前确认。


## Relations

- implements [[decisions]]
- coordinated by [[task-board]]
- governed by [PRD](../../PRD.md)

- [confirmed] 用户开发中明确：产品界面为英文，开发沟通可中文；英文覆盖按钮/错误/示例/生成App默认文案。

- [current] 真实调用全部使用Neon持久预算；2026-10-03 UTC已预留30/30 Gemini请求，已自然日切至2026-10-04且当前1/30，CLI旧JSON22仅历史。ElevenAPI included余额/AutoTopUpOFF已只读核实；固定验证期STT5/60秒、TTS316/1000字符，不自动按日重置，不新增收费。
- [verified] 本地生产Docker镜像连接真实Neon，健康、匿名snapshot、SPA深链、CSP/设备策略、关闭测试登录均通过；证据LF-185-production-smoke.json。此结果不证明livingforma.tech或生产Google回调已上线。
- [confirmed] 用户已自行创建并登录Render，明确批准把现有GoogleOAuth/Neon/Gemini/ElevenLabs配置保存到Render服务端私密环境，继续免费部署且不添加付款方式。LF160已通过，LF170在部署；域名上线仍须实测。


- [implemented/verified locally] 2026-10-03 模块扩展：60类型（12+48）、6皮肤、可调3–12列/高度与配置、全部mobile/PC/container适配，Owner布局版本化保存/SSE，/modules本地sample展厅。170自动测试与前后端构建通过，独立300响应式、22交互/保存/同步、11审查回归通过；camera/tool展厅仅placeholder，未新增provider实调。详见[完整模块目录](../../product/module-catalog.md)。本轮未push/部署，独立PGlite/local服务器；生产继续固定7efaa91由LF170处理。
