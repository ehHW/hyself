# Hyself V2.2 首批任务单

## 适用前提

这份任务单按个人项目节奏拆分，不按团队并行开发方式设计。

目标不是一次性把 V2.2 全做完，而是先做一批最能减少后续返工、同时又能继续改善实际使用体验的任务。

当前建议遵循三个原则：

- 优先做会同时影响聊天、资源中心、上传三条链路的公共节点
- 优先做能减少自己后续维护成本的收口，不为了“架构完整感”提前大拆
- 每个任务都要求能单独提交、单独验证、单独回退

## 本批次目标

V2.2 首批只做三件事：

1. 做出统一资产入口的可用 MVP
2. 把上传协议和资产引用链路再收紧一层
3. 为资源中心继续独立成 assets 域铺平后端边界

以下事项明确不进入首批：

- 浏览器回归接入 CI
- capability 语义继续抽象
- 更复杂的 moderation 规则扩展
- 更重的消息富媒体编辑器

这些方向有价值，但对个人项目当前阶段的收益不如首批三项直接。

## 当前状态总览

更新日期：2026-04-15

### 已完成

- 统一 realtime 基础设施第一轮收口已完成：共享 envelope、dispatcher、auth runtime、upload runtime、chat runtime 拆分与 search/audit 条件刷新都已落地
- 资源中心增量刷新第一轮已完成：FileManage 已接入 resource realtime runtime，支持当前目录增量 upsert/remove 与搜索态延迟 refresh
- 统一资产选择器 MVP 第一轮基础设施已完成：`AssetPickerSelection`、`AssetPickerWorkspace`、`useAssetPickerScene`、scene presets、system-resource dialog 和相关单测已补齐
- FileManage 的系统资源入口已切到 `SystemResourcePickerDialog`，不再从嵌入式 session 工厂起手

### 进行中

- A1 统一资产选择器交互边界：共享 picker 主体和标准化结果已落地，但仍有部分调用入口没有统一到最终形态
- B1 upload / asset reference 边界收口：上传 realtime 已抽到独立 runtime，上传目标目录选择已接入统一 picker 主体，但页面层与聊天侧资产准备流程还没有完全收口

### 未开始

- A2 统一资产预览与元信息展示最小模型
- B2 收口聊天附件发送前的资产准备流程
- C1 `hyself/views.py` 继续下沉 query/service
- C2 预留更明确的 assets 域目录与命名约定

## 当前可执行清单

### 已完成

- [x] 抽离共享 realtime envelope 与 dispatcher
- [x] auth / upload / chat / search-audit 接入统一 realtime 消费层
- [x] 资源中心页面接入 resource realtime runtime
- [x] 抽离 `AssetPickerWorkspace`、`useAssetPickerScene`、scene presets 与 system-resource dialog
- [x] FileManage 系统资源调用方优先改走 `SystemResourcePickerDialog`

### 进行中

- [ ] 把聊天附件入口、资源中心入口、上传目标目录入口继续收敛到统一 asset picker 协议
- [ ] 统一 upload 完成后的资产结果结构，减少页面层感知 small-file / chunked 差异

### 未开始

- [ ] 统一 asset card / file card 的最小预览模型
- [ ] 为聊天侧补一层 asset prepare / attachment payload 统一组装入口
- [ ] 为 `hyself/views.py` 选定第一组 query/service 下沉接口
- [ ] 制定后端 assets 域目录与命名约定文档

## 阶段划分

### Phase A: 统一资产入口 MVP

这是首批里优先级最高的任务，因为它直接决定聊天附件、资源中心选择器和未来 richer media 能不能共用一套入口。

#### A1. 统一资产选择器的交互边界

当前状态：进行中

已落地：

- `AssetPickerSelection` 标准化结果已作为统一选择输出使用
- `AssetPickerDialog` 已从聊天专用弹层收口为场景化 modal 壳
- `AssetPickerWorkspace` 与 `useAssetPickerScene` 已抽离，可复用于对话框和嵌入式页面
- FileManage 已接入统一 picker 主体，系统资源入口已有单独 dialog 封装

下一步：

- 把聊天附件入口和“保存到资源中心”入口继续对齐到同一套 scene / selection 协议
- 评估是否还需要保留嵌入式 session helper，仅保留给特殊嵌入场景使用

目标：

- 明确聊天发送附件、转发聊天记录、资源中心选择文件这三类入口的共用部分和特例部分
- 先统一“选择资产”这一步，不急着统一全部发送表单和全部预览面板

建议产出：

