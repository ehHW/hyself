import { describe, expect, it } from 'vitest'
import { globalWebSocket } from '@/utils/websocket'

describe('globalWebSocket event normalization', () => {
    it('preserves chat event envelope payload', () => {
        const parsed = (globalWebSocket as any).parseMessage(JSON.stringify({
            type: 'event',
            event_type: 'chat.message.created',
            domain: 'chat',
            occurred_at: '2026-04-10T00:00:00Z',
            payload: {
                conversation_id: 12,
                message: {
                    id: 99,
                    sequence: 8,
                    content: 'hello',
                },
            },
        }))

        expect(parsed).toMatchObject({
            type: 'event',
            event_type: 'chat.message.created',
            domain: 'chat',
            occurred_at: '2026-04-10T00:00:00Z',
            payload: {
                conversation_id: 12,
                message: {
                    id: 99,
                    sequence: 8,
                    content: 'hello',
                },
            },
        })
    })

    it('preserves system notice envelope into standard event payload', () => {
        const parsed = (globalWebSocket as any).parseMessage(JSON.stringify({
            type: 'event',
            event_type: 'chat.system_notice.created',
            domain: 'chat',
            occurred_at: '2026-04-10T00:00:00Z',
            payload: {
                category: 'chat',
                message: '你已加入群聊',
                payload: {
                    conversation_id: 88,
                },
            },
        }))

        expect(parsed).toMatchObject({
            type: 'event',
            event_type: 'chat.system_notice.created',
            payload: {
                category: 'chat',
                message: '你已加入群聊',
                payload: {
                    conversation_id: 88,
                },
            },
        })
    })

    it('keeps unknown event types while preserving envelope metadata', () => {
        const parsed = (globalWebSocket as any).parseMessage(JSON.stringify({
            type: 'event',
            event_type: 'chat.custom.debug',
            domain: 'chat',
            occurred_at: '2026-04-10T00:00:00Z',
            payload: {
                foo: 'bar',
            },
        }))

        expect(parsed).toEqual({
            type: 'event',
            event_type: 'chat.custom.debug',
            domain: 'chat',
            occurred_at: '2026-04-10T00:00:00Z',
            payload: {
                foo: 'bar',
            },
        })
    })

    it('returns plain text payload when raw message is not valid json', () => {
        const parsed = (globalWebSocket as any).parseMessage('plain text payload')

        expect(parsed).toEqual({
            type: 'text',
            message: 'plain text payload',
        })
    })
})