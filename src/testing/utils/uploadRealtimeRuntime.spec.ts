import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitForUploadTaskRealtime } from '@/utils/uploadRealtimeRuntime'

const mocks = vi.hoisted(() => ({
    subscribeToRealtimeType: vi.fn(),
    connect: vi.fn(),
    subscribeUploadTask: vi.fn(),
    unsubscribeUploadTask: vi.fn(),
}))

let uploadListener: ((payload: Record<string, unknown>) => void) | null = null

vi.mock('@/realtime/dispatcher', () => ({
    subscribeToRealtimeType: (type: string, listener: (payload: Record<string, unknown>) => void) => {
        mocks.subscribeToRealtimeType(type, listener)
        uploadListener = listener
        return vi.fn()
    },
}))

vi.mock('@/utils/websocket', () => ({
    globalWebSocket: {
        connect: mocks.connect,
        subscribeUploadTask: mocks.subscribeUploadTask,
        unsubscribeUploadTask: mocks.unsubscribeUploadTask,
    },
}))

describe('waitForUploadTaskRealtime', () => {
    beforeEach(() => {
        uploadListener = null
        vi.clearAllMocks()
        mocks.subscribeUploadTask.mockReturnValue(true)
    })

    it('resolves done progress payloads through dispatcher runtime', async () => {
        const resultPromise = waitForUploadTaskRealtime({
            taskId: 'task-1',
            token: 'token-1',
        })

        uploadListener?.({
            type: 'upload_progress',
            task_id: 'task-1',
            status: 'done',
            relative_path: 'uploads/a.txt',
            url: '/media/uploads/a.txt',
            asset_reference_id: 12,
        })

        await expect(resultPromise).resolves.toMatchObject({
            mode: 'chunked',
            relativePath: 'uploads/a.txt',
            url: '/media/uploads/a.txt',
            assetReferenceId: 12,
        })
        expect(mocks.connect).toHaveBeenCalledWith('token-1')
        expect(mocks.subscribeToRealtimeType).toHaveBeenCalledWith('upload_progress', expect.any(Function))
        expect(mocks.subscribeUploadTask).toHaveBeenCalledWith('task-1')
        expect(mocks.unsubscribeUploadTask).toHaveBeenCalledWith('task-1')
    })
})