- 一个共享的 asset picker 场景层或 workspace 组件
- 明确 picker 输入参数：来源场景、可选资源类型、是否允许多选、是否允许新建目录、确认回调
- 明确 picker 输出数据：asset reference、file entry、必要的展示字段

建议先覆盖的使用点：

- 聊天发送图片/文件
- 聊天保存资源中心文件到当前会话
- 资源中心内部的文件选择场景

验收标准：

- 至少两个页面不再维护各自独立的选择弹层逻辑
- 选择结果在聊天与资源中心两边都能直接消费，不再重复拼装不同格式
- 现有图片/文件发送链路不回退

##### A1 当前代码落点

当前已经存在一部分可复用基础，但边界还没有统一：

- 聊天侧资源选择弹层已经存在：[src/components/assets/AssetPickerDialog.vue](src/components/assets/AssetPickerDialog.vue)
- 聊天发送入口与附件 token 写入逻辑在：[src/modules/chat-center/composables/useMessageWorkspaceComposerScene.ts](src/modules/chat-center/composables/useMessageWorkspaceComposerScene.ts)
- 聊天附件发送 payload 组装在：[src/utils/chatAttachment.ts](src/utils/chatAttachment.ts)
- 资源中心页面主列表在：[src/views/FileManage/index.vue](src/views/FileManage/index.vue)
- 上传页当前“选择上传目录”还是自己的独立 modal 流程，在：[src/views/FileManage/components/UploadTaskPanel.vue](src/views/FileManage/components/UploadTaskPanel.vue)
- 文件与资源类型定义在：[src/api/upload.ts](src/api/upload.ts)

这意味着 A1 不是从零开始做，而是把现有聊天侧 picker 提升成跨场景资产选择入口，再把资源中心的目录选择和文件选择语义接上来。

##### A1 目标边界

A1 这一轮只统一“选什么”和“选完返回什么”，不统一上传流程，也不统一消息发送流程。

本轮要统一的动作：

- 打开资产选择器
- 在资源中心目录里浏览
- 按关键字搜索已有资源
- 选择一个或多个可用文件
- 把统一结果返回给调用方

本轮暂不统一的动作：

- 本地文件上传
- 上传队列管理
- 新建文件夹的完整体验
- 聊天消息发送前预览 UI
- 保存聊天附件到资源中心的目标目录选择流程

换句话说，A1 先做一个跨页面可复用的“已有资源选择器”，而不是一口气做成“全资产工作台”。

##### A1 统一输入协议

建议把 picker 输入先收敛成一个显式配置对象，例如：

- `scene`: 来源场景，例如 `chat-compose`、`resource-select`、`chat-save-target`
- `scope`: 资源范围，先支持 `user`，后续按需要扩到 `system`
- `selectionMode`: `single` 或 `multiple`
- `allowedKinds`: 允许的资源类型，例如 `image`、`video`、`file`
- `allowDirectoryPick`: 是否允许把目录本身作为结果返回，A1 默认大多数场景为 `false`
- `allowCreateFolder`: 是否展示新建目录能力，A1 默认先按场景显式开启
- `initialParentId`: 初始目录 id
- `initialKeyword`: 初始搜索词

这套输入协议的重点不是“完整”，而是先把聊天侧硬编码的发送语义从组件内部拿出来。

##### A1 统一输出协议

建议 A1 不直接把 `FileEntryItem` 原样回传给所有调用方，而是补一层轻量标准结果，例如 `AssetPickerSelection`。

建议最小字段：

- `entryId`
- `assetReferenceId`
- `displayName`
- `mediaType`
- `mimeType`
- `fileSize`
- `url`
- `streamUrl`
- `thumbnailUrl`
- `processingStatus`
- `sourceEntry`: 保留原始 `FileEntryItem | SearchFileEntryItem`

这样做的原因很实际：聊天发送和资源中心内部选择最终都要用“已标准化的资产结果”，而不是每个场景再从 `asset` / `asset_reference` / `url` 里各自拼一遍。

##### A1 组件拆分建议

建议不要继续把所有逻辑都留在当前 [src/components/assets/AssetPickerDialog.vue](src/components/assets/AssetPickerDialog.vue) 里，而是拆成三层。

第一层：场景壳组件

- 目标文件建议保留为：[src/components/assets/AssetPickerDialog.vue](src/components/assets/AssetPickerDialog.vue)
- 职责只保留 modal 展示、标题、副标题、确定/取消、和场景配置透传

第二层：可复用主体 workspace

- 建议新增：[src/components/assets/AssetPickerWorkspace.vue](src/components/assets/AssetPickerWorkspace.vue)
- 职责包括 breadcrumb、搜索框、列表、空态、选择态、刷新
- 以后如果需要 drawer 版或嵌入版，可以直接复用这一层，不再依赖 modal

