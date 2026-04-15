import { describe, expect, it } from 'vitest'
import {
    CHAT_ATTACHMENT_ASSET_PICKER_SCENE,
    RESOURCE_CENTER_EMBEDDED_ASSET_PICKER_SCENE,
    SYSTEM_RESOURCE_ASSET_PICKER_DIALOG_SCENE,
    SYSTEM_RESOURCE_EMBEDDED_ASSET_PICKER_SCENE,
    UPLOAD_TARGET_FOLDER_ASSET_PICKER_SCENE,
    resolveAssetPickerDialogScene,
    resolveAssetPickerWorkspaceScene,
} from '@/components/assets/assetPickerScenes'

describe('asset picker scenes', () => {
    it('locks chat attachment picker to resource-center files', () => {
        const scene = resolveAssetPickerDialogScene(
            CHAT_ATTACHMENT_ASSET_PICKER_SCENE,
        )

        expect(scene.workspace.picker.selectionMode).toBe('file')
        expect(scene.workspace.picker.allowedKinds).toEqual([
            'resource_center',
        ])
    })

    it('locks resource-center embedded picker to reusable resource file kinds', () => {
        const scene = resolveAssetPickerWorkspaceScene(
            RESOURCE_CENTER_EMBEDDED_ASSET_PICKER_SCENE,
        )

        expect(scene.picker.selectionMode).toBe('file')
        expect(scene.picker.allowedKinds).toEqual([
            'resource_center',
            'chat_attachment',
            'chat_upload',
        ])
    })

    it('defines system-resource picker as an explicit preset', () => {
        const scene = resolveAssetPickerWorkspaceScene(
            SYSTEM_RESOURCE_EMBEDDED_ASSET_PICKER_SCENE,
        )

        expect(scene.text.rootBreadcrumbName).toBe('系统文件')
        expect(scene.banner?.message).toBe('系统资源选择模式')
        expect(scene.picker.selectionMode).toBe('file')
        expect(scene.picker.allowedKinds).toEqual(['resource_center'])
    })

    it('defines system-resource dialog picker as a reusable modal preset', () => {
        const scene = resolveAssetPickerDialogScene(
            SYSTEM_RESOURCE_ASSET_PICKER_DIALOG_SCENE,
        )

        expect(scene.title).toBe('选择系统资源文件')
        expect(scene.workspace.banner?.message).toBe('从系统资源中选择文件')
        expect(scene.workspace.picker.selectionMode).toBe('file')
        expect(scene.workspace.picker.allowedKinds).toEqual([
            'resource_center',
        ])
    })

    it('keeps upload target picker on normal folders and supports picker overrides', () => {
        const scene = resolveAssetPickerWorkspaceScene(
            {
                text: {
                    selectActionText: '确认选择',
                },
            },
            UPLOAD_TARGET_FOLDER_ASSET_PICKER_SCENE,
        )

        expect(scene.picker.selectionMode).toBe('folder')
        expect(scene.picker.allowedKinds).toEqual(['directory'])
        expect(scene.text.selectActionText).toBe('确认选择')
    })
})