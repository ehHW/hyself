import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAssetPickerScene } from '@/components/assets/useAssetPickerScene'

const mocks = vi.hoisted(() => ({
    getFileEntriesApi: vi.fn(),
    searchFileEntriesApi: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
}))

vi.mock('@/api/upload', () => ({
    getFileEntriesApi: mocks.getFileEntriesApi,
    searchFileEntriesApi: mocks.searchFileEntriesApi,
}))

vi.mock('ant-design-vue', () => ({
    message: {
        info: mocks.info,
        warning: mocks.warning,
    },
}))

describe('useAssetPickerScene', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('loads root entries when the picker opens', async () => {
        mocks.getFileEntriesApi.mockResolvedValue({
            data: {
                items: [
                    {
                        id: 1,
                        display_name: '设计稿.pdf',
                        stored_name: 'design.pdf',
                        is_dir: false,
                        parent_id: null,
                        file_size: 1024,
                        file_md5: 'md5',
                        relative_path: 'users/demo/design.pdf',
                        url: '/uploads/design.pdf',
                        created_at: '2025-01-01T00:00:00Z',
                        updated_at: '2025-01-01T00:00:00Z',
                        is_system: false,
                        is_recycle_bin: false,
                        recycled_at: null,
                        expires_at: null,
                        remaining_days: null,
                        recycle_original_parent_id: null,
                        asset_reference_id: 10,
                        asset_reference: null,
                        asset: null,
                    },
                ],
                breadcrumbs: [{ id: null, name: '我的文件' }],
                parent: null,
            },
        })

        const open = ref(false)
        const scene = useAssetPickerScene({ enabled: open })

        open.value = true
        await nextTick()
        await Promise.resolve()

        expect(mocks.getFileEntriesApi).toHaveBeenCalledWith(
            null,
            'user',
            null,
            null,
        )
        expect(scene.tableData.value).toHaveLength(1)
        expect(scene.breadcrumbs.value).toEqual([{ id: null, name: '我的文件' }])
    })

    it('returns normalized selection for selectable files', () => {
        const open = ref(false)
        const scene = useAssetPickerScene({ enabled: open })

        const selection = scene.pickItem({
            id: 8,
            display_name: '发布会.mp4',
            stored_name: 'release.mp4',
            is_dir: false,
            parent_id: null,
            file_size: 8192,
            file_md5: 'md5',
            relative_path: 'users/demo/release.mp4',
            url: '/uploads/release.mp4',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
            is_system: false,
            is_recycle_bin: false,
            recycled_at: null,
            expires_at: null,
            remaining_days: null,
            recycle_original_parent_id: null,
            asset_reference_id: 32,
            asset_reference: null,
            asset: {
                id: 10,
                file_md5: 'md5',
                sha256: null,
                storage_backend: 'local',
                storage_key: 'users/demo/release.mp4',
                mime_type: 'video/mp4',
                media_type: 'video',
                file_size: 8192,
                original_name: '发布会.mp4',
                extension: '.mp4',
                width: null,
                height: null,
                duration_seconds: null,
                extra_metadata: {},
                url: '/uploads/release.mp4',
            },
        })

        expect(selection).toMatchObject({
            entryId: 8,
            assetReferenceId: 32,
            displayName: '发布会.mp4',
            mediaType: 'video',
        })
    })

    it('warns when trying to pick a file without asset reference', () => {
        const open = ref(false)
        const scene = useAssetPickerScene({ enabled: open })

        const selection = scene.pickItem({
            id: 9,
            display_name: '孤立文件.txt',
            stored_name: 'orphan.txt',
            is_dir: false,
            parent_id: null,
            file_size: 128,
            file_md5: 'md5',
            relative_path: 'users/demo/orphan.txt',
            url: '/uploads/orphan.txt',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
            is_system: false,
            is_recycle_bin: false,
            recycled_at: null,
            expires_at: null,
            remaining_days: null,
            recycle_original_parent_id: null,
            asset_reference_id: null,
            asset_reference: null,
            asset: null,
        })

        expect(selection).toBeNull()
        expect(mocks.warning).toHaveBeenCalledWith('该文件缺少资产引用，暂时无法发送')
    })

    it('supports folder-only selection with allowed directory kinds', () => {
        const scene = useAssetPickerScene({
            selectionMode: 'folder',
            allowedKinds: ['directory'],
        })

        expect(scene.canSelect({
            id: 41,
            display_name: '普通目录',
            stored_name: '普通目录',
            is_dir: true,
            is_virtual: false,
            parent_id: null,
            file_size: 0,
            file_md5: '',
            relative_path: 'normal-folder',
            url: '',
            created_at: '',
            updated_at: '',
            is_system: false,
            is_recycle_bin: false,
            recycled_at: null,
            expires_at: null,
            remaining_days: null,
            recycle_original_parent_id: null,
        })).toBe(true)

        expect(scene.canSelect({
            id: 42,
            display_name: '虚拟目录',
            stored_name: '虚拟目录',
            is_dir: true,
            is_virtual: true,
            virtual_path: '__video_artifacts__',
            parent_id: null,
            file_size: 0,
            file_md5: '',
            relative_path: '__video_artifacts__',
            url: '',
            created_at: '',
            updated_at: '',
            is_system: true,
            is_recycle_bin: false,
            recycled_at: null,
            expires_at: null,
            remaining_days: null,
            recycle_original_parent_id: null,
        })).toBe(false)
    })

    it('filters selectable files by allowed media kinds', () => {
        const scene = useAssetPickerScene({
            allowedKinds: ['image'],
        })

        expect(scene.canSelect({
            id: 51,
            display_name: '海报.png',
            stored_name: 'poster.png',
            is_dir: false,
            parent_id: null,
            file_size: 2048,
            file_md5: 'md5',
            relative_path: 'poster.png',
            url: '/uploads/poster.png',
            created_at: '',
            updated_at: '',
            is_system: false,
            is_recycle_bin: false,
            recycled_at: null,
            expires_at: null,
            remaining_days: null,
            recycle_original_parent_id: null,
            asset_reference_id: 81,
            asset_reference: null,
            asset: {
                id: 91,
                file_md5: 'md5',
                sha256: null,
                storage_backend: 'local',
                storage_key: 'poster.png',
                mime_type: 'image/png',
                media_type: 'image',
                file_size: 2048,
                original_name: '海报.png',
                extension: '.png',
                width: null,
                height: null,
                duration_seconds: null,
                extra_metadata: {},
                url: '/uploads/poster.png',
            },
        })).toBe(true)

        expect(scene.canSelect({
            id: 52,
            display_name: '预告片.mp4',
            stored_name: 'trailer.mp4',
            is_dir: false,
            parent_id: null,
            file_size: 4096,
            file_md5: 'md5',
            relative_path: 'trailer.mp4',
            url: '/uploads/trailer.mp4',
            created_at: '',
            updated_at: '',
            is_system: false,
            is_recycle_bin: false,
            recycled_at: null,
            expires_at: null,
            remaining_days: null,
            recycle_original_parent_id: null,
            asset_reference_id: 82,
            asset_reference: null,
            asset: {
                id: 92,
                file_md5: 'md5',
                sha256: null,
                storage_backend: 'local',
                storage_key: 'trailer.mp4',
                mime_type: 'video/mp4',
                media_type: 'video',
                file_size: 4096,
                original_name: '预告片.mp4',
                extension: '.mp4',
                width: null,
                height: null,
                duration_seconds: null,
                extra_metadata: {},
                url: '/uploads/trailer.mp4',
            },
        })).toBe(false)
    })

    it('supports embedded workspace text config without modal open state', async () => {
        mocks.getFileEntriesApi.mockResolvedValue({
            data: {
                items: [],
                breadcrumbs: [{ id: null, name: '资源中心' }],
                parent: null,
            },
        })

        const scene = useAssetPickerScene({
            text: {
                rootBreadcrumbName: '资源中心',
                missingAssetReferenceMessage: '当前记录不能作为资源选择结果',
            },
        })

        await nextTick()
        await Promise.resolve()

        expect(mocks.getFileEntriesApi).toHaveBeenCalledWith(
            null,
            'user',
            null,
            null,
        )
        expect(scene.breadcrumbs.value).toEqual([{ id: null, name: '资源中心' }])

        const selection = scene.pickItem({
            id: 10,
            display_name: '目录快照',
            stored_name: 'snapshot.txt',
            is_dir: false,
            parent_id: null,
            file_size: 1,
            file_md5: 'md5',
            relative_path: 'snapshot.txt',
            url: '/uploads/snapshot.txt',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
            is_system: false,
            is_recycle_bin: false,
            recycled_at: null,
            expires_at: null,
            remaining_days: null,
            recycle_original_parent_id: null,
            asset_reference_id: null,
            asset_reference: null,
            asset: null,
        })

        expect(selection).toBeNull()
        expect(mocks.warning).toHaveBeenCalledWith('当前记录不能作为资源选择结果')
    })

    it('loads system resources with owner and virtual path seeds', async () => {
        mocks.getFileEntriesApi.mockResolvedValue({
            data: {
                items: [],
                breadcrumbs: [
                    { id: null, name: '系统文件', owner_user_id: 7 },
                    { id: null, name: '视频产物', owner_user_id: 7, virtual_path: '__video_artifacts__' },
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
                owner_user: { id: 7, name: 'admin' },
            },
        })
        mocks.searchFileEntriesApi.mockResolvedValue({
            data: {
                items: [],
            },
        })

        const enabled = ref(true)
        const scope = ref<'user' | 'system'>('system')
        const ownerUserId = ref<number | null>(7)
        const virtualPath = ref<string | null>('__video_artifacts__')
        const parentId = ref<number | null>(null)

        const scene = useAssetPickerScene({
            enabled,
            scope,
            ownerUserId,
            virtualPath,
            parentId,
        })

        await nextTick()
        await Promise.resolve()

        expect(mocks.getFileEntriesApi).toHaveBeenCalledWith(
            null,
            'system',
            7,
            '__video_artifacts__',
        )
        expect(scene.currentOwnerUserId.value).toBe(7)
        expect(scene.currentVirtualPath.value).toBe('__video_artifacts__')
        expect(scene.columns.value.some((item) => item.key === 'owner')).toBe(false)

        scene.searchKeyword.value = '产物'
        await scene.doFullSearch()

        expect(mocks.searchFileEntriesApi).toHaveBeenCalledWith(
            '产物',
            200,
            'system',
            7,
        )
    })
})