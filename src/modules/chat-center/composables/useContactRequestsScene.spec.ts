import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('ant-design-vue', () => ({
    message: {
        error: vi.fn(),
        success: vi.fn(),
    },
}))

const loadFriendRequests = vi.fn(async () => undefined)
const handleFriendRequest = vi.fn(async () => undefined)
const markPendingRequestsSeen = vi.fn()

const shellState = {
    chatStore: {
        state: {
            friendshipState: {
                receivedRequests: [{ id: 1, status: 'pending' }],
                sentRequests: [],
            },
        },
        friendship: {
            loadFriendRequests,
            handleFriendRequest,
            markPendingRequestsSeen,
        },
    },
    formatDateTime: (value: string) => value,
}

vi.mock('@/views/Chat/useChatShell', () => ({
    useChatShell: () => shellState,
}))

describe('useContactRequestsScene', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        shellState.chatStore.state.friendshipState.receivedRequests = [{ id: 1, status: 'pending' }]
    })

    async function mountScene() {
        const { useContactRequestsScene } = await import('@/modules/chat-center/composables/useContactRequestsScene')
        let scene: ReturnType<typeof useContactRequestsScene>
        const wrapper = mount(defineComponent({
            setup() {
                scene = useContactRequestsScene()
                return () => null
            },
        }))
        await nextTick()
        return { wrapper, scene: scene! }
    }

    it('marks pending request ids as seen and loads requests on mount', async () => {
        const { wrapper } = await mountScene()

        expect(markPendingRequestsSeen).toHaveBeenCalledWith([1])
        expect(loadFriendRequests).toHaveBeenCalledOnce()

        wrapper.unmount()
    })

    it('delegates accept action to friendship store', async () => {
        const { wrapper, scene } = await mountScene()

        await scene.handleRequestAction(1, 'accept')

        expect(handleFriendRequest).toHaveBeenCalledWith(1, 'accept')

        wrapper.unmount()
    })
})