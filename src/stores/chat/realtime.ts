import { message as antMessage } from 'ant-design-vue'
import type { Ref } from 'vue'
import type { ChatConversationItem, ChatGroupJoinRequestItem, ChatMessageItem, ChatUserBrief } from '@/types/chat'
import { resolveRealtimeEventType, unwrapRealtimePayload } from '@/stores/chat/realtimeEvents'
import type { WebSocketMessage } from '@/utils/websocket'
import { globalWebSocket } from '@/utils/websocket'

type TypingTimer = ReturnType<typeof setTimeout>

type HandleTypingRealtimeOptions = {
    payload: WebSocketMessage
    conversationId: number
    currentUserId?: number
    typingMap: Record<number, ChatUserBrief[]>
    typingTimers: Map<string, TypingTimer>
    removeTypingUser: (conversationId: number, userId: number) => void
}

export function handleTypingRealtimePayload(options: HandleTypingRealtimeOptions) {
    const user = options.payload.user as ChatUserBrief | undefined
    if (!user || user.id === options.currentUserId) {
        return
    }
    if (!options.payload.is_typing) {
        options.removeTypingUser(options.conversationId, user.id)
        return
    }
    const key = `${options.conversationId}:${user.id}`
    const current = options.typingMap[options.conversationId] || []
    if (!current.some((item) => item.id === user.id)) {
        options.typingMap[options.conversationId] = [...current, user]
    }
    const previousTimer = options.typingTimers.get(key)
    if (previousTimer) {
        clearTimeout(previousTimer)
    }
    options.typingTimers.set(
        key,
        setTimeout(() => {
            options.removeTypingUser(options.conversationId, user.id)
            options.typingTimers.delete(key)
        }, 3000),
    )
}

type ChatRealtimeHandlerOptions = {
    activeConversationId: Ref<number | null>
    shouldAutoMarkRead: () => boolean
    getCurrentUserId: () => number | undefined
    typingMap: Record<number, ChatUserBrief[]>
    typingTimers: Map<string, TypingTimer>
    appendFriendNotice: (notice: { id: string; title: string; description: string; created_at: string; payload: Record<string, unknown> }) => void
    appendGroupNotice: (notice: { id: string; conversation_id: number | null; message: string; created_at: string; payload: Record<string, unknown> }) => void
    clearSendingState: () => void
    loadConversations: () => Promise<void>
    loadFriendRequests: () => Promise<void>
    loadFriends: () => Promise<void>
    loadGlobalGroupJoinRequests: () => Promise<void>
    loadJoinRequests: (conversationId: number) => Promise<void>
    markConversationRead: (conversationId: number, lastReadSequence: number) => Promise<void>
    markLatestSendingMessageFailed: (conversationId: number | null, error: string) => void
    reconcileLocalMessage: (conversationId: number, clientMessageId: string | null | undefined, nextMessage: ChatMessageItem) => void
    removeTypingUser: (conversationId: number, userId: number) => void
    setConversationUnread: (conversationId: number, unreadCount: number, lastReadSequence?: number) => void
    syncConversationPreview: (conversationId: number, messageItem: Pick<ChatMessageItem, 'content' | 'created_at'>) => void
    upsertConversation: (item: ChatConversationItem) => void
    upsertMessage: (conversationId: number, nextMessage: ChatMessageItem) => void
}

function resolveRealtimeErrorFeedback(payload: WebSocketMessage): { toastMessage: string; failedStateError: string } {
    const rawMessage = typeof payload.message === 'string' ? payload.message.trim() : ''
    if (payload.error_kind === 'schema') {
        return {
            toastMessage: '消息请求格式错误，请刷新后重试',
            failedStateError: rawMessage || '请求格式错误，消息未发送',
        }
    }
    if (payload.error_kind === 'permission') {
        return {
            toastMessage: rawMessage || '当前没有权限执行该操作',
            failedStateError: rawMessage || '没有权限，消息未发送',
        }
    }
    if (payload.error_kind === 'business') {
        return {
            toastMessage: rawMessage || '当前操作暂时无法完成',
            failedStateError: rawMessage || '当前操作暂时无法完成',
        }
    }
    return {
        toastMessage: rawMessage || '聊天操作失败',
        failedStateError: rawMessage || '发送失败',
    }
}

