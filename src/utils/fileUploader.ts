import { getUploadedChunksApi, mergeChunksApi, uploadChunkApi, uploadPrecheckApi, uploadSmallFileApi } from '@/api/upload'
import type { FileEntryItem } from '@/api/upload'
import { calculateFileHashes } from '@/utils/fileHash'
import { globalWebSocket } from '@/utils/websocket'

export const SMALL_FILE_THRESHOLD = 100 * 1024 * 1024
export const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024

export interface UploadFileOptions {
    file: File
    category?: string
    token: string
    parentId?: number | null
    relativePath?: string
    chunkSize?: number
    onHashProgress?: (progress: number) => void
    onChunkProgress?: (progress: number) => void
    onMergeProgress?: (progress: number) => void
    onLog?: (message: string) => void
    shouldPause?: () => boolean
    shouldCancel?: () => boolean
}

export interface UploadFileResult {
    mode: 'direct' | 'instant' | 'chunked'
    relativePath: string
    url: string
    file?: FileEntryItem
    assetReferenceId?: number | null
}

const subscribeMergeProgress = (taskId: string, token: string, onProgress?: (progress: number) => void, onLog?: (message: string) => void): Promise<UploadFileResult> => {
    return new Promise((resolve, reject) => {
        globalWebSocket.connect(token)

        const stopListen = globalWebSocket.subscribe((payload) => {
            if (payload.type !== 'upload_progress' || String(payload.task_id || '') !== taskId) {
                return
            }

            if (typeof payload.progress === 'number') {
                onProgress?.(payload.progress)
            }
            if (payload.message) {
                onLog?.(String(payload.message))
            }
            if (payload.status === 'done') {
                globalWebSocket.unsubscribeUploadTask(taskId)
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
                globalWebSocket.unsubscribeUploadTask(taskId)
                stopListen()
                reject(new Error(String(payload.message || '后台合并失败')))
            }
        })

        const subscribed = globalWebSocket.subscribeUploadTask(taskId)
        if (!subscribed) {
            stopListen()
            reject(new Error('全局 WebSocket 未连接，无法订阅上传进度'))
        }
    })
}

export const uploadFileWithCategory = async ({
    file,
    category,
    token,
    parentId,
    relativePath,
    chunkSize = DEFAULT_CHUNK_SIZE,
    onHashProgress,
    onChunkProgress,
    onMergeProgress,
    onLog,
    shouldPause,
    shouldCancel,
}: UploadFileOptions): Promise<UploadFileResult> => {
    const checkInterrupted = () => {
        if (shouldCancel?.()) {
            throw new Error('上传已取消')
        }
        if (shouldPause?.()) {
            throw new Error('上传已暂停')
        }
    }

    checkInterrupted()

    if (file.size <= SMALL_FILE_THRESHOLD) {
        const formData = new FormData()
        formData.append('file', file)
        if (category) {
            formData.append('category', category)
        }
        if (parentId != null) {
            formData.append('parent_id', String(parentId))
        }
        if (relativePath) {
            formData.append('relative_path', relativePath)
        }
        const { data } = await uploadSmallFileApi(formData)
        onHashProgress?.(100)
        onChunkProgress?.(100)
        onMergeProgress?.(100)
        return {
            mode: data.mode === 'instant' ? 'instant' : 'direct',
            relativePath: data.file.relative_path,
            url: data.file.url,
            file: data.file,
            assetReferenceId: data.file.asset_reference_id ?? null,
        }
    }

    onLog?.('开始计算文件与分片 MD5')
    const hashResult = await calculateFileHashes(file, chunkSize, onHashProgress)
    checkInterrupted()

    const { fileMd5, chunkMd5List, totalChunks } = hashResult
    onLog?.(`MD5 计算完成: ${fileMd5}`)

    const precheckRes = await uploadPrecheckApi({
        file_md5: fileMd5,
        file_name: file.name,
        file_size: file.size,
        category,
        parent_id: parentId,
        relative_path: relativePath,
    })

    if (precheckRes.data.exists) {
        onChunkProgress?.(100)
        onMergeProgress?.(100)
        onLog?.('命中秒传，跳过分片上传')
        return {
            mode: 'instant',
            relativePath: precheckRes.data.file?.relative_path || '',
            url: precheckRes.data.file?.url || '',
            file: precheckRes.data.file,
            assetReferenceId: precheckRes.data.file?.asset_reference_id ?? null,
        }
    }

    const uploadedRes = await getUploadedChunksApi(fileMd5, category)
    const uploadedSet = new Set(uploadedRes.data.uploaded_chunks || [])
    let finished = uploadedSet.size
    onChunkProgress?.(Math.floor((finished / totalChunks) * 100))

    for (let index = 0; index < totalChunks; index += 1) {
        checkInterrupted()

        const chunkIndex = index + 1
        if (uploadedSet.has(chunkIndex)) {
            continue
        }

        const currentChunkMd5 = chunkMd5List[index] || ''
        if (!currentChunkMd5) {
            throw new Error(`第 ${chunkIndex} 个分片MD5缺失`)
        }

        const start = index * chunkSize
        const end = Math.min(file.size, start + chunkSize)
        const chunkBlob = file.slice(start, end)
        const formData = new FormData()
        formData.append('file_md5', fileMd5)
        formData.append('chunk_index', String(chunkIndex))
        formData.append('chunk_md5', currentChunkMd5)
        if (category) {
            formData.append('category', category)
        }
        formData.append('chunk', chunkBlob, `${file.name}.part${chunkIndex}`)
        await uploadChunkApi(formData)

        finished += 1
        onChunkProgress?.(Math.floor((finished / totalChunks) * 100))
        onLog?.(`分片上传完成 ${chunkIndex}/${totalChunks}`)
    }

    onLog?.('分片上传完成，提交后台合并任务')
    const mergeRes = await mergeChunksApi({
        file_md5: fileMd5,
        total_md5: fileMd5,
        file_name: file.name,
        total_chunks: totalChunks,
        file_size: file.size,
        category,
        parent_id: parentId,
        relative_path: relativePath,
    })

    return subscribeMergeProgress(mergeRes.data.task_id, token, onMergeProgress, onLog)
}
