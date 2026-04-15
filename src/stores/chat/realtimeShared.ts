import { message as antMessage } from 'ant-design-vue'
import type { Ref } from 'vue'
import type { ChatConversationItem, ChatMessageItem, ChatUserBrief } from '@/types/chat'
import type { WebSocketMessage } from '@/utils/websocket'

export type TypingTimer = ReturnType<typeof setTimeout>

export type HandleTypingRealtimeOptions = {
    payload: WebSocketMessage
    conversationId: number
    currentUserId?: number
    typingMap: Record<number, ChatUserBrief[]>
    typingTimers: Map<string, TypingTimer>
    removeTypingUser: (conversationId: number, userId: number) => void
}

export type ChatRealtimeHandlerOptions = {
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

export type ChatRealtimeEventHandler = (payload: WebSocketMessage, options: ChatRealtimeHandlerOptions) => Promise<void> | void

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

export function resolveRealtimeErrorFeedback(payload: WebSocketMessage): { toastMessage: string; failedStateError: string } {
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

export function handleRealtimeErrorPayload(payload: WebSocketMessage, options: ChatRealtimeHandlerOptions) {
    const feedback = resolveRealtimeErrorFeedback(payload)
    antMessage.error(feedback.toastMessage)
    options.markLatestSendingMessageFailed(options.activeConversationId.value, feedback.failedStateError)
    options.clearSendingState()
}