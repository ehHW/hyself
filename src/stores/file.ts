import { computed, markRaw, ref, toRaw, watch } from 'vue'
import { defineStore } from 'pinia'
import { clearRecycleBinApi, createFolderApi, deleteFileEntryApi, getFileEntriesApi, renameFileEntryApi, restoreRecycleBinEntryApi } from '@/api/upload'
import type { FileEntryItem, FileManageScope } from '@/api/upload'
import { uploadFileWithCategory } from '@/utils/fileUploader'
import { useAuthStore } from '@/stores/auth'

export type UploadTaskStatus = 'pending' | 'uploading' | 'paused' | 'completed' | 'failed' | 'canceled'

export interface UploadTaskItem {
    id: string
    file: File | null
    parentId: number | null
    relativePath: string
    displayName: string
    size: number
    status: UploadTaskStatus
    progress: number
    hashProgress: number
    chunkProgress: number
    mergeProgress: number
    resultPath: string
    errorMessage: string
}

const toTaskId = () => `upload_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
const UPLOAD_TASK_DB_NAME = 'hyself_upload_tasks_db'
const UPLOAD_TASK_STORE_NAME = 'upload_tasks_store'
const UPLOAD_TASKS_KEY = 'upload_tasks'
const AUTO_RESUME_PAUSED_KEY = 'hyself_auto_resume_paused_tasks'

const openUploadTaskDb = () => {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(UPLOAD_TASK_DB_NAME, 1)
        request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(UPLOAD_TASK_STORE_NAME)) {
                db.createObjectStore(UPLOAD_TASK_STORE_NAME)
            }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

const loadUploadTasksFromDb = async (): Promise<UploadTaskItem[]> => {
    const db = await openUploadTaskDb()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(UPLOAD_TASK_STORE_NAME, 'readonly')
        const store = tx.objectStore(UPLOAD_TASK_STORE_NAME)
        const request = store.get(UPLOAD_TASKS_KEY)
        request.onsuccess = () => {
            const value = request.result
            if (!Array.isArray(value)) {
                resolve([])
                return
            }
            resolve(value as UploadTaskItem[])
        }
        request.onerror = () => reject(request.error)
    })
}

const saveUploadTasksToDb = async (tasks: UploadTaskItem[]) => {
    const db = await openUploadTaskDb()
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(UPLOAD_TASK_STORE_NAME, 'readwrite')
        const store = tx.objectStore(UPLOAD_TASK_STORE_NAME)
        store.put(tasks, UPLOAD_TASKS_KEY)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

const toStorableTask = (task: UploadTaskItem): UploadTaskItem => {
    const rawTask = toRaw(task)
    const rawFile = rawTask.file ? toRaw(rawTask.file) : null
    return {
        ...rawTask,
        file: rawFile instanceof File ? rawFile : null,
    }
}

const normalizeTaskRelativePath = (file: File): string => {
    const raw = String((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name || '')
    return raw.replace(/\\/g, '/').replace(/^\/+/, '')
}

const cloneUploadFileSnapshot = async (file: File): Promise<File> => {
    let buffer: ArrayBuffer
    try {
        buffer = await file.arrayBuffer()
    } catch {
        throw new Error('读取源文件失败，文件可能正在被其他程序占用或持续写入；请先复制一份稳定文件后再上传')
    }
    const snapshot = new File([buffer], file.name, {
        type: file.type,
        lastModified: file.lastModified,
    }) as File & { webkitRelativePath?: string }
    const relativePath = normalizeTaskRelativePath(file)
    Object.defineProperty(snapshot, 'webkitRelativePath', {
        configurable: true,
        enumerable: false,
        value: relativePath,
    })
    return snapshot
}

const resolveUploadErrorMessage = (error: unknown) => {
    const maybeError = error as {
        message?: string
        response?: unknown
        request?: unknown
    }
    const message = String(maybeError?.message || '')
    if (message.includes('ERR_UPLOAD_FILE_CHANGED')) {
        return '源文件在上传过程中被外部程序改动，已中断上传；请重新选择文件或先复制一份再上传'
    }
    if (message === 'Network Error' && !maybeError?.response && maybeError?.request) {
        return '上传过程中发生网络中断；如果源文件是日志等正在写入的文件，也可能是浏览器检测到文件已变化，请先复制一份稳定文件后再上传'
    }
    return message || '上传失败'
}

const pickDisplayName = (relativePath: string, fileName: string): string => {
    const normalized = (relativePath || '').split('/').filter(Boolean)
    if (normalized.length === 0) {
        return fileName
    }
    return normalized[normalized.length - 1] || fileName
}

const calcOverallProgress = (task: Pick<UploadTaskItem, 'hashProgress' | 'chunkProgress' | 'mergeProgress'>) => {
    return Math.min(100, Math.max(0, Math.floor((task.hashProgress + task.chunkProgress + task.mergeProgress) / 3)))
}

export const useFileStore = defineStore('file', () => {
    const entries = ref<FileEntryItem[]>([])
    const breadcrumbs = ref<Array<{ id: number | null; name: string; owner_user_id?: number | null; virtual_path?: string | null }>>([{ id: null, name: '我的文件' }])
    const currentParentId = ref<number | null>(null)
    const currentParent = ref<FileEntryItem | null>(null)
    const currentScope = ref<FileManageScope>('user')
    const currentOwnerUserId = ref<number | null>(null)
    const currentVirtualPath = ref<string | null>(null)
    const loadingEntries = ref(false)

    const uploadTasks = ref<UploadTaskItem[]>([])
    const pauseAllRequested = ref(false)
    const isUploadQueueRunning = ref(false)
    const isRestoringUploadTasks = ref(true)
    const autoResumePausedOnReload = ref(localStorage.getItem(AUTO_RESUME_PAUSED_KEY) === '1')

    const overallUploadProgress = computed(() => {
        if (uploadTasks.value.length === 0) return 0
        const sum = uploadTasks.value.reduce((acc, item) => acc + item.progress, 0)
        return Math.floor(sum / uploadTasks.value.length)
    })

    const activeUploadingCount = computed(() => uploadTasks.value.filter((item) => item.status === 'uploading').length)
    const resumableCount = computed(() => uploadTasks.value.filter((item) => item.status === 'paused' || item.status === 'failed').length)
    const pausedCount = computed(() => uploadTasks.value.filter((item) => item.status === 'paused').length)
    const hasStartedUpload = computed(() => uploadTasks.value.some((item) => item.status !== 'pending'))
    const hasIncompleteTasks = computed(() =>
        uploadTasks.value.some(
            (item) => item.status === 'pending' || item.status === 'uploading' || item.status === 'paused' || item.status === 'failed',
        ),
    )
    const canResumeAll = computed(() =>
        uploadTasks.value.some((item) => item.status === 'pending' || item.status === 'paused' || item.status === 'failed'),
    )
    const canPauseAll = computed(() => isUploadQueueRunning.value && hasStartedUpload.value && hasIncompleteTasks.value)
    const canCancelAll = computed(() =>
        uploadTasks.value.some(
            (item) => item.status === 'pending' || item.status === 'uploading' || item.status === 'paused' || item.status === 'failed',
        ),
    )

    const setScope = (scope: FileManageScope) => {
        if (currentScope.value === scope) {
            return
        }
        currentScope.value = scope
        entries.value = []
        currentParent.value = null
        currentParentId.value = null
        currentOwnerUserId.value = null
        currentVirtualPath.value = null
        breadcrumbs.value = [{ id: null, name: scope === 'system' ? '系统文件' : '我的文件' }]
    }

    const loadEntries = async (parentId?: number | null, ownerUserId?: number | null, virtualPath?: string | null) => {
        loadingEntries.value = true
        try {
            const targetParentId = parentId === undefined ? currentParentId.value : parentId
            const targetOwnerUserId = currentScope.value === 'system'
                ? (ownerUserId === undefined ? currentOwnerUserId.value : ownerUserId)
                : null
            const targetVirtualPath = currentScope.value === 'system'
                ? (virtualPath === undefined ? currentVirtualPath.value : virtualPath)
                : null
            const { data } = await getFileEntriesApi(targetParentId, currentScope.value, targetOwnerUserId, targetVirtualPath)
            entries.value = data.items
            breadcrumbs.value = data.breadcrumbs
            currentParent.value = data.parent
            currentParentId.value = data.parent?.is_virtual ? null : (data.parent?.id ?? (targetParentId ?? null))
            currentOwnerUserId.value = currentScope.value === 'system' ? (data.owner_user?.id ?? targetOwnerUserId ?? null) : null
            currentVirtualPath.value = currentScope.value === 'system' ? (data.parent?.virtual_path ?? targetVirtualPath ?? null) : null
        } finally {
            loadingEntries.value = false
        }
    }

    const enterFolder = async (folder: FileEntryItem) => {
        if (!folder.is_dir) return
        if (currentScope.value === 'system' && folder.is_virtual && folder.virtual_path) {
            await loadEntries(null, null, folder.virtual_path)
            return
        }
        if (currentScope.value === 'system' && !currentOwnerUserId.value && folder.is_virtual && folder.owner_user_id) {
            await loadEntries(null, folder.owner_user_id)
            return
        }
        await loadEntries(folder.id)
    }

    const goToBreadcrumb = async (item: { id: number | null; owner_user_id?: number | null; virtual_path?: string | null }) => {
        await loadEntries(item.virtual_path ? null : item.id, item.owner_user_id ?? null, item.virtual_path ?? null)
    }

    const createFolder = async (name: string, parentId?: number | null) => {
        if (currentScope.value === 'system') {
            throw new Error('系统文件管理暂不支持新建目录')
        }
        await createFolderApi({
            name,
            parent_id: parentId ?? currentParentId.value,
        })
        await loadEntries(parentId ?? currentParentId.value)
    }

    const deleteEntry = async (id: number) => {
        const { data } = await deleteFileEntryApi(id, currentScope.value)
        await loadEntries(currentParentId.value, currentOwnerUserId.value)
        return data
    }

    const renameEntry = async (id: number, name: string) => {
        if (currentScope.value === 'system') {
            throw new Error('系统文件管理暂不支持重命名')
        }
        await renameFileEntryApi({ id, name })
        await loadEntries(currentParentId.value, currentOwnerUserId.value)
    }

    const restoreRecycleEntry = async (id: number) => {
        if (currentScope.value === 'system') {
            throw new Error('系统文件管理不存在回收站')
        }
        const { data } = await restoreRecycleBinEntryApi(id)
        await loadEntries(currentParentId.value, currentOwnerUserId.value)
        return data
    }

    const clearRecycleBinEntries = async (ids?: number[]) => {
        if (currentScope.value === 'system') {
            throw new Error('系统文件管理不存在回收站')
        }
        const { data } = await clearRecycleBinApi(ids)
        await loadEntries(currentParentId.value, currentOwnerUserId.value)
        return data
    }

    const addUploadFiles = async (files: File[], parentId?: number | null) => {
        const normalizedParentId = parentId ?? currentParentId.value
        const snapshotFiles = await Promise.all(files.map((file) => cloneUploadFileSnapshot(file)))
        const tasks = snapshotFiles.map<UploadTaskItem>((file) => {
            const relativePath = normalizeTaskRelativePath(file)
            return {
                id: toTaskId(),
                file: markRaw(file),
                parentId: normalizedParentId,
                relativePath,
                displayName: pickDisplayName(relativePath, file.name),
                size: file.size,
                status: 'pending',
                progress: 0,
                hashProgress: 0,
                chunkProgress: 0,
                mergeProgress: 0,
                resultPath: '',
                errorMessage: '',
            }
        })
        uploadTasks.value = [...tasks, ...uploadTasks.value]
    }

    const getTaskById = (taskId: string) => uploadTasks.value.find((item) => item.id === taskId)

    const runTaskUpload = async (taskId: string) => {
        const authStore = useAuthStore()
        const task = getTaskById(taskId)
        if (!task) {
            return
        }

        if (!authStore.accessToken) {
            throw new Error('登录状态已失效，请重新登录后继续上传')
        }

        if (!task.file) {
            task.status = 'failed'
            task.errorMessage = '原始文件不可用，请重新选择文件'
            return
        }

        task.status = 'uploading'
        task.errorMessage = ''

        try {
            const result = await uploadFileWithCategory({
                file: task.file,
                token: authStore.accessToken,
                parentId: task.parentId,
                relativePath: task.relativePath,
                onHashProgress: (progress) => {
                    task.hashProgress = Math.max(task.hashProgress, progress)
                    task.progress = Math.max(task.progress, calcOverallProgress(task))
                },
                onChunkProgress: (progress) => {
                    task.chunkProgress = Math.max(task.chunkProgress, progress)
                    task.progress = Math.max(task.progress, calcOverallProgress(task))
                },
                onMergeProgress: (progress) => {
                    task.mergeProgress = Math.max(task.mergeProgress, progress)
                    task.progress = Math.max(task.progress, calcOverallProgress(task))
                },
                shouldPause: () => task.status === 'paused',
                shouldCancel: () => task.status === 'canceled',
            })

            task.progress = 100
            task.hashProgress = 100
            task.chunkProgress = 100
            task.mergeProgress = 100
            task.resultPath = result.relativePath
            task.status = 'completed'

            if ((task.parentId ?? null) === (currentParentId.value ?? null)) {
                await loadEntries(currentParentId.value, currentOwnerUserId.value)
            }
        } catch (error: unknown) {
            const message = String((error as { message?: string } | undefined)?.message || '')
            if (message.includes('暂停')) {
                task.status = 'paused'
                return
            }
            if (message.includes('取消')) {
                task.status = 'canceled'
                return
            }
            task.status = 'failed'
            task.errorMessage = resolveUploadErrorMessage(error)
        }
    }

    const startPendingUploads = async () => {
        pauseAllRequested.value = false
        isUploadQueueRunning.value = true
        let startedCount = 0
        try {
            for (const task of uploadTasks.value) {
                if (pauseAllRequested.value) {
                    break
                }
                if (task.status === 'pending' || task.status === 'failed') {
                    startedCount += 1
                    // eslint-disable-next-line no-await-in-loop
                    await runTaskUpload(task.id)
                }
            }
        } finally {
            isUploadQueueRunning.value = false
        }
        return startedCount
    }

    const pauseTask = (taskId: string) => {
        const task = getTaskById(taskId)
        if (!task) return
        if (task.status === 'uploading') {
            task.status = 'paused'
        }
    }

    const pauseAllTasks = () => {
        pauseAllRequested.value = true
        isUploadQueueRunning.value = false
        uploadTasks.value.forEach((task) => {
            if (task.status === 'uploading') {
                task.status = 'paused'
            }
        })
    }

    const resumeAllTasks = async () => {
        let hasResumable = false
        for (const task of uploadTasks.value) {
            if (task.status === 'paused' || task.status === 'failed') {
                task.status = 'pending'
                task.errorMessage = ''
                hasResumable = true
            }
        }

        const hasPending = uploadTasks.value.some((task) => task.status === 'pending')
        if (!hasResumable && !hasPending) {
            return 0
        }

        return startPendingUploads()
    }

    const resumePausedTasks = async () => {
        let hasPaused = false
        for (const task of uploadTasks.value) {
            if (task.status === 'paused') {
                task.status = 'pending'
                task.errorMessage = ''
                hasPaused = true
            }
        }

        if (!hasPaused) {
            return 0
        }

        return startPendingUploads()
    }

    const resumeTask = async (taskId: string) => {
        const task = getTaskById(taskId)
        if (!task) return
        pauseAllRequested.value = false
        if (task.status === 'paused' || task.status === 'failed' || task.status === 'pending') {
            isUploadQueueRunning.value = true
            try {
                await runTaskUpload(taskId)
            } finally {
                isUploadQueueRunning.value = false
            }
        }
    }

    const cancelTask = (taskId: string) => {
        const task = getTaskById(taskId)
        if (!task) return
        task.status = 'canceled'
    }

    const cancelAllTasks = () => {
        pauseAllRequested.value = true
        isUploadQueueRunning.value = false
        let canceledCount = 0
        uploadTasks.value.forEach((task) => {
            if (task.status === 'pending' || task.status === 'uploading' || task.status === 'paused' || task.status === 'failed') {
                task.status = 'canceled'
                canceledCount += 1
            }
        })
        return canceledCount
    }

    const clearFinishedTasks = () => {
        uploadTasks.value = uploadTasks.value.filter((item) => item.status === 'uploading' || item.status === 'paused' || item.status === 'pending')
    }

    const setAutoResumePausedOnReload = (enabled: boolean) => {
        autoResumePausedOnReload.value = enabled
    }

    const restoreUploadTasks = async () => {
        try {
            const tasks = await loadUploadTasksFromDb()
            if (uploadTasks.value.length === 0) {
                uploadTasks.value = tasks.map((task) => ({
                    ...task,
                    file: task.file instanceof File ? markRaw(task.file) : null,
                }))
            }
        } catch {
            // ignore restore failures and keep runtime queue
        } finally {
            isRestoringUploadTasks.value = false
        }
    }

    void restoreUploadTasks()

    watch(
        uploadTasks,
        async (tasks) => {
            if (isRestoringUploadTasks.value) {
                return
            }
            try {
                const snapshot = tasks.map((task) => toStorableTask(task))
                await saveUploadTasksToDb(snapshot)
            } catch (error) {
                console.warn('保存上传任务到 IndexedDB 失败', error)
            }
        },
        { deep: true },
    )

    watch(
        autoResumePausedOnReload,
        (enabled) => {
            localStorage.setItem(AUTO_RESUME_PAUSED_KEY, enabled ? '1' : '0')
        },
        { immediate: true },
    )

    return {
        entries,
        breadcrumbs,
        currentParentId,
        currentParent,
        currentScope,
        currentOwnerUserId,
        currentVirtualPath,
        loadingEntries,
        uploadTasks,
        overallUploadProgress,
        activeUploadingCount,
        resumableCount,
        pausedCount,
        canResumeAll,
        canPauseAll,
        canCancelAll,
        autoResumePausedOnReload,
        setScope,
        loadEntries,
        enterFolder,
        goToBreadcrumb,
        createFolder,
        deleteEntry,
        renameEntry,
        restoreRecycleEntry,
        clearRecycleBinEntries,
        addUploadFiles,
        runTaskUpload,
        startPendingUploads,
        pauseTask,
        pauseAllTasks,
        resumeAllTasks,
        resumePausedTasks,
        resumeTask,
        cancelTask,
        cancelAllTasks,
        clearFinishedTasks,
        setAutoResumePausedOnReload,
    }
})