export function createChatRealtimeHandler(options: ChatRealtimeHandlerOptions) {
    return async (payload: WebSocketMessage) => {
        if (!payload || typeof payload.type !== 'string') {
            return
        }
        if (payload.type === 'error') {
            const feedback = resolveRealtimeErrorFeedback(payload)
            antMessage.error(feedback.toastMessage)
            options.markLatestSendingMessageFailed(options.activeConversationId.value, feedback.failedStateError)
            options.clearSendingState()
            return
        }
        const eventType = resolveRealtimeEventType(payload)
        const eventPayload = unwrapRealtimePayload(payload)

        if (eventType === 'chat.message.ack') {
            const conversation = eventPayload.conversation as ChatConversationItem | undefined
            const nextMessage = eventPayload.message as ChatMessageItem | undefined
            const clientMessageId = typeof eventPayload.client_message_id === 'string' ? eventPayload.client_message_id : undefined
            if (conversation) {
                options.upsertConversation(conversation)
            }
            if (conversation && nextMessage) {
                options.reconcileLocalMessage(conversation.id, clientMessageId, nextMessage)
                options.syncConversationPreview(conversation.id, nextMessage)
            }
            options.clearSendingState()
            return
        }
        if (eventType === 'chat.message.created') {
            const conversationId = Number(eventPayload.conversation_id)
            const nextMessage = eventPayload.message as ChatMessageItem | undefined
            if (conversationId && nextMessage) {
                options.upsertMessage(conversationId, { ...nextMessage, local_status: null, local_error: null })
                options.syncConversationPreview(conversationId, nextMessage)
                if (nextMessage.sender?.id === options.getCurrentUserId()) {
                    options.clearSendingState()
                }
                if (
                    options.activeConversationId.value === conversationId
                    && document.visibilityState === 'visible'
                    && options.shouldAutoMarkRead()
                ) {
                    await options.markConversationRead(conversationId, nextMessage.sequence)
                }
            }
            return
        }
        if (eventType === 'chat.message.updated') {
            const conversationId = Number(eventPayload.conversation_id)
            const nextMessage = eventPayload.message as ChatMessageItem | undefined
            if (conversationId && nextMessage) {
                options.upsertMessage(conversationId, nextMessage)
                options.syncConversationPreview(conversationId, nextMessage)
            }
            return
        }
        if (eventType === 'chat.conversation.updated') {
            const conversation = eventPayload.conversation as ChatConversationItem | undefined
            if (conversation) {
                options.upsertConversation(conversation)
            }
            return
        }
        if (eventType === 'chat.unread.updated') {
            options.setConversationUnread(Number(eventPayload.conversation_id), Number(eventPayload.unread_count || 0), Number(eventPayload.last_read_sequence || 0) || undefined)
            return
        }
        if (eventType === 'chat.friend_request.updated') {
            await options.loadFriendRequests()
            return
        }
        if (eventType === 'chat.friendship.updated') {
            const action = String(eventPayload.action || '')
            const conversation = eventPayload.conversation as ChatConversationItem | undefined
            if (conversation) {
                options.upsertConversation(conversation)
            }
            if (action === 'updated') {
                if (eventPayload.friend_user || conversation) {
                    await options.loadFriends()
                }
                return
            }
            const tasks: Array<Promise<unknown>> = [options.loadFriends()]
            if (!conversation) {
                tasks.push(options.loadConversations())
            }
            await Promise.all(tasks)
            return
        }
        if (eventType === 'chat.group_join_request.updated') {
            const joinRequest = eventPayload.join_request as ChatGroupJoinRequestItem | undefined
            if (joinRequest?.conversation_id) {
                await options.loadJoinRequests(joinRequest.conversation_id)
            }
            await options.loadGlobalGroupJoinRequests()
            return
        }
        if (eventType === 'chat.typing.updated') {
            const conversationId = Number(eventPayload.conversation_id)
            if (!conversationId) {
                return
            }
            handleTypingRealtimePayload({
                payload: eventPayload,
                conversationId,
                currentUserId: options.getCurrentUserId(),
                typingMap: options.typingMap,
                typingTimers: options.typingTimers,
                removeTypingUser: options.removeTypingUser,
            })
            return
        }
        if (eventType === 'chat.system_notice.created' && eventPayload.category === 'chat' && eventPayload.message) {
            const noticePayload = (eventPayload.payload || {}) as Record<string, unknown>
            const noticeType = String(noticePayload.notice_type || '')
            if (noticeType.startsWith('friend_')) {
                options.appendFriendNotice({
                    id: String(noticePayload.notice_id || `${Date.now()}_${Math.random().toString(16).slice(2)}`),
                    title: String(eventPayload.message),
                    description: String(noticePayload.description || ''),
                    created_at: typeof eventPayload.occurred_at === 'string' ? eventPayload.occurred_at : new Date().toISOString(),
                    payload: noticePayload,
                })
                antMessage.info(String(eventPayload.message))
                return
            }
            options.appendGroupNotice({
                id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                conversation_id: typeof noticePayload.conversation_id === 'number' ? noticePayload.conversation_id : null,
                message: String(eventPayload.message),
                created_at: typeof eventPayload.occurred_at === 'string' ? eventPayload.occurred_at : new Date().toISOString(),
                payload: noticePayload,
            })
            antMessage.info(String(eventPayload.message))
        }
    }
}

export function ensureChatRealtimeSubscription(options: {
    currentUnsubscribe: (() => void) | null
    handler: (payload: WebSocketMessage) => Promise<void>
    setUnsubscribe: (unsubscribe: () => void) => void
}) {
    if (options.currentUnsubscribe) {
        return
    }
    const unsubscribe = globalWebSocket.subscribe((payload) => {
        void options.handler(payload)
    })
    options.setUnsubscribe(unsubscribe)
}