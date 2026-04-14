import { computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'

export function useChatCapabilityScene() {
    const userStore = useUserStore()
    const chatStore = useChatStore()
    const activeConversation = computed(() => chatStore.state.conversationState.activeConversation)

    const canCreateGroup = computed(() => userStore.hasPermission('chat.create_group'))
    const canAddFriend = computed(() => userStore.hasPermission('chat.add_friend'))
    const canDeleteFriend = computed(() => userStore.hasPermission('chat.delete_friend'))
    const canHideConversation = computed(() => userStore.hasPermission('chat.hide_conversation'))
    const canManageGroup = computed(() => userStore.hasPermission('chat.manage_group'))
    const canPinConversation = computed(() => userStore.hasPermission('chat.pin_conversation'))
    const canSendTextMessage = computed(() => userStore.hasPermission('chat.send_message'))
    const canSendAttachment = computed(() => userStore.hasPermission('chat.send_attachment'))
    const canForwardMessage = computed(() => userStore.hasPermission('chat.forward_message'))
    const canDeleteAnyMessage = computed(() => userStore.hasPermission('chat.delete_message'))
    const canRevokeAnyMessage = computed(() => userStore.hasPermission('chat.revoke_message'))
    const canRestoreRevokedDraft = computed(() => userStore.hasPermission('chat.restore_revoked_message'))
    const canSaveChatAttachmentToResource = computed(() => userStore.hasPermission('file.save_chat_attachment'))
    const canCreateFolderInResource = computed(() => userStore.hasPermission('file.create_folder'))
    const canReviewAllMessages = computed(() => userStore.hasPermission('chat.review_all_messages'))

    const activeConversationCapabilities = computed(() => {
        const conversation = activeConversation.value
        const capabilities = conversation?.capabilities
        return {
            canOpenConversation: Boolean(capabilities?.can_open ?? (conversation && conversation.access_mode !== 'discover_preview')),
            canReadHistory: Boolean(capabilities?.can_read_history ?? (conversation && conversation.access_mode !== 'discover_preview')),
            canSendMessage: Boolean(capabilities?.can_send_message ?? conversation?.can_send_message),
            canMarkRead: Boolean(capabilities?.can_mark_read ?? (conversation?.access_mode === 'member')),
            canViewMembers: Boolean(capabilities?.can_view_members ?? (conversation?.access_mode === 'member')),
            canManageMembers: Boolean(capabilities?.can_manage_members ?? ['owner', 'admin'].includes(conversation?.member_role || '')),
            canManageGroupSettings: Boolean(capabilities?.can_manage_group_settings ?? (conversation?.type === 'group' && conversation.member_role === 'owner')),
            canInviteMembers: Boolean(capabilities?.can_invite_members ?? (conversation?.access_mode === 'member' && (['owner', 'admin'].includes(conversation?.member_role || '') || conversation?.group_config?.allow_member_invite))),
            canJoinConversation: Boolean(capabilities?.can_join),
        }
    })

    return {
        activeConversation,
        activeConversationCapabilities,
        canAddFriend,
        canCreateFolderInResource,
        canCreateGroup,
        canDeleteAnyMessage,
        canDeleteFriend,
        canForwardMessage,
        canHideConversation,
        canManageGroup,
        canPinConversation,
        canRestoreRevokedDraft,
        canReviewAllMessages,
        canRevokeAnyMessage,
        canSaveChatAttachmentToResource,
        canSendAttachment,
        canSendTextMessage,
    }
}