import type { WebSocketMessage } from '@/utils/websocket'

export function resolveRealtimeEventType(payload: WebSocketMessage): string | null {
    if (payload.type === 'event' && typeof payload.event_type === 'string') {
        return payload.event_type
    }
    return null
}

export function unwrapRealtimePayload(payload: WebSocketMessage): WebSocketMessage {
    if (payload.type !== 'event') {
        return payload
    }
    const eventPayload = typeof payload.payload === 'object' && payload.payload ? (payload.payload as Record<string, unknown>) : {}
    return {
        ...eventPayload,
        type: payload.type,
        event_type: payload.event_type,
        domain: payload.domain,
        occurred_at: payload.occurred_at,
    }
}