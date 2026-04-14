import { computed, readonly, ref } from 'vue'

type SocketStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed'

export interface WebSocketMessage {
    type: string
    event_type?: string
    domain?: string
    occurred_at?: string
    message?: string
    error_kind?: 'schema' | 'business' | 'permission'
    error_code?: string
    error_details?: Record<string, string[]>
    timestamp?: number
    [key: string]: unknown
}

type MessageListener = (payload: WebSocketMessage) => void

const HEARTBEAT_INTERVAL_MS = 20000
const HEARTBEAT_TIMEOUT_MS = 10000
const BASE_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 30000
const MAX_LOGS = 100

class GlobalWebSocketManager {
    private socket: WebSocket | null = null
    private token = ''
    private listeners = new Set<MessageListener>()
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null
    private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private reconnectAttempts = 0
    private manualClose = false
    private uploadTaskSubscriptions = new Set<string>()

    private statusRef = ref<SocketStatus>('idle')
    private logsRef = ref<string[]>([])
    private lastMessageRef = ref<WebSocketMessage | null>(null)

    constructor() {
        window.addEventListener('online', this.handleOnline)
        window.addEventListener('offline', this.handleOffline)
    }

    readonly status = readonly(this.statusRef)
    readonly logs = readonly(this.logsRef)
    readonly lastMessage = readonly(this.lastMessageRef)
    readonly connected = computed(() => this.statusRef.value === 'open')

    connect(token: string, force = false) {
        if (!token) {
            return
        }

        const shouldReuseCurrentConnection =
            !force &&
            this.token === token &&
            this.socket &&
            (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)

        if (shouldReuseCurrentConnection) {
            return
        }

        this.token = token
        this.manualClose = false
        this.clearReconnectTimer()

        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            this.disposeSocket(false)
        }

