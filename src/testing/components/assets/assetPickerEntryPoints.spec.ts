import { describe, expect, it } from 'vitest'
import {
    createEmbeddedSystemResourcePickerWorkspaceSession,
} from '@/components/assets/assetPickerEntryPoints'
import {
    SYSTEM_RESOURCE_EMBEDDED_ASSET_PICKER_SCENE,
} from '@/components/assets/assetPickerScenes'

describe('embedded asset picker entry points', () => {
    it('creates an embedded system-resource workspace session', () => {
        const session = createEmbeddedSystemResourcePickerWorkspaceSession({
            initialParentId: 12,
            initialOwnerUserId: 34,
            initialVirtualPath: 'system/assets',
        })

        expect(session.title).toBe('系统资源选择模式')
        expect(session.scope).toBe('system')
        expect(session.initialParentId).toBe(12)
        expect(session.initialOwnerUserId).toBe(34)
        expect(session.initialVirtualPath).toBe('system/assets')
        expect(session.workspaceScene).toBe(
            SYSTEM_RESOURCE_EMBEDDED_ASSET_PICKER_SCENE,
        )
    })

    it('allows callers to override system-resource workspace copy and scene', () => {
        const workspaceScene = {
            text: {
                rootBreadcrumbName: '系统资源根目录',
            },
        }

        const session = createEmbeddedSystemResourcePickerWorkspaceSession({
            title: '选择系统资料',
            description: '供其他页面复用的系统资源入口。',
            workspaceScene,
        })

        expect(session.title).toBe('选择系统资料')
        expect(session.description).toBe('供其他页面复用的系统资源入口。')
        expect(session.workspaceScene).toBe(workspaceScene)
    })
})