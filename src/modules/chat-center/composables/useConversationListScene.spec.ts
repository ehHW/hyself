import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

vi.mock('ant-design-vue', () => ({
    message: {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
    },
}))

vi.mock('@/api/chat', () => ({
    applyGroupInvitationApi: vi.fn(async () => ({
        data: {
            detail: '申请已提交',
            mode: 'pending_approval',
        },
    })),
    searchChatApi: vi.fn(async () => ({
        data: {
            keyword: '群',
            conversations: [],
            users: [],
            messages: [],
        },
    })),
}))

vi.mock('@/modules/chat-center/composables/useChatCapabilityScene', () => ({
    useChatCapabilityScene: () => ({
        canAddFriend: { value: true },
        canCreateGroup: { value: true },
        canHideConversation: { value: true },
        canPinConversation: { value: true },
    }),
}))

vi.mock('vue-router', () => ({
    useRoute: () => ({ name: 'ChatMessages' }),
    useRouter: () => ({ push: vi.fn(async () => undefined) }),
}))

const selectConversation = vi.fn(async () => undefined)
const loadConversations = vi.fn(async () => undefined)
const loadContactGroupConversations = vi.fn(async () => undefined)
const openDirectConversation = vi.fn(async () => undefined)
const submitFriendRequest = vi.fn(async () => undefined)

vi.mock('@/views/Chat/useChatShell', () => ({
    useChatShell: () => ({
        avatarStyle: vi.fn(),
        avatarText: vi.fn(),
        formatShortTime: vi.fn(),
        isStealthAuditEnabled: { value: false },
        chatStore: {
            state: {
                conversationState: {
                    activeConversationId: 1,
                    conversations: [
                        {
                            id: 1,
                            type: 'group',
                            access_mode: 'member',
                            member_settings: {},
                            unread_count: 0,
                        },
                    ],
                    contactGroupConversations: [],
                },
                friendshipState: {
                    friends: [
                        {
                            friend_user: { id: 9, username: 'friend', display_name: '现有好友', avatar: '' },
                            direct_conversation: { id: 18, show_in_list: true },
                            remark: '',
                        },
                    ],
                },
            },
            conversation: {
                selectConversation,
                loadConversations,
                loadContactGroupConversations,
                openDirectConversation,
                createGroupConversation: vi.fn(async () => undefined),
                hideConversation: vi.fn(async () => undefined),
                toggleConversationPin: vi.fn(async () => undefined),
            },
            friendship: {
                submitFriendRequest,
                loadFriends: vi.fn(async () => undefined),
            },
            audit: {
                searchResult: {
                    conversations: [],
                    users: [],
                    messages: [],
                },
                clearSearchResult: vi.fn(),
                runSearch: vi.fn(async () => undefined),
            },
        },
    }),
}))

describe('useConversationListScene', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    async function mountScene() {
        const { useConversationListScene } = await import('@/modules/chat-center/composables/useConversationListScene')
        let scene: ReturnType<typeof useConversationListScene>
        const wrapper = mount(defineComponent({
            setup() {
                scene = useConversationListScene()
                return () => null
            },
        }))
        await nextTick()
        return { wrapper, scene: scene! }
    }

    it('prefers capability flags when deciding group action label', async () => {
        const { wrapper, scene } = await mountScene()

        expect(
            scene.getGroupSearchActionLabel({
                id: 22,
                type: 'group',
                name: '待申请群',
                access_mode: 'discover_preview',
                capabilities: {
                    can_view: true,
                    can_open: false,
                    can_read_history: false,
                    can_send_message: false,
                    can_mark_read: false,
                    can_view_members: false,
                    can_manage_members: false,
                    can_manage_group_settings: false,
                    can_invite_members: false,
                    can_join: true,
                },
            }),
        ).toBe('申请加入')

        wrapper.unmount()
    })

    it('submits join application when capability disallows open but allows join', async () => {
        const { applyGroupInvitationApi } = await import('@/api/chat')
        const { wrapper, scene } = await mountScene()

        await scene.handleGroupSearchAction({
            id: 22,
            type: 'group',
            name: '待申请群',
            access_mode: 'discover_preview',
            capabilities: {
                can_view: true,
                can_open: false,
                can_read_history: false,
                can_send_message: false,
                can_mark_read: false,
                can_view_members: false,
                can_manage_members: false,
                can_manage_group_settings: false,
                can_invite_members: false,
                can_join: true,
            },
        })
        await nextTick()

        expect(applyGroupInvitationApi).toHaveBeenCalledWith({ conversation_id: 22 })
        expect(loadConversations).toHaveBeenCalledOnce()
        expect(loadContactGroupConversations).toHaveBeenCalledOnce()
        expect(selectConversation).not.toHaveBeenCalled()

        wrapper.unmount()
    })

    it('hides add-friend action for existing friends but keeps it for strangers', async () => {
        const { wrapper, scene } = await mountScene()

        expect(
            scene.shouldShowAddFriendAction({
                id: 9,
                username: 'friend',
                display_name: '现有好友',
                avatar: '',
                can_open_direct: true,
                direct_conversation: { id: 18, show_in_list: true },
            }),
        ).toBe(false)

        expect(
            scene.shouldShowAddFriendAction({
                id: 19,
                username: 'new-user',
                display_name: '陌生人',
                avatar: '',
                can_open_direct: true,
                direct_conversation: null,
            }),
        ).toBe(true)

        wrapper.unmount()
    })

    it('preserves synthesized stealth direct titles with nicknames', async () => {
        const { wrapper, scene } = await mountScene()

        expect(scene.conversationDisplayName({
            id: 31,
            type: 'direct',
            name: 'user_a(阿甲)和user_b(阿乙)的私聊会话',
            avatar: '',
            direct_target: null,
            friend_remark: null,
            is_pinned: false,
            access_mode: 'stealth_readonly',
            member_role: null,
            show_in_list: true,
            unread_count: 0,
            last_message_preview: '',
            last_message_at: null,
            member_count: 2,
            can_send_message: false,
            status: 'active',
            last_read_sequence: 0,
            member_settings: { mute_notifications: false, group_nickname: '' },
            group_config: null,
            owner: null,
        })).toBe('user_a(阿甲)和user_b(阿乙)的私聊会话')

        wrapper.unmount()
    })
})