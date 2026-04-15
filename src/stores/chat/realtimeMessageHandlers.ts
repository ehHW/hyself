import type { ChatConversationItem, ChatMessageItem } from '@/types/chat'
import type { WebSocketMessage } from '@/utils/websocket'
import type { ChatRealtimeEventHandler, ChatRealtimeHandlerOptions } from '@/stores/chat/realtimeShared'

export const handleMessageAckEvent: ChatRealtimeEventHandler = (payload, options) => {
    const conversation = payload.conversation as ChatConversationItem | undefined
    const nextMessage = payload.message as ChatMessageItem | undefined
    const clientMessageId = typeof payload.client_message_id === 'string' ? payload.client_message_id : undefined
    if (conversation) {
        options.upsertConversation(conversation)
    }
    if (conversation && nextMessage) {
        options.reconcileLocalMessage(conversation.id, clientMessageId, nextMessage)
        options.syncConversationPreview(conversation.id, nextMessage)
    }
    options.clearSendingState()
}

export const handleMessageCreatedEvent: ChatRealtimeEventHandler = async (payload, options) => {
    const conversationId = Number(payload.conversation_id)
    const nextMessage = payload.message as ChatMessageItem | undefined
    if (!conversationId || !nextMessage) {
        return
    }

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

export const handleMessageUpdatedEvent: ChatRealtimeEventHandler = (payload, options) => {
    const conversationId = Number(payload.conversation_id)
    const nextMessage = payload.message as ChatMessageItem | undefined
    if (!conversationId || !nextMessage) {
        return
    }
    options.upsertMessage(conversationId, nextMessage)
    options.syncConversationPreview(conversationId, nextMessage)
}

export const handleConversationUpdatedEvent: ChatRealtimeEventHandler = (payload, options) => {
    const conversation = payload.conversation as ChatConversationItem | undefined
    if (conversation) {
        options.upsertConversation(conversation)
    }
}

export const handleUnreadUpdatedEvent: ChatRealtimeEventHandler = (payload, options) => {
    options.setConversationUnread(
        Number(payload.conversation_id),
        Number(payload.unread_count || 0),
        Number(payload.last_read_sequence || 0) || undefined,
    )
}

export const MESSAGE_EVENT_HANDLERS: Record<string, ChatRealtimeEventHandler> = {
    'chat.message.ack': handleMessageAckEvent,
    'chat.message.created': handleMessageCreatedEvent,
    'chat.message.updated': handleMessageUpdatedEvent,
    'chat.conversation.updated': handleConversationUpdatedEvent,
    'chat.unread.updated': handleUnreadUpdatedEvent,
}

export function shouldRefreshSearchOrAuditForMessageEvent(eventType: string) {
    return eventType in MESSAGE_EVENT_HANDLERS
}