        this.openSocket()
    }

    disconnect() {
        this.manualClose = true
        this.clearReconnectTimer()
        this.stopHeartbeat()
        this.disposeSocket(true)
        this.statusRef.value = 'closed'
        this.token = ''
        this.uploadTaskSubscriptions.clear()
    }

    updateToken(token: string) {
        if (!token) {
            this.disconnect()
            return
        }
        if (token === this.token && this.socket?.readyState === WebSocket.OPEN) {
            return
        }
        this.connect(token, true)
    }

    send(payload: WebSocketMessage) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.pushLog('发送失败: WebSocket 未连接')
            return false
        }

        this.socket.send(JSON.stringify(payload))
        this.pushLog(`发送消息: ${JSON.stringify(payload)}`)
        return true
    }

    subscribeUploadTask(taskId: string) {
        const normalizedTaskId = String(taskId || '').trim()
        if (!normalizedTaskId) {
            return false
        }
        this.uploadTaskSubscriptions.add(normalizedTaskId)
        return this.send({ type: 'subscribe_upload_task', task_id: normalizedTaskId })
    }

    unsubscribeUploadTask(taskId: string) {
        const normalizedTaskId = String(taskId || '').trim()
        if (!normalizedTaskId) {
            return false
        }
        this.uploadTaskSubscriptions.delete(normalizedTaskId)
        return this.send({ type: 'unsubscribe_upload_task', task_id: normalizedTaskId })
    }

    private handleOnline = () => {
        this.pushLog('网络已恢复，准备重建 WebSocket 连接')
        if (this.token) {
            this.connect(this.token, true)
        }
    }

    private handleOffline = () => {
        this.pushLog('网络已断开，等待浏览器恢复连接')
    }

    subscribe(listener: MessageListener) {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    private openSocket() {
        if (!this.token) {
            return
        }

        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
        const url = `${protocol}://${window.location.host}/ws/global/?token=${encodeURIComponent(this.token)}`
        this.statusRef.value = this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting'
        this.pushLog(`开始建立连接: 第 ${this.reconnectAttempts + 1} 次`)

        this.socket = new WebSocket(url)

        this.socket.onopen = () => {
            this.statusRef.value = 'open'
            this.reconnectAttempts = 0
            this.pushLog('WebSocket 连接已建立')
            this.startHeartbeat()
            this.restoreUploadTaskSubscriptions()
        }

        this.socket.onmessage = (event) => {
            const payload = this.parseMessage(event.data)
            this.lastMessageRef.value = payload

            if (payload.type === 'pong') {
                this.clearHeartbeatTimeout()
            }

            this.listeners.forEach((listener) => listener(payload))
            this.pushLog(`收到消息: ${JSON.stringify(payload)}`)
        }

        this.socket.onerror = () => {
            this.pushLog('WebSocket 连接发生错误')
        }

        this.socket.onclose = (event) => {
            this.stopHeartbeat()
            this.socket = null
            this.pushLog(`WebSocket 已关闭: code=${event.code}`)

            if (this.manualClose) {
                this.statusRef.value = 'closed'
                return
            }

            // 服务端明确拒绝（例如未认证）时不做重连，避免代理层反复报错。
            if (event.code === 4401 || event.code === 4403) {
                this.statusRef.value = 'closed'
                this.pushLog('连接被服务端拒绝，停止自动重连')
                return
            }

            this.scheduleReconnect()
        }
    }

    private scheduleReconnect() {
        this.clearReconnectTimer()
        this.reconnectAttempts += 1
        this.statusRef.value = 'reconnecting'

        const delay = Math.min(
            BASE_RECONNECT_DELAY_MS * 2 ** (this.reconnectAttempts - 1) + Math.floor(Math.random() * 500),
            MAX_RECONNECT_DELAY_MS,
        )

        this.pushLog(`准备重连，${delay}ms 后重试`)
        this.reconnectTimer = setTimeout(() => {
            this.openSocket()
        }, delay)
    }

    private startHeartbeat() {
        this.stopHeartbeat()
        this.sendHeartbeat()
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat()
        }, HEARTBEAT_INTERVAL_MS)
    }

    private sendHeartbeat() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return
        }

        this.socket.send(
            JSON.stringify({
                type: 'ping',
                timestamp: Date.now(),
            }),
        )
        this.clearHeartbeatTimeout()
        this.heartbeatTimeoutTimer = setTimeout(() => {
            this.pushLog('心跳超时，主动断开并重连')
            this.socket?.close()
        }, HEARTBEAT_TIMEOUT_MS)
    }

    private restoreUploadTaskSubscriptions() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return
        }
        for (const taskId of this.uploadTaskSubscriptions) {
            this.socket.send(
                JSON.stringify({
                    type: 'subscribe_upload_task',
                    task_id: taskId,
                }),
            )
        }
    }

    private stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer)
            this.heartbeatTimer = null
        }
        this.clearHeartbeatTimeout()
    }

    private clearHeartbeatTimeout() {
        if (this.heartbeatTimeoutTimer) {
            clearTimeout(this.heartbeatTimeoutTimer)
            this.heartbeatTimeoutTimer = null
        }
    }

    private clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
    }

    private disposeSocket(markManualClose: boolean) {
        if (!this.socket) {
            return
        }
        if (markManualClose) {
            this.manualClose = true
        }
        this.socket.onopen = null
        this.socket.onmessage = null
        this.socket.onerror = null
        this.socket.onclose = null
        this.socket.close()
        this.socket = null
    }

    private parseMessage(raw: string): WebSocketMessage {
        try {
            return JSON.parse(raw) as WebSocketMessage
        } catch {
            return { type: 'text', message: raw }
        }
    }

    private pushLog(content: string) {
        this.logsRef.value = [
            `${new Date().toLocaleTimeString()} ${content}`,
            ...this.logsRef.value,
        ].slice(0, MAX_LOGS)
    }
}

export const globalWebSocket = new GlobalWebSocketManager()