第三层：展示子组件

- 可考虑新增：[src/components/assets/AssetPickerTable.vue](src/components/assets/AssetPickerTable.vue)
- 或者如果你想控制文件数，也可以先不拆表格子组件，只拆 workspace composable
- 优先级低于 workspace，本轮不是必须一步拆满

##### A1 composable / store 拆分建议

建议把现有 picker 内部状态抽到独立 composable，而不是直接上 Pinia 新 store。

原因：

- A1 还是单个交互域，不需要全局持久状态
- 用 composable 更轻，后续如果确认多个页面都共享缓存，再上 store 不迟

建议新增：

- [src/components/assets/useAssetPickerScene.ts](src/components/assets/useAssetPickerScene.ts)

建议这个 scene 负责：

- 打开时初始化目录与搜索状态
- 加载目录内容
- 搜索建议与全量搜索
- 统一判断某条记录是否可选
- 把选中项转换成 `AssetPickerSelection`
- 支持单选/多选模式

建议暂时不要新建全局 store 的部分：

- 不做“全局最近访问目录”
- 不做“跨页面选中结果缓存”
- 不做“上传队列和 picker 的联合状态”

##### A1 接口适配点

A1 先不新增后端接口，优先把现有接口收敛成统一前端 adapter。

直接使用的现有接口：

- [src/api/upload.ts](src/api/upload.ts) 中的 `getFileEntriesApi`
- [src/api/upload.ts](src/api/upload.ts) 中的 `searchFileEntriesApi`

建议新增前端 adapter：

- [src/components/assets/assetPickerAdapter.ts](src/components/assets/assetPickerAdapter.ts)

建议 adapter 负责：

- `FileEntryItem | SearchFileEntryItem -> AssetPickerSelection`
- 把 `asset_reference_id` 缺失的情况统一转成 picker 层错误
- 统一解析 `mediaType`、`mimeType`、`streamUrl`、`thumbnailUrl`

这样可以把当前 [src/utils/chatAttachment.ts](src/utils/chatAttachment.ts) 里的“聊天发送专用 payload 组装”与“资产选择标准化”拆开，避免 picker 一上来就依赖 chat 语义。

##### A1 具体改动清单

建议按下面顺序拆，保持每一步都能单独提交。

1. 抽资产选择标准模型

- 新增 `AssetPickerSelection` 类型
- 新增 `assetPickerAdapter.ts`
- 让聊天侧不再直接从 `FileEntryItem` 拼 token 输入，而是先走标准化结果

2. 抽 `useAssetPickerScene`

- 把 [src/components/assets/AssetPickerDialog.vue](src/components/assets/AssetPickerDialog.vue) 中的搜索、目录、breadcrumb、可选判断、选择逻辑迁出
- 保持现有聊天入口仍能工作

3. 把 `AssetPickerDialog` 改成可配置场景壳

- 增加输入配置 props，而不再只有 `open`
- 支持 `single` / `multiple`
- 支持按 `allowedKinds` 过滤不可选项

4. 改聊天 composer 接入方式

- 修改 [src/modules/chat-center/composables/useMessageWorkspaceComposerScene.ts](src/modules/chat-center/composables/useMessageWorkspaceComposerScene.ts)
- `handleAssetPickerSelect` 从接收 `FileEntryItem` 改为接收标准化 `AssetPickerSelection`
- 聊天 token 组装只消费标准结果，不再感知 `asset` / `asset_reference` 的嵌套结构

5. 让资源中心接入同一套 picker 主体

- 第一轮不要求替换整个 [src/views/FileManage/components/UploadTaskPanel.vue](src/views/FileManage/components/UploadTaskPanel.vue)
- 先把“选择目录/浏览目录”的数据装载与 breadcrumb 逻辑对齐到同一 scene 能力
- 如果你想保守推进，可以先做到“资源中心未来可复用 AssetPickerWorkspace，但上传页仍保留自己的 modal 壳”

##### A1 组件级改动点

建议直接关注这些文件：

- [src/components/assets/AssetPickerDialog.vue](src/components/assets/AssetPickerDialog.vue)
  目标：从聊天专用弹层改成可配置场景壳

- [src/components/assets/AssetPickerWorkspace.vue](src/components/assets/AssetPickerWorkspace.vue)
  目标：承接目录浏览、搜索、表格、选择态

- [src/components/assets/useAssetPickerScene.ts](src/components/assets/useAssetPickerScene.ts)
  目标：承接状态与行为，不把逻辑继续堆在 SFC 里

