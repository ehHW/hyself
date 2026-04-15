import type { WebSocketMessage } from '@/utils/websocket'

export type RealtimeEventEnvelope = {
    raw: WebSocketMessage
    payload: WebSocketMessage
    eventType: string
    domain: string | null
    occurredAt?: string
}

export function isRealtimeEventMessage(payload: WebSocketMessage): payload is WebSocketMessage & { type: 'event'; event_type: string } {
    return payload.type === 'event' && typeof payload.event_type === 'string'
}

export function isRealtimeErrorMessage(payload: WebSocketMessage): payload is WebSocketMessage & { type: 'error' } {
    return payload.type === 'error'
}

export function isUploadProgressMessage(payload: WebSocketMessage): payload is WebSocketMessage & { type: 'upload_progress' } {
    return payload.type === 'upload_progress'
}

export function resolveRealtimeEventType(payload: WebSocketMessage): string | null {
    return isRealtimeEventMessage(payload) ? payload.event_type : null
}

export function unwrapRealtimePayload(payload: WebSocketMessage): WebSocketMessage {
    if (!isRealtimeEventMessage(payload)) {
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

export function toRealtimeEventEnvelope(payload: WebSocketMessage): RealtimeEventEnvelope | null {
    if (!isRealtimeEventMessage(payload)) {
        return null
    }
    return {
        raw: payload,
        payload: unwrapRealtimePayload(payload),
        eventType: payload.event_type,
        domain: typeof payload.domain === 'string' ? payload.domain : null,
        occurredAt: typeof payload.occurred_at === 'string' ? payload.occurred_at : undefined,
    }
}

export function getEnvelopeMessage(payload: { message?: unknown; payload?: unknown }, fallback: string) {
    const nestedPayload = payload.payload
    if (nestedPayload && typeof nestedPayload === 'object' && 'message' in nestedPayload) {
        const nestedMessage = (nestedPayload as { message?: unknown }).message
        if (nestedMessage) {
            return String(nestedMessage)
        }
    }
    if (payload.message) {
        return String(payload.message)
    }
    return fallback
}