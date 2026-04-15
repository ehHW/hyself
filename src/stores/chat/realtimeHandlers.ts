import { FRIENDSHIP_EVENT_HANDLERS } from '@/stores/chat/realtimeFriendshipHandlers'
import { MESSAGE_EVENT_HANDLERS } from '@/stores/chat/realtimeMessageHandlers'
import { NOTICE_EVENT_HANDLERS } from '@/stores/chat/realtimeNoticeHandlers'
import {
    handleRealtimeErrorPayload,
    handleTypingRealtimePayload,
    resolveRealtimeErrorFeedback,
    type ChatRealtimeEventHandler,
    type ChatRealtimeHandlerOptions,
} from '@/stores/chat/realtimeShared'
import type { WebSocketMessage } from '@/utils/websocket'

const EVENT_HANDLERS: Record<string, ChatRealtimeEventHandler> = {
    ...MESSAGE_EVENT_HANDLERS,
    ...FRIENDSHIP_EVENT_HANDLERS,
    ...NOTICE_EVENT_HANDLERS,
}

export { handleRealtimeErrorPayload, handleTypingRealtimePayload, resolveRealtimeErrorFeedback } from '@/stores/chat/realtimeShared'
export type { ChatRealtimeHandlerOptions } from '@/stores/chat/realtimeShared'

export async function dispatchChatRealtimeEvent(eventType: string | null, payload: WebSocketMessage, options: ChatRealtimeHandlerOptions) {
    if (!eventType) {
        return
    }
    const handler = EVENT_HANDLERS[eventType]
    if (!handler) {
        return
    }
    await handler(payload, options)
}