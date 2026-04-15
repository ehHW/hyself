import { beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeToRealtimeDomain, subscribeToRealtimeEvent, subscribeToRealtimeType } from '@/realtime/dispatcher'

const mocks = vi.hoisted(() => ({
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
}))

let wsListener: ((payload: Record<string, unknown>) => void) | null = null

vi.mock('@/utils/websocket', () => ({
    globalWebSocket: {
        subscribe: (listener: (payload: Record<string, unknown>) => void) => {
            mocks.subscribe(listener)
            wsListener = listener
            return mocks.unsubscribe
        },
    },
}))

describe('realtime dispatcher', () => {
    beforeEach(() => {
        wsListener = null
        vi.clearAllMocks()
    })

    it('routes raw type, event type and domain listeners from one websocket subscription', () => {
        const typeListener = vi.fn()
        const eventListener = vi.fn()
        const domainListener = vi.fn()

        const stopType = subscribeToRealtimeType('upload_progress', typeListener)
        const stopEvent = subscribeToRealtimeEvent('chat.message.created', eventListener)
        const stopDomain = subscribeToRealtimeDomain('chat', domainListener)

        expect(mocks.subscribe).toHaveBeenCalledTimes(1)

        wsListener?.({
            type: 'event',
            event_type: 'chat.message.created',
            domain: 'chat',
            occurred_at: '2026-01-01T00:00:00Z',
            payload: {
                conversation_id: 12,
            },
        })

        expect(eventListener).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'chat.message.created', domain: 'chat' }))
        expect(domainListener).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'chat.message.created', domain: 'chat' }))

        wsListener?.({
            type: 'upload_progress',
            task_id: 'task-1',
            progress: 50,
        })

        expect(typeListener).toHaveBeenCalledWith(expect.objectContaining({ type: 'upload_progress', task_id: 'task-1' }))

        stopType()
        stopEvent()
        stopDomain()

        expect(mocks.unsubscribe).toHaveBeenCalledTimes(1)
    })
})