import { resolveRealtimeEventType, unwrapRealtimePayload } from '@/realtime/envelope'
import { subscribeToRealtimeDomain } from '@/realtime/dispatcher'
import {
    dispatchChatRealtimeEvent,
    handleRealtimeErrorPayload,
    handleTypingRealtimePayload,
    type ChatRealtimeHandlerOptions,
} from '@/stores/chat/realtimeHandlers'
import type { WebSocketMessage } from '@/utils/websocket'

export { handleTypingRealtimePayload } from '@/stores/chat/realtimeHandlers'

export function createChatRealtimeHandler(options: ChatRealtimeHandlerOptions) {
    return async (payload: WebSocketMessage) => {
        if (!payload || typeof payload.type !== 'string') {
            return
        }
        if (payload.type === 'error') {
            handleRealtimeErrorPayload(payload, options)
            return
        }
        const eventType = resolveRealtimeEventType(payload)
        const eventPayload = unwrapRealtimePayload(payload)
        await dispatchChatRealtimeEvent(eventType, eventPayload, options)
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
    const unsubscribe = subscribeToRealtimeDomain('chat', (envelope) => {
        void options.handler(envelope.raw)
    })
    options.setUnsubscribe(unsubscribe)
}