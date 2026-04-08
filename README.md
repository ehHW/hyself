# bbot 前端

基于 Vue 3 + TypeScript + Vite + Ant Design Vue 的后台前端，当前对应 V1 已完成版本。

项目当前覆盖以下核心业务：

- 登录鉴权与 JWT 续期
- 首页与基础布局
- 资源中心
- 文件上传队列与断点续传
- 回收站与同 MD5 去重恢复
- 聊天室 V1
- 用户 / 角色 / 权限管理
- 个人中心与系统设置
- 娱乐中心中的 2048 页面

## 技术栈

- Vue 3
- TypeScript
- Vite
- Pinia
- pinia-plugin-persistedstate
- Vue Router
- Ant Design Vue
- Axios
- Day.js
- Cropper.js / vue-cropper
- spark-md5

## 运行环境

- Node.js: ^20.19.0 || >=22.12.0
- 包管理器: pnpm

## 安装依赖

```bash
pnpm install
```

## 开发启动

```bash
pnpm dev
```

默认通过 Vite 代理转发到本地后端：

- /api -> <http://127.0.0.1:8000/>
- /ws/ -> ws://127.0.0.1:8000/ws/
- /uploads -> <http://127.0.0.1:8000/uploads>

## 常用命令

```bash
# 类型检查
pnpm type-check

# 构建生产包
pnpm build

# 仅执行 Vite 打包
pnpm build-only

# 本地预览生产包
pnpm preview

# 格式化 src 目录
pnpm format
```

## 当前 V1 页面结构

主导航当前与代码一致，包含以下分区：

1. 首页
2. 资源中心
3. 聊天室
4. 权限中心
5. 娱乐中心
6. 账号设置

其中：

- 资源中心统一承载文件管理与上传任务，旧的 /upload-center 已作为兼容跳转保留
- 聊天室 V1 已包含消息区、联系人、新朋友、群通知、好友通知、聊天巡检和快捷键设置
- 权限中心包含用户管理、角色管理、权限管理
- 账号设置包含个人中心和系统设置
- 音乐页已从 V1 主导航中移除，保留到后续版本再处理

## 当前 V1 功能说明

### 资源中心

- 面包屑目录导航
- 文件 / 文件夹搜索
- 新建文件夹、重命名、删除、还原
- 回收站浏览、批量恢复、批量彻底删除、清空回收站
- 上传目录选择
- 上传任务队列
- 小文件直传与大文件分片上传
- 上传文件快照，降低源文件持续写入导致的上传失败
- 兼容同 MD5 文件从回收站恢复到当前所选目录

### 聊天室 V1

- 单聊与群聊
- 会话列表、会话置顶、会话隐藏
- 文本消息实时收发
- 历史消息加载
- 好友申请、好友列表、好友备注
- 群成员管理、邀请、移除、角色调整、快捷禁言
- 群通知与好友通知
- 用户聊天偏好与快捷键设置
- 管理员聊天巡检视图

### 设置与账号

- 个人资料维护与头像裁剪上传
- 系统标题与主题模式
- 聊天通知、列表排序、隐身巡检开关、发送快捷键

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
  types/          # 前端类型定义
  utils/          # 请求、格式化、上传、WebSocket 等工具
  validators/     # 前端校验逻辑
  views/          # 页面与业务组件
  workers/        # Web Worker
```

## 联调说明

1. 先启动后端服务，默认使用 8000 端口。
2. 如果要验证聊天实时能力，后端需以 ASGI 方式运行，并确保 Redis 可用。
3. 再启动前端开发服务。
4. 浏览器访问 Vite 输出的本地地址。

## 相关代码位置

- 路由主入口：src/router/routes.ts
- 请求实例：src/utils/request.ts
- 上传状态管理：src/stores/file.ts
- 聊天状态管理：src/stores/chat.ts
- 聊天页面入口：src/views/Chat/
- 资源中心入口：src/views/FileManage/

## 备注

- 页面壳层高度已统一通过 src/assets/css/base.css 中的 CSS 变量控制。
- 当前聊天室 V1 仅支持文本消息，不包含图片、文件消息发送。
