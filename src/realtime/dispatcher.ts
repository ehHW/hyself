import type { WebSocketMessage } from '@/utils/websocket'
import { globalWebSocket } from '@/utils/websocket'
import { isRealtimeEventMessage, toRealtimeEventEnvelope } from '@/realtime/envelope'

type RawListener = (payload: WebSocketMessage) => void
type EventListener = (payload: ReturnType<typeof toRealtimeEventEnvelope> extends infer T ? Exclude<T, null> : never) => void

class RealtimeDispatcher {
    private unsubscribe: (() => void) | null = null
    private rawTypeListeners = new Map<string, Set<RawListener>>()
    private eventTypeListeners = new Map<string, Set<EventListener>>()
    private domainListeners = new Map<string, Set<EventListener>>()

    subscribeByType(type: string, listener: RawListener) {
        return this.subscribe(this.rawTypeListeners, type, listener)
    }

    subscribeByEvent(eventType: string, listener: EventListener) {
        return this.subscribe(this.eventTypeListeners, eventType, listener)
    }

    subscribeByDomain(domain: string, listener: EventListener) {
        return this.subscribe(this.domainListeners, domain, listener)
    }

    private subscribe<T>(bucket: Map<string, Set<T>>, key: string, listener: T) {
        const normalizedKey = String(key || '').trim()
        if (!normalizedKey) {
            return () => undefined
        }
        const listeners = bucket.get(normalizedKey) || new Set<T>()
        listeners.add(listener)
        bucket.set(normalizedKey, listeners)
        this.ensureConnected()
        return () => {
            const current = bucket.get(normalizedKey)
            if (!current) {
                return
            }
            current.delete(listener)
            if (current.size === 0) {
                bucket.delete(normalizedKey)
            }
            this.teardownIfIdle()
        }
    }

    private ensureConnected() {
        if (this.unsubscribe) {
            return
        }
        this.unsubscribe = globalWebSocket.subscribe((payload) => {
            this.dispatch(payload)
        })
    }

    private dispatch(payload: WebSocketMessage) {
        const rawListeners = this.rawTypeListeners.get(payload.type)
        rawListeners?.forEach((listener) => listener(payload))

        if (!isRealtimeEventMessage(payload)) {
            return
        }

        const envelope = toRealtimeEventEnvelope(payload)
        if (!envelope) {
            return
        }

        const eventTypeListeners = this.eventTypeListeners.get(envelope.eventType)
        eventTypeListeners?.forEach((listener) => listener(envelope))

        if (!envelope.domain) {
            return
        }
        const domainListeners = this.domainListeners.get(envelope.domain)
        domainListeners?.forEach((listener) => listener(envelope))
    }

    private teardownIfIdle() {
        if (this.rawTypeListeners.size || this.eventTypeListeners.size || this.domainListeners.size) {
            return
        }
        this.unsubscribe?.()
        this.unsubscribe = null
    }
}

export const realtimeDispatcher = new RealtimeDispatcher()

export const subscribeToRealtimeType = (type: string, listener: RawListener) => realtimeDispatcher.subscribeByType(type, listener)
export const subscribeToRealtimeEvent = (eventType: string, listener: EventListener) => realtimeDispatcher.subscribeByEvent(eventType, listener)
export const subscribeToRealtimeDomain = (domain: string, listener: EventListener) => realtimeDispatcher.subscribeByDomain(domain, listener)