- [src/components/assets/assetPickerAdapter.ts](src/components/assets/assetPickerAdapter.ts)
  目标：提供统一的 selection 标准化

- [src/modules/chat-center/composables/useMessageWorkspaceComposerScene.ts](src/modules/chat-center/composables/useMessageWorkspaceComposerScene.ts)
  目标：改成消费统一 selection，而不是直接消费 `FileEntryItem`

- [src/utils/chatAttachment.ts](src/utils/chatAttachment.ts)
  目标：只保留聊天消息 payload 组装，不再承担 picker 标准化职责

##### A1 store / 状态层改动点

A1 这一轮建议不新增 Pinia store。

如果你坚持要做共享状态，也建议只做极薄的一层，例如“最近目录缓存”，但这不应该进入 A1 首提交流程。

当前优先级更高的是：

- 先统一 `scene state`
- 再统一 `selection result`
- 最后再看是否需要共享缓存

##### A1 API 适配点

本轮前后端接口建议保持不变，只做前端调用约束统一。

需要明确的适配规则：

- picker 只选择已有资源，不负责上传
- `asset_reference_id` 缺失的记录一律视为不可选
- 目录默认可浏览不可选择
- 搜索结果和目录结果都必须通过同一 adapter 归一化后再返回给调用方

##### A1 建议提交切片

按个人项目节奏，建议切成 3 个 commit 就够：

1. `feat(asset-picker): normalize asset selection result`
2. `refactor(asset-picker): extract shared picker scene and workspace`
3. `refactor(chat-compose): consume unified asset picker selection`

不要在 A1 里顺手做这些事：

- 上传流程统一
- 资源中心保存聊天附件目标目录选择
- 资产卡片视觉统一
- 新增系统资源复杂权限过滤

##### A1 验收清单

自动化至少补到以下层级：

- adapter 单测：标准化普通文件、图片、视频、缺失 `asset_reference_id` 的异常路径
- scene 单测：目录加载、搜索、可选判断、单选结果返回
- chat composer 单测：从统一 selection 插入 composer token

人工回归至少覆盖：

- 在聊天中打开资源选择器并插入已有文件
- 搜索一个已有文件并插入聊天输入框
- 目录项可以进入但不能误选
- 无 `asset_reference_id` 的文件不能被选择

##### A1 完成判断

A1 完成的判断标准不是“所有资产入口都统一”，而是下面四条同时成立：

- 聊天侧不再独占一套资源选择数据协议
- picker 有明确场景输入和标准输出
- 标准化结果不再依赖 chat 私有 payload 结构
- 后续 A2 可以直接复用 A1 的 selection 模型继续做预览统一

#### A2. 统一资产预览与元信息展示的最小集合

当前状态：未开始

下一步：

- 先定义 picker、聊天发送前预览、资源中心列表可共用的字段模型
- 再决定是否抽独立 asset card / file card 组件

目标：

- 给 picker 和消息发送侧共用一套最小预览模型
- 避免同一个资源在聊天、资源中心、上传完成提示里展示字段不一致

建议产出：

- 统一的 asset card / file card 最小展示字段
- 明确文件图标、文件大小、来源、资源状态的展示规则

验收标准：

- 图片和文件至少能在 picker、聊天发送前预览、资源中心列表三处共用同一套字段模型
- 不再新增第三套只服务单页的资产展示结构

### Phase B: 上传链路再收口

这一阶段的目标不是重写上传，而是把“上传完成后如何变成可复用资产”再做干净一点。

#### B1. 明确 upload 和 asset reference 的职责边界

当前状态：进行中

已落地：

- chunked upload 的 realtime 订阅已从 `fileUploader` 内联逻辑抽到 `uploadRealtimeRuntime`
- 上传目录选择已可复用统一 picker 主体，不再只靠上传页独立 modal 流程

下一步：

- 为上传完成结果补一层更显式的资产结果协议
- 把页面层对上传模式差异的感知继续往 util / scene 层下沉

目标：

- 把“上传传输成功”和“资产可被业务引用”这两个概念彻底拆开
- 减少页面层直接感知分片、合并、轮询、订阅细节的地方

建议产出：

- 一份简短设计说明，定义 upload task、file entry、asset reference 三者关系
- 前端统一通过较薄的资产上传入口获取结果，而不是分别处理 small file / chunked / merge realtime

优先检查位置：

