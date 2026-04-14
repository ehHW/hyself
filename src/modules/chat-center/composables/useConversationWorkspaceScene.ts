import { computed } from 'vue'
import { useChatCapabilityScene } from '@/modules/chat-center/composables/useChatCapabilityScene'
import type { ChatMessageItem } from '@/types/chat'
import { useChatShell } from '@/views/Chat/useChatShell'
import { useUserStore } from '@/stores/user'

export function useConversationWorkspaceScene() {
    const userStore = useUserStore()
    const { chatStore, formatDateTime } = useChatShell()
    const {
        activeConversationCapabilities,
        canAddFriend,
        canCreateFolderInResource,
        canDeleteAnyMessage,
        canDeleteFriend,
        canForwardMessage,
        canPinConversation,
        canRestoreRevokedDraft,
        canRevokeAnyMessage,
        canSaveChatAttachmentToResource,
        canSendAttachment,
        canSendTextMessage,
    } = useChatCapabilityScene()

    const chatConversationState = chatStore.state.conversationState
    const chatFriendshipState = chatStore.state.friendshipState
    const chatGroupState = chatStore.state.groupState

    const availableInviteFriends = computed(() => {
        const currentMembers = new Set(chatGroupState.activeMembers.map((item) => item.user.id))
        return chatFriendshipState.friends.filter((item) => !currentMembers.has(item.friend_user.id))
    })

    const currentConversationMember = computed(() => {
        const currentUserId = userStore.user?.id
        if (!currentUserId) {
            return null
        }
        return chatGroupState.activeMembers.find((member) => member.user.id === currentUserId) || null
    })

    const canInviteGroupMembers = computed(() => {
        const conversation = chatConversationState.activeConversation
        if (conversation?.type !== 'group') {
            return false
        }
        return activeConversationCapabilities.value.canInviteMembers
    })

    const composerDisabled = computed(() => !activeConversationCapabilities.value.canSendMessage || !canSendTextMessage.value)

    const composerBlockedReason = computed(() => {
        const conversation = chatConversationState.activeConversation
        if (!conversation) {
            return ''
        }
        if (!canSendTextMessage.value) {
            return '当前角色无发送消息权限'
        }
        if (activeConversationCapabilities.value.canSendMessage) {
            return ''
        }
        if (conversation.access_mode === 'former_member_readonly') {
            return '你不是该群成员，当前仅可查看历史消息'
        }
        if (conversation.type === 'group') {
            const selfMember = currentConversationMember.value
            if (selfMember?.mute_until && new Date(selfMember.mute_until).getTime() > Date.now()) {
                return `您已被禁言至 ${formatDateTime(selfMember.mute_until)}`
            }
            if (conversation.group_config?.mute_all && !activeConversationCapabilities.value.canManageGroupSettings) {
                return '全员禁言中...'
            }
        }
        return '当前会话暂不可发送消息'
    })

    const directTargetUser = computed(() => {
        if (chatConversationState.activeConversation?.type !== 'direct') {
            return null
        }
        if (chatConversationState.activeConversation.direct_target?.id) {
            return chatConversationState.activeConversation.direct_target
        }
        return (
            chatFriendshipState.friends.find((item) => item.direct_conversation?.id === chatConversationState.activeConversation?.id)?.friend_user || null
        )
    })

    const currentFriendship = computed(() => {
        if (chatConversationState.activeConversation?.type !== 'direct') {
            return null
        }
        return chatFriendshipState.friends.find((item) => item.direct_conversation?.id === chatConversationState.activeConversation?.id) || null
    })

    const isSelfDirectConversation = computed(() => {
        if (chatConversationState.activeConversation?.type !== 'direct') {
            return false
        }
        const currentUserId = userStore.user?.id
        if (!currentUserId) {
            return false
        }
        if (chatConversationState.activeConversation.direct_target?.id === currentUserId) {
            return true
        }
        return chatConversationState.activeConversation.member_count === 1
    })

    const isDirectFriend = computed(() => {
        if (!chatConversationState.activeConversation || chatConversationState.activeConversation.type !== 'direct') {
            return false
        }
        if (isSelfDirectConversation.value) {
            return true
        }
        return chatFriendshipState.friends.some((item) => item.direct_conversation?.id === chatConversationState.activeConversation?.id)
    })

    const showDirectActions = computed(
        () =>
            chatConversationState.activeConversation?.type === 'direct' &&
            activeConversationCapabilities.value.canOpenConversation &&
            !isDirectFriend.value &&
            canAddFriend.value &&
            Boolean(directTargetUser.value),
    )
    const showSettingsTrigger = computed(() => Boolean(chatConversationState.activeConversation && activeConversationCapabilities.value.canMarkRead))
    const settingsDrawerTitle = computed(() => (chatConversationState.activeConversation?.type === 'group' ? '群聊设置' : '会话设置'))
    const directConversationTitle = computed(
        () =>
            currentFriendship.value?.remark ||
            directTargetUser.value?.display_name ||
            directTargetUser.value?.username ||
            chatConversationState.activeConversation?.name ||
            '私聊',
    )

    return {
        availableInviteFriends,
        canAddFriend,
        canCreateFolderInResource,
        canDeleteAnyMessage,
        canDeleteFriend,
        canForwardMessage,
        canInviteGroupMembers,
        canManageGroupPermission: computed(() => activeConversationCapabilities.value.canManageGroupSettings),
        canPinConversationPermission: canPinConversation,
        canRestoreRevokedDraft,
        canRevokeAnyMessage,
        canSaveChatAttachmentToResource,
        canSendAttachment,
        canSendTextMessage,
        composerBlockedReason,
        composerDisabled,
        currentConversationMember,
        currentFriendship,
        directConversationTitle,
        directTargetUser,
        isDirectFriend,
        isSelfDirectConversation,
        settingsDrawerTitle,
        showDirectActions,
        showSettingsTrigger,
    }
}