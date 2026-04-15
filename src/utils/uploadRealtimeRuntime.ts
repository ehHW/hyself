import type { FileEntryItem } from '@/api/upload'
import { subscribeToRealtimeType } from '@/realtime/dispatcher'
import { globalWebSocket } from '@/utils/websocket'

export interface UploadRealtimeResult {
    mode: 'chunked'
    relativePath: string
    url: string
    file?: FileEntryItem
    assetReferenceId?: number | null
}

export function waitForUploadTaskRealtime(options: {
    taskId: string
    token: string
    onProgress?: (progress: number) => void
    onLog?: (message: string) => void
}): Promise<UploadRealtimeResult> {
    return new Promise((resolve, reject) => {
        globalWebSocket.connect(options.token)

        const stopListen = subscribeToRealtimeType('upload_progress', (payload) => {
            if (payload.type !== 'upload_progress' || String(payload.task_id || '') !== options.taskId) {
                return
            }

            if (typeof payload.progress === 'number') {
                options.onProgress?.(payload.progress)
            }
            if (payload.message) {
                options.onLog?.(String(payload.message))
            }
            if (payload.status === 'done') {
                globalWebSocket.unsubscribeUploadTask(options.taskId)
                stopListen()
                resolve({
                    mode: 'chunked',
                    relativePath: String(payload.relative_path || ''),
                    url: String(payload.url || ''),
                    file: payload.file as FileEntryItem | undefined,
                    assetReferenceId: typeof payload.asset_reference_id === 'number' ? payload.asset_reference_id : null,
                })
            }
            if (payload.status === 'failed') {
                globalWebSocket.unsubscribeUploadTask(options.taskId)
                stopListen()
                reject(new Error(String(payload.message || '后台合并失败')))
            }
        })

        const subscribed = globalWebSocket.subscribeUploadTask(options.taskId)
        if (!subscribed) {
            stopListen()
            reject(new Error('全局 WebSocket 未连接，无法订阅上传进度'))
        }
    })
}