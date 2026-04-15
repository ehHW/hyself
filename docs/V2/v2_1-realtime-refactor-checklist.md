# Hyself V2.1 Realtime 统一消费层改造清单

本文件用于承接 V2.1 Issue 07，先把前端 realtime 现状、分散点和下一批可执行改造项摸清。

- resource-center realtime 前置设计已单独沉淀到 [resource-center-realtime-event-contract.md](../assets/resource-center-realtime-event-contract.md)，在后端稳定产出 resource 域事件前，暂不直接新增 runtime。

## 1. 当前实时链路基线

当前前端 WebSocket 实时链路已经具备基础边界，但仍主要以 chat 为中心组织。

### 1.1 全局连接层

入口文件：

1. `src/utils/websocket.ts`

当前职责：

1. 建连、断连、重连、心跳
2. 原始消息 JSON 解析
3. 全局 listener 广播
4. 上传任务订阅恢复

当前边界问题：

1. 只负责“传输层”，没有继续把消息按 domain / event_type 分发
2. 所有业务域都直接订阅同一个 `globalWebSocket.subscribe`

### 1.2 Chat realtime 链路

入口文件：

1. `src/stores/chat/realtimeEvents.ts`
2. `src/stores/chat/realtime.ts`
3. `src/stores/chat/chatRealtimeRuntime.ts`
4. `src/stores/chat/chatAssemblyRuntime.ts`

当前职责拆分：

1. `realtimeEvents.ts` 负责 envelope 解包
2. `realtime.ts` 负责 chat 事件分支判断与副作用执行
3. `chatRealtimeRuntime.ts` 负责订阅生命周期
4. `chatAssemblyRuntime.ts` 负责把 conversation / message / friendship / group 等运行时能力接到 realtime handler 上

当前优点：

1. chat 已不再在页面组件里直接写大量原始 WS 处理逻辑
2. event envelope 已能稳定承接 `chat.message.ack`、`chat.message.created`、`chat.conversation.updated`、`chat.unread.updated`、`chat.system_notice.created` 等事件

当前问题：

1. `realtime.ts` 同时承担错误处理、事件识别、payload 解包、toast、副作用和数据同步，仍然偏重
2. chat 以外的 realtime 还没有接入统一 dispatcher
3. `globalWebSocket.subscribe` 仍直接暴露给 auth、upload 等链路使用

## 2. 当前分散点

### 2.1 Auth 仍直接订阅原始 WS

入口文件：

1. `src/stores/auth.ts`

当前处理事件：

1. `user.permission.updated`
2. `system.force_logout`

问题：

1. auth 直接消费原始 `payload.type` 和 `payload.event_type`
2. 与 chat 的 envelope 解包、事件过滤策略没有统一抽象

### 2.2 上传合并进度仍直接订阅原始 WS

入口文件：

1. `src/utils/fileUploader.ts`

当前处理事件：

1. `upload_progress`

问题：

1. 上传链路仍直接和传输层绑定
2. 进度类事件没有进入统一 realtime registry

### 2.3 业务副作用仍集中在单个 chat realtime handler

入口文件：

1. `src/stores/chat/realtime.ts`

当前集中副作用：

1. 本地消息 reconcile
2. unread 更新
3. conversation preview 更新
4. 好友/申请/群通知刷新
5. typing 状态管理
6. 系统 notice toast

问题：

1. 新增事件仍要继续把分支堆进同一个 handler
2. 还没有清晰分成 decoder、router、effect handler 三段

## 3. 建议目标边界

V2.1 的目标不是重写 websocket manager，而是把“统一消费层”补完整。

建议边界分成四层：

1. transport：`globalWebSocket`，只负责连接与原始消息输入
2. envelope：统一识别 event envelope、error 回执、upload_progress、system event
3. dispatcher：按 domain / event_type / type 路由到对应订阅者
4. domain handlers：chat、auth、upload 各自只处理本域副作用

目标事件流：

```text
globalWebSocket -> realtime envelope parser -> realtime dispatcher -> domain handler -> store/runtime
```

## 4. 下一批可执行改造项

当前状态更新：

