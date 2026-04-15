import type { ChatConversationItem, ChatGroupJoinRequestItem } from '@/types/chat'
import type { ChatRealtimeEventHandler } from '@/stores/chat/realtimeShared'
import { handleTypingRealtimePayload } from '@/stores/chat/realtimeShared'

function appendHandledFriendRequestNotice(payload: Record<string, unknown>, options: Parameters<ChatRealtimeEventHandler>[1]) {
    const request = payload.request as {
        id?: number
        status?: string
        request_message?: string
        created_at?: string
        handled_at?: string | null
        from_user?: { id?: number; username?: string; display_name?: string }
        to_user?: { id?: number; username?: string; display_name?: string }
    } | undefined
    const currentUserId = options.getCurrentUserId()
    if (!request || !request.id || !currentUserId || request.status === 'pending') {
        return
    }
    const isReceived = request.to_user?.id === currentUserId
    const peerName = isReceived
        ? (request.from_user?.display_name || request.from_user?.username || '对方')
        : (request.to_user?.display_name || request.to_user?.username || '对方')
    const actionLabel = request.status === 'accepted'
        ? '已通过'
        : request.status === 'rejected'
            ? '已拒绝'
            : request.status === 'canceled'
                ? '已撤销'
                : request.status === 'expired'
                    ? '已过期'
                    : '已处理'
    options.appendFriendNotice({
        id: `friend-request-${isReceived ? 'received' : 'sent'}-${request.id}-${request.status}`,
        title: isReceived ? `${peerName} 的好友申请${actionLabel}` : `你发给 ${peerName} 的好友申请${actionLabel}`,
        description: String(request.request_message || '无附言'),
        created_at: String(request.handled_at || request.created_at || new Date().toISOString()),
        payload: {
            notice_type: `friend_request_${request.status}`,
            request_direction: isReceived ? 'received' : 'sent',
            request_id: request.id,
            request,
        },
    })
}

export const handleFriendRequestUpdatedEvent: ChatRealtimeEventHandler = async (payload, options) => {
    appendHandledFriendRequestNotice(payload as Record<string, unknown>, options)
    await options.loadFriendRequests()
}

export const handleFriendshipUpdatedEvent: ChatRealtimeEventHandler = async (payload, options) => {
    const action = String(payload.action || '')
    const conversation = payload.conversation as ChatConversationItem | undefined
    if (conversation) {
        options.upsertConversation(conversation)
    }
    if (action === 'updated') {
        if (payload.friend_user || conversation) {
            await options.loadFriends()
        }
        return
    }
    const tasks: Array<Promise<unknown>> = [options.loadFriends()]
    if (!conversation) {
        tasks.push(options.loadConversations())
    }
    await Promise.all(tasks)
}

export const handleGroupJoinRequestUpdatedEvent: ChatRealtimeEventHandler = async (payload, options) => {
    const joinRequest = payload.join_request as ChatGroupJoinRequestItem | undefined
    if (joinRequest?.conversation_id) {
        await options.loadJoinRequests(joinRequest.conversation_id)
    }
    await options.loadGlobalGroupJoinRequests()
}

export const handleTypingUpdatedEvent: ChatRealtimeEventHandler = (payload, options) => {
    const conversationId = Number(payload.conversation_id)
    if (!conversationId) {
        return
    }
    handleTypingRealtimePayload({
        payload,
        conversationId,
        currentUserId: options.getCurrentUserId(),
        typingMap: options.typingMap,
        typingTimers: options.typingTimers,
        removeTypingUser: options.removeTypingUser,
    })
}

export const FRIENDSHIP_EVENT_HANDLERS: Record<string, ChatRealtimeEventHandler> = {
    'chat.friend_request.updated': handleFriendRequestUpdatedEvent,
    'chat.friendship.updated': handleFriendshipUpdatedEvent,
    'chat.group_join_request.updated': handleGroupJoinRequestUpdatedEvent,
    'chat.typing.updated': handleTypingUpdatedEvent,
}

export function shouldRefreshSearchOrAuditForFriendshipEvent(eventType: string) {
    return eventType === 'chat.friendship.updated' || eventType === 'chat.group_join_request.updated' || eventType === 'chat.friend_request.updated'
}