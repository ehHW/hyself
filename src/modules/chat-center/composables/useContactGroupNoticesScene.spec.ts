import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('ant-design-vue', () => ({
    message: {
        error: vi.fn(),
        success: vi.fn(),
    },
}))

vi.mock('vue-router', () => ({
    useRouter: () => ({
        push: vi.fn(async () => undefined),
    }),
}))

const loadGlobalGroupJoinRequests = vi.fn(async () => undefined)
const handleJoinRequest = vi.fn(async () => undefined)
const selectConversation = vi.fn(async () => undefined)
const markAllGroupNoticesSeen = vi.fn()
const capability = { value: false }
const groupState = {
    globalGroupJoinRequests: [],
    groupNoticeItems: [{ id: 'notice-1', conversation_id: 88, message: 'notice', created_at: '2026-04-13T00:00:00Z' }],
}

vi.mock('@/stores/chat/groupState', () => ({
    useGroupChatStore: () => ({
        markAllGroupNoticesSeen,
    }),
}))

vi.mock('@/modules/chat-center/composables/useChatCapabilityScene', () => ({
    useChatCapabilityScene: () => ({
        canManageGroup: capability,
    }),
}))

const shellState = {
    chatStore: {
        state: {
            groupState,
            conversationState: {
                conversations: [{ id: 88 }],
            },
        },
        group: {
            loadGlobalGroupJoinRequests,
            handleJoinRequest,
        },
        conversation: {
            selectConversation,
        },
    },
    formatDateTime: (value: string) => value,
}

vi.mock('@/views/Chat/useChatShell', () => ({
    useChatShell: () => shellState,
}))

describe('useContactGroupNoticesScene', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capability.value = false
    })

    async function mountScene() {
        const { useContactGroupNoticesScene } = await import('@/modules/chat-center/composables/useContactGroupNoticesScene')
        let scene: ReturnType<typeof useContactGroupNoticesScene>
        const wrapper = mount(defineComponent({
            setup() {
                scene = useContactGroupNoticesScene()
                return () => null
            },
        }))
        await nextTick()
        return { wrapper, scene: scene! }
    }

    it('does not load pending join requests when manage_group capability is absent', async () => {
        const { wrapper, scene } = await mountScene()

        expect(scene.canManageGroup.value).toBe(false)
        expect(loadGlobalGroupJoinRequests).not.toHaveBeenCalled()
        expect(markAllGroupNoticesSeen).toHaveBeenCalled()

        wrapper.unmount()
    })

    it('loads and handles join requests when manage_group capability is present', async () => {
        capability.value = true
        const { wrapper, scene } = await mountScene()

        expect(loadGlobalGroupJoinRequests).toHaveBeenCalledOnce()

        await scene.handleJoinRequestAction(11, 'approve', 88)

        expect(handleJoinRequest).toHaveBeenCalledWith(11, 'approve', 88)
        expect(loadGlobalGroupJoinRequests).toHaveBeenCalledTimes(2)

        wrapper.unmount()
    })
})