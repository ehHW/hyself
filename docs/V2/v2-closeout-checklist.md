# V2.1 收尾与发布清单

这份清单用于记录 V2.1 当前发布门槛、已完成收口项，以及已明确延后到 V2.2 的内容。

## 当前发布门槛

- [x] 前端开发服务器可正常启动：`pnpm dev`
- [x] 后端 ASGI 服务可正常启动：`python -m uvicorn hyself_server.asgi:application --host 127.0.0.1 --port 8000 --reload --lifespan off`
- [x] Celery worker 可正常启动：`python -m celery -A hyself_server.celery:app worker -l info --pool=solo -c 1`
- [x] 前端 TypeScript 检查通过：`pnpm type-check`（2026-04-15 复跑）
- [x] 前端 Vitest 通过：`pnpm test`（2026-04-15 复跑，29 files / 91 tests）
- [x] 后端关键回归通过：`manage.py test chat.tests user.tests hyself.tests game.tests`（2026-04-15 复跑，83 tests）
- [x] 浏览器聊天回归通过：`pnpm run test:browser:chat`（2026-04-15 复跑）
- [x] 浏览器 RBAC 回归通过：`pnpm run test:browser:rbac`（2026-04-15 复跑）
- [x] 浏览器错误页与娱乐中心回归通过：`pnpm run test:browser:ux`（2026-04-15 复跑）
- [x] 浏览器烟雾数据已执行创建与清理，验证链路闭环完成

## 已完成收口

- [x] [docs/V2/chat_v2_refactor_plan.md](../hyself_server/docs/V2/chat_v2_refactor_plan.md) 已同步当前代码状态，不再把已收口项写成“仍待完成”
- [x] [docs/V2/v2_architecture.md](../hyself_server/docs/V2/v2_architecture.md) 已同步 V2.1 当前边界
- [x] chat 顶层兼容壳已移除；[chat/views.py](../hyself_server/chat/views.py) 与 [chat/serializers.py](../hyself_server/chat/serializers.py) 不再作为过渡文件存在
- [x] 前端 realtime 已统一到共享消费层，chat/auth/upload/search-audit 统一经由 dispatcher/runtime 处理
- [x] 资源中心读取与主要写接口已完成第二轮 command/query 收口，`hyself/views.py` 当前主要承担请求协调与响应装配
- [x] 消息/媒体增强按 V2.1 当前边界收口：图片/文件/聊天记录主链路、撤回/删除状态展示、聊天附件与资源中心互通均已完成

## 已完成人工验收

- [x] 按 [v2-release-acceptance-checklist.md](v2-release-acceptance-checklist.md) 完成错误页人工抽检
- [x] 按 [v2-release-acceptance-checklist.md](v2-release-acceptance-checklist.md) 完成资源中心与上传人工抽检
- [x] 按 [v2-release-acceptance-checklist.md](v2-release-acceptance-checklist.md) 完成娱乐中心人工抽检
- [x] 按 [chat-message-flow-manual-checklist.md](../chat/chat-message-flow-manual-checklist.md) 完成聊天主链路人工联调

## 延后到 V2.2

- [ ] 统一 chat asset picker、附件选择器和媒体展示入口
- [ ] 上传初始化、分片、合并协议进一步收口到更独立的资产域接口
- [ ] 搜索/审核链路继续细化 moderation 规则和查询边界
- [ ] 资源中心从 `hyself` 继续演进为更独立的 assets 域
- [ ] 浏览器回归接入 CI，并统一 trace / 截图 / 日志工件保留策略
- [ ] `hyself/views.py` 剩余查询编排继续下沉到 query/service
- [ ] capability 模型进一步统一为更细的跨前后端共享语义

## 发布判断

按 [../hyself_server/docs/V2/v2_1_plan.md](../hyself_server/docs/V2/v2_1_plan.md) 的发布门槛复核后，当前版本可标记为“V2.1 可发布”。

当前未完成项已收敛到明确的 V2.2 范围，不再作为本次发布阻断。
