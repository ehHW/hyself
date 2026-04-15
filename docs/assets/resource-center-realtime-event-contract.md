# Resource Center Realtime Event Contract

## 目标

先把 resource-center 的事件契约定清楚，再决定是否值得补独立 dispatcher runtime。当前 upload 已有实时进度，resource-center 本体还没有稳定的 websocket 事件族，直接开 runtime 只会把“查询刷新”和“事件语义”混在一起。

## 结论

- 先定义 resource 域事件，不立即实现 runtime。
- 第一阶段只覆盖会影响列表一致性的变更，不覆盖全文检索、回收站统计这类可以继续走条件刷新路径的派生信息。
- 与 upload runtime 的边界保持清晰：upload_progress 仍只负责上传过程；资源条目真正落库后的目录变化走 resource 事件。

## 事件域

- domain: resource
- envelope: 继续沿用现有 dispatcher envelope
- 命名约定: resource.entry.created / resource.entry.updated / resource.entry.moved / resource.entry.deleted / resource.recycle_bin.updated / resource.permission.updated

## 事件定义

### resource.entry.created

触发时机:

- 新建文件夹成功
- 小文件上传落库成功
- 合并上传成功并正式生成资源条目
- 聊天附件另存为资源中心成功

payload:

```json
{
    "entry": {
        "id": 123,
        "parent_id": 45,
        "is_dir": false,
        "display_name": "report.pdf",
        "updated_at": "2026-04-14T12:00:00Z"
    },
    "scope": "user",
    "owner_user_id": 7,
    "parent_id": 45,
    "change_token": "resource:123:updated_at"
}
```

前端用途:

- 当前列表命中 parent_id 时做增量插入或轻量刷新
- 非当前目录仅刷新树节点计数或忽略

### resource.entry.updated

触发时机:

- 重命名
- 元数据更新
- 资源引用状态变化但不换目录

payload:

```json
{
    "entry": {
        "id": 123,
        "parent_id": 45,
        "display_name": "report-v2.pdf",
        "updated_at": "2026-04-14T12:01:00Z"
    },
    "previous_parent_id": 45,
    "change_token": "resource:123:updated_at"
}
```

前端用途:

- 当前目录命中时原位更新
- 若排序或过滤条件复杂，退化为目录级 refresh

### resource.entry.moved

触发时机:

- 移动文件/文件夹
- 从聊天上传区转存进入资源中心并改变父目录

payload:

```json
{
    "entry_id": 123,
    "entry_kind": "file",
    "from_parent_id": 45,
    "to_parent_id": 66,
    "updated_at": "2026-04-14T12:02:00Z",
    "change_token": "resource:123:updated_at"
}
```

前端用途:

- 当前目录是 from_parent_id 时移除
- 当前目录是 to_parent_id 时插入或触发轻量刷新

### resource.entry.deleted

触发时机:

- 软删除到回收站
- 永久删除

payload:

```json
{
    "entry_id": 123,
    "parent_id": 45,
    "deleted_mode": "recycle",
    "updated_at": "2026-04-14T12:03:00Z",
    "change_token": "resource:123:updated_at"
}
```

前端用途:

- 当前目录移除该项
- 若 deleted_mode 为 recycle，可联动回收站脏标记

### resource.recycle_bin.updated

触发时机:

- 回收站新增
- 回收站恢复
- 回收站清空

payload:

```json
{
    "action": "restore",
    "entry_id": 123,
    "affected_parent_id": 45,
    "updated_at": "2026-04-14T12:04:00Z"
}
```

前端用途:

- 仅对回收站页面或相关 badge 做合并刷新
- 不要求目录列表逐项增量回放

### resource.permission.updated

触发时机:

- 资源可见范围变化
- 角色权限调整导致资源中心菜单/操作权限变化

payload:

```json
{
    "reason": "role_permissions_updated",
    "requires_permission_context_refresh": true,
    "requires_resource_refresh": true
}
```

前端用途:

- 优先复用 auth runtime 刷新 permission context
- resource-center runtime 只在资源页面激活时做列表重拉

## 是否值得补 runtime

建议门槛:

- 后端至少稳定产出 entry.created / entry.updated / entry.moved / entry.deleted 四类事件。
- 前端至少有两个以上页面需要共享同一套 resource 事件消费，不再只是 upload 完成后的单点刷新。
- 能明确哪些页面走增量更新，哪些页面只打脏标记并延迟 refresh。

在满足以上门槛前，不建议直接新增 resource-center runtime；继续沿用 upload runtime + 页面条件刷新更稳。

## 实施顺序

1. 后端先补事件发布点，优先覆盖 create-folder、rename、move、delete、restore。
2. 增加 resource 域 envelope 测试，确认 event_type 和 payload 稳定。
3. 前端先做页面级 adapter，验证哪些事件适合增量更新。
4. 最后再决定是否收成 `resourceCenterRealtimeRuntime.ts`。
