import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/stores/user', () => ({
    useUserStore: () => ({
        user: {
            id: 7,
            username: 'tester',
            display_name: '测试用户',
        },
    }),
}))

const capabilityState = {
    activeConversationCapabilities: {
        value: {
            canOpenConversation: true,
            canReadHistory: true,
            canSendMessage: false,
            canMarkRead: false,
            canViewMembers: false,
            canManageMembers: false,
            canManageGroupSettings: false,
            canInviteMembers: false,
            canJoinConversation: false,
        },
    },
    canAddFriend: { value: true },
    canCreateFolderInResource: { value: true },
    canDeleteAnyMessage: { value: true },
    canDeleteFriend: { value: true },
    canForwardMessage: { value: true },
    canPinConversation: { value: true },
    canRestoreRevokedDraft: { value: true },
    canRevokeAnyMessage: { value: true },
    canSaveChatAttachmentToResource: { value: true },
    canSendAttachment: { value: true },
    canSendTextMessage: { value: true },
}

const chatShellState = {
    formatDateTime: (value: string) => value,
    chatStore: {
        state: {
            conversationState: {
                activeConversation: {
                    id: 18,
                    type: 'group',
                    access_mode: 'former_member_readonly',
                    can_send_message: false,
                    group_config: { mute_all: false, allow_member_invite: false },
                    member_count: 3,
                    name: '只读群',
                } as any,
            },
            friendshipState: {
                friends: [
                    {
                        friend_user: { id: 10, display_name: '好友', username: 'friend', avatar: '' },
                        direct_conversation: { id: 99 },
                        remark: '老友',
                    },
                ],
            },
            groupState: {
                activeMembers: [
                    {
                        user: { id: 7, display_name: '测试用户', username: 'tester', avatar: '' },
                        mute_until: null,
                    },
                ],
            },
        },
    },
}

vi.mock('@/modules/chat-center/composables/useChatCapabilityScene', () => ({
    useChatCapabilityScene: () => capabilityState,
}))

vi.mock('@/views/Chat/useChatShell', () => ({
    useChatShell: () => chatShellState,
}))

describe('useConversationWorkspaceScene', () => {
    beforeEach(() => {
        chatShellState.chatStore.state.conversationState.activeConversation = {
            id: 18,
            type: 'group',
            access_mode: 'former_member_readonly',
            can_send_message: false,
            group_config: { mute_all: false, allow_member_invite: false },
            member_count: 3,
            name: '只读群',
        }
        capabilityState.activeConversationCapabilities.value = {
            canOpenConversation: true,
            canReadHistory: true,
            canSendMessage: false,
            canMarkRead: false,
            canViewMembers: false,
            canManageMembers: false,
            canManageGroupSettings: false,
            canInviteMembers: false,
            canJoinConversation: false,
        }
        capabilityState.canSendTextMessage.value = true
        vi.clearAllMocks()
    })

    it('derives readonly composer state from capability flags', async () => {
        const { useConversationWorkspaceScene } = await import('@/modules/chat-center/composables/useConversationWorkspaceScene')
        const scene = useConversationWorkspaceScene()

        expect(scene.composerDisabled.value).toBe(true)
        expect(scene.composerBlockedReason.value).toBe('你不是该群成员，当前仅可查看历史消息')
        expect(scene.showSettingsTrigger.value).toBe(false)
        expect(scene.canInviteGroupMembers.value).toBe(false)
    })

    it('enables direct actions when capability allows open and target is not already friend', async () => {
        chatShellState.chatStore.state.conversationState.activeConversation = {
            id: 42,
            type: 'direct',
            access_mode: 'member',
            can_send_message: true,
            direct_target: { id: 11, display_name: '陌生人', username: 'new', avatar: '' },
            member_count: 2,
            name: '陌生人',
        }
        capabilityState.activeConversationCapabilities.value = {
            canOpenConversation: true,
            canReadHistory: true,
            canSendMessage: true,
            canMarkRead: true,
            canViewMembers: false,
            canManageMembers: false,
            canManageGroupSettings: false,
            canInviteMembers: false,
            canJoinConversation: false,
        }
        const { useConversationWorkspaceScene } = await import('@/modules/chat-center/composables/useConversationWorkspaceScene')
        const scene = useConversationWorkspaceScene()

        expect(scene.showDirectActions.value).toBe(true)
        expect(scene.composerDisabled.value).toBe(false)
    })
})