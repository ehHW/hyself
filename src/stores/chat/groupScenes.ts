import { handleJoinRequestAction } from '@/stores/chat/groupActions'
import { disbandGroupConversationAction, inviteMemberAction, leaveConversationAction, muteMemberAction, removeMemberAction, transferGroupOwnerAction, updateMemberRoleAction } from '@/stores/chat/groupActions'

export async function inviteMemberScene(options: {
    conversationId: number
    targetUserId: number
    loadMembers: (conversationId: number) => Promise<void>
    loadJoinRequests: (conversationId: number) => Promise<void>
    loadConversations: () => Promise<void>
    loadContactGroupConversations: () => Promise<void>
}) {
    await inviteMemberAction(options.conversationId, options.targetUserId)
    await Promise.all([
        options.loadMembers(options.conversationId),
        options.loadJoinRequests(options.conversationId),
        options.loadConversations(),
    ])
    await options.loadContactGroupConversations()
}

export async function removeMemberScene(options: {
    conversationId: number
    userId: number
    loadMembers: (conversationId: number) => Promise<void>
    loadConversations: () => Promise<void>
    loadContactGroupConversations: () => Promise<void>
}) {
    await removeMemberAction(options.conversationId, options.userId)
    await Promise.all([options.loadMembers(options.conversationId), options.loadConversations()])
    await options.loadContactGroupConversations()
}

export async function updateMemberRoleScene(options: {
    conversationId: number
    userId: number
    role: 'admin' | 'member'
    loadMembers: (conversationId: number) => Promise<void>
}) {
    await updateMemberRoleAction(options.conversationId, options.userId, options.role)
    await options.loadMembers(options.conversationId)
}

export async function muteMemberScene(options: {
    conversationId: number
    userId: number
    muteMinutes: number
    reason?: string
    loadMembers: (conversationId: number) => Promise<void>
}) {
    await muteMemberAction(options.conversationId, options.userId, options.muteMinutes, options.reason)
    await options.loadMembers(options.conversationId)
}

export async function leaveConversationScene(options: {
    conversationId: number
    loadConversations: () => Promise<void>
    loadContactGroupConversations: () => Promise<void>
}) {
    await leaveConversationAction(options.conversationId)
    await options.loadConversations()
    await options.loadContactGroupConversations()
}

export async function transferGroupOwnerScene(options: {
    conversationId: number
    targetUserId: number
    loadMembers: (conversationId: number) => Promise<void>
    loadConversations: () => Promise<void>
    loadContactGroupConversations: () => Promise<void>
}) {
    await transferGroupOwnerAction(options.conversationId, options.targetUserId)
    await Promise.all([
        options.loadMembers(options.conversationId),
        options.loadConversations(),
        options.loadContactGroupConversations(),
    ])
}

export async function disbandGroupConversationScene(options: {
    conversationId: number
    loadConversations: () => Promise<void>
    loadContactGroupConversations: () => Promise<void>
}) {
    await disbandGroupConversationAction(options.conversationId)
    await Promise.all([
        options.loadConversations(),
        options.loadContactGroupConversations(),
    ])
}

export async function handleJoinRequestScene(options: {
    requestId: number
    action: 'approve' | 'reject' | 'cancel'
    conversationId: number
    loadJoinRequests: (conversationId: number) => Promise<void>
    loadMembers: (conversationId: number) => Promise<void>
    loadConversations: () => Promise<void>
}) {
    await handleJoinRequestAction(options.requestId, options.action)
    await Promise.all([
        options.loadJoinRequests(options.conversationId),
        options.loadMembers(options.conversationId),
        options.loadConversations(),
    ])
}