1. Task 01 已完成：共享 envelope 已落在 `src/realtime/envelope.ts`
2. Task 02 已完成：共享 dispatcher 已落在 `src/realtime/dispatcher.ts`
3. Task 04 已完成：`src/stores/auth.ts` 已改走 event dispatcher
4. Task 05 已完成：`src/utils/fileUploader.ts` 已改走 type dispatcher
5. chat 当前已通过 domain dispatcher 订阅，且 handler 已继续细分到 `src/stores/chat/realtimeMessageHandlers.ts`、`src/stores/chat/realtimeFriendshipHandlers.ts`、`src/stores/chat/realtimeNoticeHandlers.ts`
6. search / audit 已通过 `src/stores/chat/searchAuditRealtimeRuntime.ts` 接入 dispatcher，在相关 chat 事件后执行条件刷新
7. search / audit 的 realtime 刷新已补上延迟合并策略，避免高频事件下重复拉取
8. auth 与 upload 也已分别抽到 `src/stores/authRealtimeRuntime.ts` 和 `src/utils/uploadRealtimeRuntime.ts`，按 dispatcher runtime 统一消费

### Task 01: 抽共享 realtime envelope 层

范围：

1. 把 `resolveRealtimeEventType`、`unwrapRealtimePayload` 从 chat 目录提升到 shared realtime 层
2. 为 `error`、`event`、`upload_progress`、`system` 建立统一类型守卫

完成定义：

1. auth、chat、upload 都不再各自手写 payload 类型识别

状态：已完成

### Task 02: 建立全局 dispatcher / registry

范围：

1. 在 shared realtime 层提供 subscribeByType / subscribeByEvent / subscribeByDomain 或等价机制
2. 保留底层 `globalWebSocket.subscribe`，但业务层优先通过 dispatcher 订阅

完成定义：

1. 新业务不再默认直连 `globalWebSocket.subscribe`

状态：已完成

### Task 03: 拆 chat realtime handler

范围：

1. 从 `src/stores/chat/realtime.ts` 拆出 ack/message/conversation/friendship/group/typing/notice handler
2. 保留现有 `createChatRealtimeHandler` 作为聚合入口，但内部改为 router + handlers 组合

完成定义：

1. 新增 chat 事件时只需补单独 handler，而不是继续膨胀单文件分支

状态：已完成第二轮拆分

当前进展：

1. 已抽出 `src/stores/chat/realtimeHandlers.ts`
2. message / conversation / unread 已收口到 `src/stores/chat/realtimeMessageHandlers.ts`
3. friendship / group join / typing 已收口到 `src/stores/chat/realtimeFriendshipHandlers.ts`
4. system notice 已收口到 `src/stores/chat/realtimeNoticeHandlers.ts`
5. `createChatRealtimeHandler` 当前只负责 envelope 解包与路由分发

状态：已完成第二轮拆分

### Task 04: auth 接入统一消费层

范围：

1. 把 `user.permission.updated` 和 `system.force_logout` 从 `src/stores/auth.ts` 接到统一 dispatcher

完成定义：

1. auth 不再直接判断原始 envelope 结构

状态：已完成

### Task 05: upload 进度接入统一消费层

范围：

1. 把 `upload_progress` 的监听从 `src/utils/fileUploader.ts` 接到统一 dispatcher
2. 明确上传事件是否保持 transport-level 特例，还是也进入 shared realtime event model

完成定义：

1. 上传进度链路和 chat/auth 一样拥有统一订阅入口

状态：已完成

## 5. 推荐执行顺序

1. Task 03 第二轮：继续按 notice / friendship / message 再细分文件边界
2. 继续为更多非 chat 域补充 dispatcher runtime
3. search / audit 条件刷新链路补充人工联调与延迟窗口验证

## 6. 建议验证基线

至少保持以下验证通过：

1. `src/testing/utils/websocket.spec.ts`
2. `src/testing/stores/chat/realtime.spec.ts`
3. `src/testing/stores/chat/chatRealtimeRuntime.spec.ts`
4. auth 登录后权限刷新与强制下线链路人工抽检
5. 上传大文件合并进度链路人工抽检

## 7. 当前结论

当前前端 realtime 并不是“完全散乱”，而是已经完成了 chat 域第一轮统一消费。

V2.1 下一步真正要补的是：

1. envelope 能力已经从 chat 私有实现提升为共享能力
2. auth / upload 旁路 listener 已收回到统一 dispatcher
3. chat realtime handler 已完成第二轮按 message / friendship / notice 的子域细分，search / audit 已接入带延迟合并的 dispatcher 条件刷新链路，auth / upload 也已补成 dispatcher runtime
