import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { globalWebSocket } from '@/utils/websocket'

class FakeWebSocket {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3
    static instances: FakeWebSocket[] = []

    readyState = FakeWebSocket.CONNECTING
    url: string
    sent: string[] = []
    closeCalls = 0
    onopen: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    onerror: (() => void) | null = null
    onclose: ((event: { code: number }) => void) | null = null

    constructor(url: string) {
        this.url = url
        FakeWebSocket.instances.push(this)
    }

    send(payload: string) {
        this.sent.push(payload)
    }

    open() {
        this.readyState = FakeWebSocket.OPEN
        this.onopen?.()
    }

    receive(payload: unknown) {
        this.onmessage?.({ data: JSON.stringify(payload) })
    }

    close(code = 1000) {
        this.closeCalls += 1
        this.readyState = FakeWebSocket.CLOSED
        this.onclose?.({ code })
    }

    emitClose(code: number) {
        this.readyState = FakeWebSocket.CLOSED
        this.onclose?.({ code })
    }
}

function getSocket(index: number): FakeWebSocket {
    const socket = FakeWebSocket.instances[index]
    if (!socket) {
        throw new Error(`Missing fake socket at index ${index}`)
    }
    return socket
}

describe('globalWebSocket manager', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.spyOn(Math, 'random').mockReturnValue(0)
        FakeWebSocket.instances = []
        vi.stubGlobal('WebSocket', FakeWebSocket)
        globalWebSocket.disconnect()
    })

    afterEach(() => {
        globalWebSocket.disconnect()
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    it('sends heartbeat immediately on open and restores upload subscriptions after reconnect', () => {
        globalWebSocket.subscribeUploadTask(' task-1 ')
        globalWebSocket.connect('token-1')

        const firstSocket = getSocket(0)
        expect(firstSocket.url).toContain('/ws/global/?token=token-1')

        firstSocket.open()

        expect(firstSocket.sent).toHaveLength(2)
        expect(JSON.parse(firstSocket.sent[0] || '')).toMatchObject({ type: 'ping' })
        expect(JSON.parse(firstSocket.sent[1] || '')).toEqual({ type: 'subscribe_upload_task', task_id: 'task-1' })

        firstSocket.emitClose(1006)
        vi.advanceTimersByTime(1000)

        const secondSocket = getSocket(1)
        secondSocket.open()

        expect(secondSocket.sent).toHaveLength(2)
        expect(JSON.parse(secondSocket.sent[0] || '')).toMatchObject({ type: 'ping' })
        expect(JSON.parse(secondSocket.sent[1] || '')).toEqual({ type: 'subscribe_upload_task', task_id: 'task-1' })
    })

    it('closes the socket on heartbeat timeout and reconnects', () => {
        globalWebSocket.connect('token-2')
        const firstSocket = getSocket(0)
        firstSocket.open()

        vi.advanceTimersByTime(10000)

        expect(firstSocket.closeCalls).toBe(1)

        vi.advanceTimersByTime(1000)

        expect(FakeWebSocket.instances).toHaveLength(2)
    })

    it('clears heartbeat timeout when pong is received', () => {
        globalWebSocket.connect('token-3')
        const socket = getSocket(0)
        socket.open()
        socket.receive({ type: 'pong' })

        vi.advanceTimersByTime(10000)

        expect(socket.closeCalls).toBe(0)
    })

    it('does not reconnect when the server rejects authentication', () => {
        globalWebSocket.connect('token-4')
        const socket = getSocket(0)
        socket.open()
        socket.emitClose(4401)

        vi.advanceTimersByTime(30000)

        expect(FakeWebSocket.instances).toHaveLength(1)
        expect(globalWebSocket.status.value).toBe('closed')
    })
})