import type { FileManageScope } from '@/api/upload'
import {
    SYSTEM_RESOURCE_EMBEDDED_ASSET_PICKER_SCENE,
    type AssetPickerWorkspaceSceneInput,
} from '@/components/assets/assetPickerScenes'

export type EmbeddedAssetPickerWorkspaceSession = {
    title: string
    description: string
    scope: FileManageScope
    initialParentId?: number | null
    initialOwnerUserId?: number | null
    initialVirtualPath?: string | null
    workspaceScene: AssetPickerWorkspaceSceneInput
}

export function createEmbeddedSystemResourcePickerWorkspaceSession(options?: {
    title?: string
    description?: string
    initialParentId?: number | null
    initialOwnerUserId?: number | null
    initialVirtualPath?: string | null
    workspaceScene?: AssetPickerWorkspaceSceneInput
}): EmbeddedAssetPickerWorkspaceSession {
    return {
        title: options?.title ?? '系统资源选择模式',
        description:
            options?.description
            ?? '直接复用统一 AssetPickerWorkspace，在系统资源域里浏览、搜索并选中已有系统资源。',
        scope: 'system',
        initialParentId: options?.initialParentId ?? null,
        initialOwnerUserId: options?.initialOwnerUserId ?? null,
        initialVirtualPath: options?.initialVirtualPath ?? null,
        workspaceScene:
            options?.workspaceScene ?? SYSTEM_RESOURCE_EMBEDDED_ASSET_PICKER_SCENE,
    }
}