- [src/utils/fileUploader.ts](src/utils/fileUploader.ts)
- [src/utils/uploadRealtimeRuntime.ts](src/utils/uploadRealtimeRuntime.ts)
- [src/views/FileManage/index.vue](src/views/FileManage/index.vue)
- [src/views/Chat/components/MessageWorkspace.vue](src/views/Chat/components/MessageWorkspace.vue)

验收标准：

- 页面层不再关心上传模式差异
- 上传完成后统一返回可直接进入聊天/资源中心的资产结果结构
- 上传失败、合并失败、订阅失败的错误文案保持一致

#### B2. 收口聊天附件发送前的资产准备流程

当前状态：未开始

下一步：

- 明确“选已有资产”和“上传后拿到资产”的统一输入结构
- 把聊天附件消息 payload 组装收口到单一入口

目标：

- 把“选文件 -> 上传 -> 生成消息 payload -> 发消息”拆成更稳定的两段
- 让后续 richer media 只扩展消息构造，不重复改上传流程

建议产出：

- 一个面向聊天的 asset prepare 层
- 统一消息附件 payload 的组装入口

验收标准：

- 图片、普通文件、聊天记录转发至少共享同一层消息前置准备逻辑
- 发送失败时，本地失败态和后台回执错误能对齐

### Phase C: assets 域后端边界预收口

这一阶段只做“边界清理”和“迁移准备”，不要在首批里做大规模目录搬迁。

#### C1. 继续瘦身 hyself/views.py

当前状态：未开始

下一步：

- 先选 1 到 2 条资源中心最重的读接口做 query/service 下沉试点
- 每次保持一条完整闭环，避免大范围重写

目标：

- 把剩余查询编排继续下沉到 query/service
- 让 `hyself/views.py` 更接近接口装配层，而不是继续堆业务判断

建议做法：

- 先挑 1 到 2 条最重的资源中心读接口处理
- 每次只挪一个清晰闭环，不做一口气全量重写

验收标准：

- 至少有一组资源中心接口不再在 view 中直接拼主要业务数据
- 不引入新的兼容壳或跨层回流

#### C2. 预留 assets 域目录和命名约定

当前状态：未开始

下一步：

- 先出一份轻量命名约定，约束新增资源/资产代码不要继续落到模糊目录
- 等 C1 有第一轮下沉结果后，再确定第二批目录迁移范围

目标：

- 在不大迁移的前提下，先把未来 assets 域的落点定义出来
- 避免后续继续把资源相关逻辑散落进 `hyself`、`upload`、`utils`

建议产出：

- 一份简单目录约定说明
- 新增代码优先落到更清晰的 assets 相关位置

验收标准：

- 首批新增的资源/资产相关 service、query、serializer helper 不再继续加到模糊位置
- 后续第二批迁移时不需要重新命名一遍所有概念

## 推荐执行顺序

对于个人项目，推荐严格串行，不建议并行开太多支线：

1. A1 统一资产选择器交互边界
2. A2 统一资产预览最小模型
3. B1 明确 upload / asset reference 边界
4. B2 收口聊天附件发送前准备流程
5. C1 瘦身 `hyself/views.py` 的一组重接口
6. C2 预留 assets 域目录和命名约定

这个顺序的原因很直接：先把前端入口统一，后面的上传和后端边界才能围绕同一套资产模型继续推进。

## 建议下一批动作

1. 收尾 A1：把聊天附件入口与“保存到资源中心”入口统一到同一套 picker 协议
2. 推进 B1：定义上传完成后的统一资产结果结构，并替换页面层直连上传模式差异的逻辑
3. 启动 A2：补一份最小资产预览字段模型，避免后面继续新增第三套展示结构
4. 选定 C1 的第一组后端接口，单独开一轮 query/service 下沉

## 每项任务的完成定义

个人项目阶段建议不用写过重流程，但至少保持以下完成定义：

- 有明确范围边界，知道这次不做什么
- 有对应自动化验证，或至少补一条人工回归清单
- 有一条文档记录，说明新边界和后续承接点
- 不留下“临时过渡但没人记得”的匿名逻辑

## 首批任务之外的第二优先级候选

如果首批推进顺畅，再考虑下面几项：

- 搜索/审核链路的 moderation 规则继续细化
- capability 共享语义继续收口
- 浏览器回归接入 CI
- 更丰富的媒体消息能力

## 相关文档

- [v2_1-closeout-summary.md](v2_1-closeout-summary.md)
- [v2-closeout-checklist.md](v2-closeout-checklist.md)
- [resource-center-realtime-event-contract.md](../assets/resource-center-realtime-event-contract.md)
- [v2_1-realtime-refactor-checklist.md](v2_1-realtime-refactor-checklist.md)
