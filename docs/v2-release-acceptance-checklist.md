# V2 Release Acceptance Checklist

这份清单用于发布前做一轮可重复执行的全站 V2 验收。默认从项目根目录执行命令，且只使用相对路径。

## 启动前提

1. 已准备好本地 MySQL 与 Redis。
2. 后端依赖已安装，前端依赖已安装。
3. 执行浏览器回归前，先准备临时烟雾账号；回归完成后立即清理。

## 服务启动

```powershell
hyself_server/.venv/Scripts/python.exe -m uvicorn --app-dir ./hyself_server hyself_server.asgi:application --host 127.0.0.1 --port 8000 --reload --lifespan off
hyself_server/.venv/Scripts/python.exe -m celery --workdir ./hyself_server -A hyself_server.celery:app worker -l info --pool=solo -c 1
pnpm --dir ./hyself dev --host 127.0.0.1 --port 5174
```

## 自动化检查

### 前端基线

```powershell
pnpm --dir ./hyself type-check
pnpm --dir ./hyself test
```

通过标准：

1. TypeScript 无报错。
2. Vitest 全量通过。

### 后端关键回归

```powershell
hyself_server/.venv/Scripts/python.exe ./hyself_server/manage.py test chat.tests user.tests hyself.tests game.tests
```

通过标准：

1. 聊天、用户权限、资源中心、上传、视频兼容、游戏接口测试全部通过。
2. 不出现新的权限回退或 403 误报。

### 浏览器联调回归

先执行：

```powershell
hyself_server/.venv/Scripts/python.exe ./hyself_server/manage.py seed_smoke_data
```

```powershell
pnpm --dir ./hyself run test:browser:chat
pnpm --dir ./hyself run test:browser:rbac
pnpm --dir ./hyself run test:browser:ux
```

完成后执行：

```powershell
hyself_server/.venv/Scripts/python.exe ./hyself_server/manage.py cleanup_smoke_data
```

通过标准：

1. 聊天主菜单落地、联系人返回消息页、当前会话未读隐藏正常。
2. RBAC 角色矩阵下，资源中心、聊天、娱乐中心、用户中心的落地与权限提示符合预期。
3. 404 错误页能占满视口，卡片保持居中，非法路由会回落到 `/404`。
4. 娱乐中心入口会根据角色落到正确页面或正确回退首页。

CI 默认使用 Playwright 自带 Chromium。本地如果仍想强制走 Edge，可设置 `HYSELF_BROWSER_CHANNEL=msedge`。

## 人工抽检

### 错误页

1. 访问 `/404`，确认错误页独立占满整个视口。
2. 访问一个不存在的路径，确认自动跳到 `/404`。
3. 点击“返回首页”与“返回上一页”，确认行为符合预期。

### 资源中心与上传

1. 打开资源中心文件页，确认目录树、面包屑、搜索、回收站入口可用。
2. 打开上传页，确认有上传权限的角色可操作，只读角色看到只读提示。
3. 随机抽一条聊天附件保存到资源中心，确认资源列表可见。

### 娱乐中心

1. 打开 `/entertainment`，确认会根据角色自动落到游戏页或回退首页。
2. 在 `2048` 页面确认排行榜、个人最高分、只读提示和终局棋盘预览正常。
3. 抽检音乐、视频入口，确认页面可达且无异常 toast。

### 聊天主链路

1. 按 [docs/chat-message-flow-manual-checklist.md](docs/chat-message-flow-manual-checklist.md) 执行一轮聊天手工联调。
2. 至少覆盖文本、附件、转发、聊天记录查看器、通知与未读联动。

## 发布门槛

只有同时满足以下条件，才允许标记为“全站 V2 可发布”：

1. 自动化检查全部通过。
2. 浏览器联调脚本无异常 403、无 page error、无路径回退错误。
3. 人工抽检未发现阻断级问题。
4. 新增文档、脚本和测试都已同步到仓库。
