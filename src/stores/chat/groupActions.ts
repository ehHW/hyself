import type { Ref } from 'vue'
import {
    disbandGroupConversationApi,
    getConversationMembersApi,
    getGroupJoinRequestsApi,
    handleGroupJoinRequestApi,
    inviteConversationMemberApi,
    leaveConversationApi,
    muteConversationMemberApi,
    removeConversationMemberApi,
    transferGroupOwnerApi,
    updateConversationMemberRoleApi,
    updateConversationPreferenceApi,
    updateGroupConfigApi,
} from '@/api/chat'
import type { ChatConversationItem, ChatConversationMemberItem, ChatGroupJoinRequestItem } from '@/types/chat'

export async function loadMembersAction(options: {
    conversationId: number
    conversations: Ref<ChatConversationItem[]>
    memberMap: Record<number, ChatConversationMemberItem[]>
}) {
    const conversation = options.conversations.value.find((item) => item.id === options.conversationId)
    if (conversation?.type !== 'group') {
        options.memberMap[options.conversationId] = []
        return
    }
    const { data } = await getConversationMembersApi(options.conversationId)
    options.memberMap[options.conversationId] = data.items
}

export async function loadJoinRequestsAction(joinRequestMap: Record<number, ChatGroupJoinRequestItem[]>, conversationId: number) {
    const { data } = await getGroupJoinRequestsApi({ conversation_id: conversationId })
    joinRequestMap[conversationId] = data.results
}

export async function inviteMemberAction(conversationId: number, targetUserId: number) {
    await inviteConversationMemberApi(conversationId, targetUserId)
}

export async function removeMemberAction(conversationId: number, userId: number) {
    await removeConversationMemberApi(conversationId, userId)
}

export async function updateMemberRoleAction(conversationId: number, userId: number, role: 'admin' | 'member') {
    await updateConversationMemberRoleApi(conversationId, userId, role)
}

export async function muteMemberAction(conversationId: number, userId: number, muteMinutes: number, reason?: string) {
    await muteConversationMemberApi(conversationId, userId, muteMinutes, reason)
}

export async function leaveConversationAction(conversationId: number) {
    await leaveConversationApi(conversationId)
}

export async function transferGroupOwnerAction(conversationId: number, targetUserId: number) {
    await transferGroupOwnerApi(conversationId, targetUserId)
}

export async function disbandGroupConversationAction(conversationId: number) {
    await disbandGroupConversationApi(conversationId)
}

export async function handleJoinRequestAction(requestId: number, action: 'approve' | 'reject' | 'cancel') {
    await handleGroupJoinRequestApi(requestId, { action })
}

export async function updateGroupConfigAction(
    conversationId: number,
    payload: { name?: string; avatar?: string; join_approval_required?: boolean; allow_member_invite?: boolean; max_members?: number | null; mute_all?: boolean },
) {
    return updateGroupConfigApi(conversationId, payload)
}

export async function updateConversationPreferencesAction(conversationId: number, payload: { mute_notifications?: boolean; group_nickname?: string }) {
    return updateConversationPreferenceApi(conversationId, payload)
}