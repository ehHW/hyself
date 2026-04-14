# hyself 前端

基于 Vue 3、TypeScript、Vite 和 Ant Design Vue 的后台前端项目，当前主线已经完成 Chat V2、资源中心、权限中心和基础娱乐页的整合。

仓库地址：<https://github.com/ehHW/hyself.git>

## 技术栈

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router
- Ant Design Vue
- Axios
- Vitest
- Playwright

## 运行环境

- Node.js: ^20.19.0 || >=22.12.0
- 包管理器: pnpm

## 安装依赖

```bash
pnpm install
```

## 启动开发环境

在项目目录内启动：

```bash
pnpm dev --host 127.0.0.1 --port 5174
```

如果你从工作区根目录启动：

```bash
pnpm --dir ./hyself dev --host 127.0.0.1 --port 5174
```

默认代理目标：

- /api -> <http://127.0.0.1:8000>
- /ws/ -> ws://127.0.0.1:8000
- /uploads -> <http://127.0.0.1:8000>

可选环境变量：

- HYSELF_API_PROXY_TARGET: 覆盖 /api、/uploads 以及默认 ws 代理目标
- HYSELF_WS_PROXY_TARGET: 单独覆盖 /ws/ 代理目标

当本机 8000 端口被旧进程占用时，可以这样启动：

```powershell
$env:HYSELF_API_PROXY_TARGET='http://127.0.0.1:8001'
pnpm dev --host 127.0.0.1 --port 5174
```

## 常用命令

```bash
pnpm type-check
pnpm test
pnpm build
pnpm build-only
pnpm preview
pnpm format
pnpm run test:browser:chat
pnpm run test:browser:rbac
pnpm run test:browser:ux
```

## 功能范围

- 登录鉴权与 JWT 续期
- 首页与全局布局
- 资源中心、上传队列、回收站
- Chat V1 到 V2 的过渡能力
- 用户、角色、权限管理
- 个人中心与系统设置
- 娱乐中心中的 2048、音乐、视频入口

## 页面结构

主导航当前包含：

1. 首页
2. 资源中心
3. 聊天室
4. 管理中心
5. 娱乐中心
6. 账号设置

其中：

- 资源中心统一承载文件管理与上传任务，旧的 /upload-center 仅保留兼容跳转
- 聊天室已包含消息页、联系人、好友通知、群通知、快捷键设置和巡检模式
- 管理中心包含用户管理、角色管理、权限管理
- 账号设置包含个人资料、密码修改和系统设置

## Chat V2 已完成项

- 聊天状态已按会话、消息、好友、群组、实时事件拆分到 src/stores/chat/
- WebSocket 事件消费已统一为 envelope 结构
- 聊天输入区支持附件消息、重试与失败态提示
- 聊天工作区支持转发、引用、多选和聊天记录查看器
- 浏览器回归脚本已覆盖聊天导航、RBAC 和错误页/娱乐中心链路

## 目录结构

```text
public/
  icons/          # 文件类型图标等静态资源
src/
  api/            # 接口封装
  assets/         # 样式与图片资源
  components/     # 通用组件
  Layout/         # 全局布局
  router/         # 路由配置
  stores/         # Pinia 状态管理
  testing/        # 单测辅助代码
  tools/          # 工具映射和访问标签等逻辑
  types/          # 前端类型定义
  utils/          # 请求、上传、WebSocket 等工具
  validators/     # 表单和业务校验
  views/          # 页面与业务组件
  workers/        # Web Worker
```

## 联调建议

1. 先启动 hyself_server，聊天联调建议使用 ASGI 方式。
2. 确保 Redis 可用，否则聊天实时链路和 Celery 无法完整验证。
3. 再启动 hyself 前端。
4. 浏览器访问 Vite 输出地址并执行手工清单或浏览器回归脚本。

## 相关文档

- docs/v2-release-acceptance-checklist.md
- docs/chat-message-flow-manual-checklist.md

## 备注

- 页面壳层高度统一通过 src/assets/css/base.css 中的 CSS 变量控制。
