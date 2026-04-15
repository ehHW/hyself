import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

const dialogPropsSpy = vi.hoisted(() => vi.fn())

vi.mock('@/components/assets/AssetPickerDialog.vue', () => ({
    default: defineComponent({
        name: 'AssetPickerDialogStub',
        props: {
            open: { type: Boolean, required: true },
            parentId: { type: Number, default: null },
            ownerUserId: { type: Number, default: null },
            scene: { type: Object, default: undefined },
            scope: { type: String, default: 'user' },
            virtualPath: { type: String, default: null },
        },
        setup(props) {
            dialogPropsSpy(props)
            return () => h('div')
        },
    }),
}))

import SystemResourcePickerDialog from '@/components/assets/SystemResourcePickerDialog.vue'

describe('SystemResourcePickerDialog', () => {
    beforeEach(() => {
        dialogPropsSpy.mockClear()
    })

    it('uses system scope and the system-resource dialog scene by default', () => {
        mount(SystemResourcePickerDialog, {
            props: {
                open: true,
                parentId: 12,
                ownerUserId: 34,
                virtualPath: 'system/assets',
            },
        })

        const props = dialogPropsSpy.mock.calls.at(-1)?.[0]
        expect(props).toMatchObject({
            open: true,
            parentId: 12,
            ownerUserId: 34,
            scope: 'system',
            virtualPath: 'system/assets',
        })
        expect(props.scene).toMatchObject({
            title: '选择系统资源文件',
            workspace: {
                banner: {
                    message: '从系统资源中选择文件',
                },
            },
        })
    })
})