import type { Ref } from 'vue'
import { getGroupJoinRequestsApi } from '@/api/chat'
import { loadJoinRequestsAction, loadMembersAction } from '@/stores/chat/groupActions'
import { disbandGroupConversationScene, handleJoinRequestScene, inviteMemberScene, leaveConversationScene, muteMemberScene, removeMemberScene, transferGroupOwnerScene, updateMemberRoleScene } from '@/stores/chat/groupScenes'
import type { ChatConversationItem, ChatConversationMemberItem, ChatGroupJoinRequestItem } from '@/types/chat'

export function createGroupOrchestration(deps: {
    canLoadGlobalGroupJoinRequests: () => boolean
    globalGroupJoinRequests: Ref<ChatGroupJoinRequestItem[]>
    conversations: Ref<ChatConversationItem[]>
    memberMap: Record<number, ChatConversationMemberItem[]>
    joinRequestMap: Record<number, ChatGroupJoinRequestItem[]>
    loadConversations: () => Promise<void>
    loadContactGroupConversations: () => Promise<void>
}) {
    const loadGlobalGroupJoinRequests = async () => {
        if (!deps.canLoadGlobalGroupJoinRequests()) {
            deps.globalGroupJoinRequests.value = []
            return
        }
        const { data } = await getGroupJoinRequestsApi({ status: 'pending' })
        deps.globalGroupJoinRequests.value = data.results
    }

    const loadMembers = async (conversationId: number) => {
        await loadMembersAction({ conversationId, conversations: deps.conversations, memberMap: deps.memberMap })
    }

    const loadJoinRequests = async (conversationId: number) => {
        await loadJoinRequestsAction(deps.joinRequestMap, conversationId)
    }

    const inviteMember = async (conversationId: number, targetUserId: number) => {
        await inviteMemberScene({
            conversationId,
            targetUserId,
            loadMembers,
            loadJoinRequests,
            loadConversations: deps.loadConversations,
            loadContactGroupConversations: deps.loadContactGroupConversations,
        })
    }

    const removeMember = async (conversationId: number, userId: number) => {
        await removeMemberScene({ conversationId, userId, loadMembers, loadConversations: deps.loadConversations, loadContactGroupConversations: deps.loadContactGroupConversations })
    }

    const updateMemberRole = async (conversationId: number, userId: number, role: 'admin' | 'member') => {
        await updateMemberRoleScene({ conversationId, userId, role, loadMembers })
    }

    const muteMember = async (conversationId: number, userId: number, muteMinutes: number, reason?: string) => {
        await muteMemberScene({ conversationId, userId, muteMinutes, reason, loadMembers })
    }

    const leaveConversation = async (conversationId: number) => {
        await leaveConversationScene({ conversationId, loadConversations: deps.loadConversations, loadContactGroupConversations: deps.loadContactGroupConversations })
    }

    const transferOwner = async (conversationId: number, targetUserId: number) => {
        await transferGroupOwnerScene({
            conversationId,
            targetUserId,
            loadMembers,
            loadConversations: deps.loadConversations,
            loadContactGroupConversations: deps.loadContactGroupConversations,
        })
    }

    const disbandConversation = async (conversationId: number) => {
        await disbandGroupConversationScene({
            conversationId,
            loadConversations: deps.loadConversations,
            loadContactGroupConversations: deps.loadContactGroupConversations,
        })
    }

    const handleJoinRequest = async (requestId: number, action: 'approve' | 'reject' | 'cancel', conversationId: number) => {
        await handleJoinRequestScene({ requestId, action, conversationId, loadJoinRequests, loadMembers, loadConversations: deps.loadConversations })
    }

    return {
        loadGlobalGroupJoinRequests,
        loadMembers,
        loadJoinRequests,
        inviteMember,
        removeMember,
        updateMemberRole,
        muteMember,
        leaveConversation,
        transferOwner,
        disbandConversation,
        handleJoinRequest,
    }
}