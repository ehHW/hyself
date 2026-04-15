import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFileStore } from '@/stores/file'

const mocks = vi.hoisted(() => ({
    getFileEntriesApi: vi.fn(),
    clearRecycleBinApi: vi.fn(),
    createFolderApi: vi.fn(),
    deleteFileEntryApi: vi.fn(),
    renameFileEntryApi: vi.fn(),
    restoreRecycleBinEntryApi: vi.fn(),
}))

vi.mock('@/api/upload', () => ({
    getFileEntriesApi: mocks.getFileEntriesApi,
    clearRecycleBinApi: mocks.clearRecycleBinApi,
    createFolderApi: mocks.createFolderApi,
    deleteFileEntryApi: mocks.deleteFileEntryApi,
    renameFileEntryApi: mocks.renameFileEntryApi,
    restoreRecycleBinEntryApi: mocks.restoreRecycleBinEntryApi,
}))

vi.mock('@/utils/fileUploader', () => ({
    uploadFileWithCategory: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
    useAuthStore: () => ({
        accessToken: 'access-token',
    }),
}))

const installIndexedDbMock = () => {
    const db = {
        objectStoreNames: {
            contains: () => true,
        },
        createObjectStore: vi.fn(),
        transaction: () => ({
            objectStore: () => ({
                get: () => {
                    const request: {
                        result?: unknown
                        onsuccess: null | (() => void)
                        onerror: null | (() => void)
                    } = {
                        result: [],
                        onsuccess: null,
                        onerror: null,
                    }
                    queueMicrotask(() => request.onsuccess?.())
                    return request
                },
                put: vi.fn(),
            }),
            oncomplete: null,
            onerror: null,
            error: null,
        }),
    }

    Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        writable: true,
        value: {
            open: () => {
                const request: {
                    result: typeof db
                    error: null
                    onupgradeneeded: null | (() => void)
                    onsuccess: null | (() => void)
                    onerror: null | (() => void)
                } = {
                    result: db,
                    error: null,
                    onupgradeneeded: null,
                    onsuccess: null,
                    onerror: null,
                }
                queueMicrotask(() => {
                    request.onupgradeneeded?.()
                    request.onsuccess?.()
                })
                return request
            },
        },
    })
}

describe('useFileStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        vi.clearAllMocks()
        installIndexedDbMock()
    })

    it('uses virtual path when entering a system virtual directory', async () => {
        mocks.getFileEntriesApi.mockResolvedValue({
            data: {
                items: [],
                breadcrumbs: [
                    { id: null, name: '系统文件', virtual_path: '__video_artifacts__' },
                    { id: null, name: '任务一', virtual_path: '__video_artifacts__/task-1' },
                ],
                parent: {
                    id: null,
                    display_name: '任务一',
                    stored_name: '任务一',
                    is_dir: true,
                    is_virtual: true,
                    virtual_path: '__video_artifacts__/task-1',
                    virtual_kind: 'video_artifact_directory',
                    parent_id: null,
                    file_size: 0,
                    file_md5: '',
                    relative_path: '',
                    url: '',
                    created_at: '',
                    updated_at: '',
                    is_system: true,
                    is_recycle_bin: false,
                    recycled_at: null,
                    expires_at: null,
                    remaining_days: null,
                    recycle_original_parent_id: null,
                },
                owner_user: { id: 9, name: 'admin' },
            },
        })

        const fileStore = useFileStore()
        fileStore.setScope('system')

        await fileStore.enterFolder({
            id: null as unknown as number,
            display_name: '任务一',
            stored_name: '任务一',
            is_dir: true,
            is_virtual: true,
            virtual_path: '__video_artifacts__/task-1',
            virtual_kind: 'video_artifact_directory',
            parent_id: null,
            file_size: 0,
            file_md5: '',
            relative_path: '',
            url: '',
            created_at: '',
            updated_at: '',
            is_system: true,
            is_recycle_bin: false,
            recycled_at: null,
            expires_at: null,
            remaining_days: null,
            recycle_original_parent_id: null,
        })

        expect(mocks.getFileEntriesApi).toHaveBeenCalledWith(
            null,
            'system',
            null,
            '__video_artifacts__/task-1',
        )
        expect(fileStore.currentVirtualPath).toBe('__video_artifacts__/task-1')
        expect(fileStore.currentParentId).toBeNull()
    })

    it('keeps virtual breadcrumb navigation on system scope', async () => {
        mocks.getFileEntriesApi.mockResolvedValue({
            data: {
                items: [],
                breadcrumbs: [
                    { id: null, name: '系统文件', virtual_path: '__video_artifacts__' },
                ],
                parent: {
                    id: null,
                    display_name: '视频产物',
                    stored_name: '视频产物',
                    is_dir: true,
                    is_virtual: true,
                    virtual_path: '__video_artifacts__',
                    virtual_kind: 'video_artifacts_root',
                    parent_id: null,
                    file_size: 0,
                    file_md5: '',
                    relative_path: '',
                    url: '',
                    created_at: '',
                    updated_at: '',
                    is_system: true,
                    is_recycle_bin: false,
                    recycled_at: null,
                    expires_at: null,
                    remaining_days: null,
                    recycle_original_parent_id: null,
                },
                owner_user: { id: 9, name: 'admin' },
            },
        })

        const fileStore = useFileStore()
        fileStore.setScope('system')

        await fileStore.goToBreadcrumb({
            id: null,
            owner_user_id: 9,
            virtual_path: '__video_artifacts__',
        })

        expect(mocks.getFileEntriesApi).toHaveBeenCalledWith(
            null,
            'system',
            9,
            '__video_artifacts__',
        )
        expect(fileStore.breadcrumbs[0]?.virtual_path).toBe('__video_artifacts__')
    })

    it('upserts and removes local entries with directory-first ordering', () => {
        const fileStore = useFileStore()

        fileStore.entries = [
            {
                id: 2,
                display_name: 'z-file.txt',
                stored_name: 'z-file.txt',
                is_dir: false,
                parent_id: null,
                file_size: 1,
                file_md5: '',
                relative_path: 'z-file.txt',
                url: '',
                created_at: '',
                updated_at: '',
                is_system: false,
                is_recycle_bin: false,
                recycled_at: null,
                expires_at: null,
                remaining_days: null,
                recycle_original_parent_id: null,
            },
        ]

        fileStore.upsertEntryLocally({
            id: 1,
            display_name: 'a-folder',
            stored_name: 'a-folder',
            is_dir: true,
            parent_id: null,
            file_size: 0,
            file_md5: '',
            relative_path: 'a-folder',
            url: '',
            created_at: '',
            updated_at: '',
            is_system: false,
            is_recycle_bin: false,
            recycled_at: null,
            expires_at: null,
            remaining_days: null,
            recycle_original_parent_id: null,
        })
        fileStore.upsertEntryLocally({
            id: 3,
            display_name: 'a-file.txt',
            stored_name: 'a-file.txt',
            is_dir: false,
            parent_id: null,
            file_size: 1,
            file_md5: '',
            relative_path: 'a-file.txt',
            url: '',
            created_at: '',
            updated_at: '',
            is_system: false,
            is_recycle_bin: false,
            recycled_at: null,
            expires_at: null,
            remaining_days: null,
            recycle_original_parent_id: null,
        })

        expect(fileStore.entries.map((item) => item.id)).toEqual([1, 3, 2])

        fileStore.removeEntryLocally(3)

        expect(fileStore.entries.map((item) => item.id)).toEqual([1, 2])
    })
})