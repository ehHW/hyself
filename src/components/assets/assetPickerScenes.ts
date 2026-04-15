import {
    resolveAssetPickerTextConfig,
    type AssetPickerAllowedKind,
    type AssetPickerSelectionMode,
    type AssetPickerTextConfig,
} from '@/components/assets/useAssetPickerScene'

export type AssetPickerWorkspaceBanner = {
    type?: 'success' | 'info' | 'warning' | 'error'
    showIcon?: boolean
    message: string
    description?: string
}

export type AssetPickerWorkspaceSceneInput = {
    banner?: AssetPickerWorkspaceBanner | null
    pageSize?: number
    picker?: {
        selectionMode?: AssetPickerSelectionMode
        allowedKinds?: AssetPickerAllowedKind[]
    }
    showRefresh?: boolean
    showSearch?: boolean
    text?: Partial<AssetPickerTextConfig>
}

export type ResolvedAssetPickerWorkspaceScene = {
    banner: AssetPickerWorkspaceBanner | null
    pageSize: number
    picker: {
        selectionMode: AssetPickerSelectionMode
        allowedKinds: AssetPickerAllowedKind[]
    }
    showRefresh: boolean
    showSearch: boolean
    text: AssetPickerTextConfig
}

export type AssetPickerDialogSceneInput = {
    title?: string
    width?: number
    workspace?: AssetPickerWorkspaceSceneInput
}

export type ResolvedAssetPickerDialogScene = {
    title: string
    width: number
    workspace: ResolvedAssetPickerWorkspaceScene
}

export const CHAT_ATTACHMENT_ASSET_PICKER_SCENE: AssetPickerDialogSceneInput = {
    title: '选择资源中心文件',
    width: 720,
    workspace: {
        banner: {
            type: 'info',
            showIcon: true,
            message: '从资源中心发送附件',
            description: '选择一个已有文件，直接发送到当前聊天会话；文件夹不能发送。',
        },
        pageSize: 10,
        picker: {
            selectionMode: 'file',
            allowedKinds: ['resource_center'],
        },
        showRefresh: true,
        showSearch: true,
    },
}

export const RESOURCE_CENTER_EMBEDDED_ASSET_PICKER_SCENE: AssetPickerWorkspaceSceneInput = {
    banner: {
        type: 'info',
        showIcon: true,
        message: '资源选择模式',
        description: '在当前资源域里浏览、搜索并选中已有资源，把统一结果交给上层调用方消费。',
    },
    pageSize: 6,
    picker: {
        selectionMode: 'file',
        allowedKinds: ['resource_center', 'chat_attachment', 'chat_upload'],
    },
    showRefresh: true,
    showSearch: true,
    text: {
        rootBreadcrumbName: '资源选择器',
        missingAssetReferenceMessage: '当前文件还没有可复用的资产引用，暂时不能作为选择结果',
    },
}

export const SYSTEM_RESOURCE_EMBEDDED_ASSET_PICKER_SCENE: AssetPickerWorkspaceSceneInput = {
    banner: {
        type: 'info',
        showIcon: true,
        message: '系统资源选择模式',
        description: '在系统资源域里浏览、搜索并选中已有系统资源，把统一结果交给上层调用方消费。',
    },
    pageSize: 6,
    picker: {
        selectionMode: 'file',
        allowedKinds: ['resource_center'],
    },
    showRefresh: true,
    showSearch: true,
    text: {
        rootBreadcrumbName: '系统文件',
        missingAssetReferenceMessage: '当前系统资源还没有可复用的资产引用，暂时不能作为选择结果',
    },
}

export const SYSTEM_RESOURCE_ASSET_PICKER_DIALOG_SCENE: AssetPickerDialogSceneInput = {
    title: '选择系统资源文件',
    width: 720,
    workspace: {
        ...SYSTEM_RESOURCE_EMBEDDED_ASSET_PICKER_SCENE,
        banner: {
            type: 'info',
            showIcon: true,
            message: '从系统资源中选择文件',
            description: '选择一个已有系统资源，直接把统一结果返回给当前调用方；文件夹不能发送或提交。',
        },
        pageSize: 10,
    },
}

export const UPLOAD_TARGET_FOLDER_ASSET_PICKER_SCENE: AssetPickerWorkspaceSceneInput = {
    banner: {
        type: 'info',
        showIcon: true,
        message: '上传目录选择',
        description: '从资源中心选择一个普通目录，作为当前上传批次的目标目录。',
    },
    pageSize: 8,
    picker: {
        selectionMode: 'folder',
        allowedKinds: ['directory'],
    },
    showRefresh: true,
    showSearch: true,
    text: {
        rootBreadcrumbName: '我的文件',
        selectActionText: '选中目录',
    },
}

export function resolveAssetPickerWorkspaceScene(
    scene?: AssetPickerWorkspaceSceneInput,
    baseScene?: AssetPickerWorkspaceSceneInput,
): ResolvedAssetPickerWorkspaceScene {
    return {
        banner: scene?.banner ?? baseScene?.banner ?? null,
        pageSize: scene?.pageSize ?? baseScene?.pageSize ?? 10,
        picker: {
            selectionMode:
                scene?.picker?.selectionMode ??
                baseScene?.picker?.selectionMode ??
                'file',
            allowedKinds:
                scene?.picker?.allowedKinds ??
                baseScene?.picker?.allowedKinds ??
                [],
        },
        showRefresh: scene?.showRefresh ?? baseScene?.showRefresh ?? true,
        showSearch: scene?.showSearch ?? baseScene?.showSearch ?? true,
        text: resolveAssetPickerTextConfig({
            ...(baseScene?.text || {}),
            ...(scene?.text || {}),
        }),
    }
}

export function resolveAssetPickerDialogScene(
    scene?: AssetPickerDialogSceneInput,
    baseScene: AssetPickerDialogSceneInput = CHAT_ATTACHMENT_ASSET_PICKER_SCENE,
): ResolvedAssetPickerDialogScene {
    return {
        title: scene?.title ?? baseScene.title ?? '选择资源',
        width: scene?.width ?? baseScene.width ?? 720,
        workspace: resolveAssetPickerWorkspaceScene(
            scene?.workspace,
            baseScene.workspace,
        ),
    }
}
