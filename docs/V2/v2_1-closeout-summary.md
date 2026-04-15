# Hyself V2.1 正式收口清单

## 发布结论

按 [../hyself_server/docs/V2/v2_1_plan.md](../hyself_server/docs/V2/v2_1_plan.md) 约定的发布门槛复核后，Hyself V2.1 当前版本已完成自动化验证、浏览器回归和人工验收，可按“V2.1 已完成”口径发布。

本次收口原则如下：

- 消息/媒体增强以当前已落地能力为 V2.1 边界，不继续扩展统一 picker 或更复杂媒体编辑能力
- 仍值得继续演进的结构性事项统一转入 V2.2，不再作为 V2.1 发布阻断

## V2.1 已完成

### 前端聊天与 realtime

- 聊天主菜单、联系人、消息工作区、通知记录、巡检模式等主场景已完成 V2.1 范围内拆分与稳定化
- realtime 统一消费链路已落地，chat/auth/upload/search-audit 等场景通过共享 envelope、dispatcher 和 runtime 处理
- 当前会话未读闪动、通知重复登录、巡检模式直聊标题/头像/新消息推送等回归已通过浏览器验证

### 资源中心与资产互通

- 资源中心增量 realtime、目录本地更新、系统资源删除联动等链路已落地
- 聊天附件、资源中心文件、头像资产已完成当前 V2.1 所需的资产引用复用
- 保存聊天附件到资源中心、删除/恢复、上传后增量刷新等链路已纳入当前验证基线

### 后端结构收口

- chat 模块分层已稳定，旧顶层兼容壳不再作为当前结构的一部分
- `hyself/views.py` 当前主要承担接口协调职责，资源中心主要读写链路已完成第二轮 command/query 收口
- Django 入口、异步入口和相关工具链已统一到当前服务结构

### 权限与页面落地

- RBAC 角色矩阵在聊天、资源中心、娱乐中心、用户中心等主要页面上的落地行为已通过浏览器回归
- 错误页、非法路由回退、娱乐中心角色落地行为已纳入 V2.1 验收基线

### 消息与媒体边界

- 图片、文件、聊天记录消息主链路已可用
- 撤回、删除、审计/巡检视角下的消息状态展示已完成当前 V2.1 范围修正
- 当前边界下不再把“统一附件选择器”或“更丰富媒体能力”视为 V2.1 未完成项

## 延后到 V2.2

- 统一 chat asset picker、资源中心选择器与更完整的附件入口
- 更丰富的媒体消息能力，包括更深的展示、编辑和复合消息编排
- 上传协议进一步独立化，继续减少页面侧对上传细节的感知
- 资源中心继续向更独立的 assets 域演进
- 浏览器回归接入 CI，并统一 trace、截图、日志等工件管理
- capability 与共享权限语义继续细化，减少前后端重复映射
- `hyself/views.py` 剩余查询编排继续下沉到 query/service

## 本轮发布门槛复核结果

- 前端 TypeScript 检查通过：`pnpm type-check`
- 前端 Vitest 全量通过：`pnpm test`（29 files / 91 tests）
- 后端关键回归通过：`manage.py test chat.tests user.tests hyself.tests game.tests`（83 tests）
- 浏览器聊天回归通过：`pnpm run test:browser:chat`
- 浏览器 RBAC 回归通过：`pnpm run test:browser:rbac`
- 浏览器错误页与娱乐中心回归通过：`pnpm run test:browser:ux`
- 烟雾数据创建、准备与清理链路已复核

## 可发布口径

建议项目发布口径如下：

> Hyself V2.1 已完成当前规划范围内的结构收口与回归验证。聊天、资源中心、权限与娱乐中心的核心链路已稳定可用；消息/媒体增强以当前能力作为 V2.1 边界收口，进一步的统一资产选择与 richer media 能力将转入 V2.2 持续推进。

## 相关文档

- [v2-closeout-checklist.md](v2-closeout-checklist.md)
- [v2-release-notes.md](v2-release-notes.md)
- [v2_2-first-batch-tasks.md](v2_2-first-batch-tasks.md)
- [../hyself_server/docs/V2/v2_architecture.md](../hyself_server/docs/V2/v2_architecture.md)
- [../hyself_server/docs/V2/chat_v2_refactor_plan.md](../hyself_server/docs/V2/chat_v2_refactor_plan.md)
- [../hyself_server/docs/V2/v2_1_plan.md](../hyself_server/docs/V2/v2_1_plan.md)
