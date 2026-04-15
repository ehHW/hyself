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
    useRoute: () => ({ name: 'ChatContactsFriends' }),
    useRouter: () => ({ push: vi.fn(async () => undefined) }),
}))

vi.mock('@/modules/chat-center/composables/useChatCapabilityScene', () => ({
    useChatCapabilityScene: () => ({
        canAddFriend: { value: true },
        canManageGroup: { value: false },
    }),
}))

const loadFriends = vi.fn(async () => undefined)
const loadFriendRequests = vi.fn(async () => undefined)
const loadContactGroupConversations = vi.fn(async () => undefined)

vi.mock('@/views/Chat/useChatShell', () => ({
    useChatShell: () => ({
        chatStore: {
            state: {
                conversationState: {
                    contactGroupConversations: [],
                },
                friendshipState: {
                    friends: [
                        {
                            friend_user: { id: 7, username: 'friend', display_name: '现有好友', avatar: '' },
                            direct_conversation: { id: 12, show_in_list: true },
                            remark: '',
                        },
                    ],
                    unreadPendingFriendRequestCount: 0,
                    unreadFriendNoticeCount: 0,
                },
                groupState: {
                    globalGroupJoinRequests: [],
                    unreadGroupNoticeCount: 0,
                },
            },
            conversation: {
                loadContactGroupConversations,
                selectConversation: vi.fn(async () => undefined),
                openDirectConversation: vi.fn(async () => undefined),
            },
            friendship: {
                loadFriends,
                loadFriendRequests,
                submitFriendRequest: vi.fn(async () => undefined),
            },
            group: {
                loadGlobalGroupJoinRequests: vi.fn(async () => undefined),
            },
            audit: {
                searchResult: { users: [], conversations: [], messages: [] },
                clearSearchResult: vi.fn(),
                runSearch: vi.fn(async () => undefined),
            },
        },
    }),
}))

describe('useContactScene', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('hides add-friend action for existing friends', async () => {
        const { useContactScene } = await import('@/modules/chat-center/composables/useContactScene')
        let scene: ReturnType<typeof useContactScene>

        const wrapper = mount(defineComponent({
            setup() {
                scene = useContactScene()
                return () => null
            },
        }))

        await nextTick()

        expect(
            scene!.shouldShowAddFriendAction({
                id: 7,
                username: 'friend',
                display_name: '现有好友',
                avatar: '',
                can_open_direct: true,
                direct_conversation: { id: 12, show_in_list: true },
            }),
        ).toBe(false)

        expect(
            scene!.shouldShowAddFriendAction({
                id: 8,
                username: 'new-user',
                display_name: '陌生人',
                avatar: '',
                can_open_direct: true,
                direct_conversation: null,
            }),
        ).toBe(true)

        wrapper.unmount()
    })
})