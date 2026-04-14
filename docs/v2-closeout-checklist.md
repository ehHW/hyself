# V2 收尾清单

这份清单用于记录当前 V2 已完成验证项，以及后续仍可继续收口的文档与工程事项。

## 已完成验证

- [x] 前端开发服务器可正常启动：`pnpm dev --host 127.0.0.1 --port 5174`
- [x] 后端 ASGI 服务可正常启动：`python -m uvicorn hyself_server.asgi:application --host 127.0.0.1 --port 8000 --reload --lifespan off`
- [x] Celery worker 可正常启动：`python -m celery -A hyself_server.celery:app worker -l info --pool=solo -c 1`
- [x] 前端 TypeScript 检查通过：`pnpm type-check`
- [x] 前端 Vitest 通过：`pnpm test`
- [x] 后端关键回归通过：`manage.py test chat.tests user.tests hyself.tests game.tests`
- [x] 浏览器聊天回归通过：`pnpm run test:browser:chat`
- [x] 浏览器 RBAC 回归通过：`pnpm run test:browser:rbac`
- [x] 浏览器错误页与娱乐中心回归通过：`pnpm run test:browser:ux`
- [x] 浏览器烟雾数据已执行创建与清理，验证链路闭环完成

## 已完成人工验收

- [x] 按 [docs/v2-release-acceptance-checklist.md](docs/v2-release-acceptance-checklist.md) 完成错误页人工抽检
- [x] 按 [docs/v2-release-acceptance-checklist.md](docs/v2-release-acceptance-checklist.md) 完成资源中心与上传人工抽检
- [x] 按 [docs/v2-release-acceptance-checklist.md](docs/v2-release-acceptance-checklist.md) 完成娱乐中心人工抽检
- [x] 按 [docs/chat-message-flow-manual-checklist.md](docs/chat-message-flow-manual-checklist.md) 完成聊天主链路人工联调

## 后续建议收口

### 文档同步

- [ ] 更新 [docs/V2/chat_v2_refactor_plan.md](../hyself_server/docs/V2/chat_v2_refactor_plan.md) 中已过时的“仍待完成”描述，和当前代码现状对齐
- [ ] 更新 [docs/V2/v2_architecture.md](../hyself_server/docs/V2/v2_architecture.md) 中“目标结构”与“当前落地快照”，补充已完成的前后端分层与场景拆分
- [x] 整理一份 V2 发布说明，概括聊天、资源中心、RBAC、娱乐中心、错误页和浏览器回归范围

### 工程收口

- [ ] 评估是否继续移除 [chat/views.py](../hyself_server/chat/views.py) 与 [chat/serializers.py](../hyself_server/chat/serializers.py) 这类兼容导出壳；若不作为 V2 阻断，则明确标记为 V2.1 收尾项
- [ ] 继续瘦身 [hyself/views.py](../hyself_server/hyself/views.py)，把剩余查询编排进一步下沉到 query/service（非当前发布阻断，但建议排期）
- [ ] 处理后端尚未提交的 [hyself/application/services/**init**.py](../hyself_server/hyself/application/services/__init__.py) 循环导入修复，并按需推送远端

## 发布判断

当前自动化检查、浏览器回归与人工验收均已完成，可将当前版本标记为“V2 可发布”。

文档同步与工程收口项建议继续推进，但不再作为当前 V2 发布阻断条件。
