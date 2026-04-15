import { message } from 'ant-design-vue'
import { computed, getCurrentScope, onScopeDispose, ref, unref, watch, type Ref } from 'vue'
import { getFileEntriesApi, searchFileEntriesApi } from '@/api/upload'
import type { FileEntryItem, FileManageScope, SearchFileEntryItem } from '@/api/upload'
import {
    buildAssetPickerSelection,
    type AssetPickerSelection,
} from '@/components/assets/assetPickerAdapter'
import { trimText } from '@/validators/common'

type AssetPickerEntry = FileEntryItem | SearchFileEntryItem

type AssetPickerBreadcrumb = {
    id: number | null
    name: string
    owner_user_id?: number | null
    virtual_path?: string | null
}

type MaybeRefValue<T> = T | Readonly<Ref<T>>

export type AssetPickerTextConfig = {
    rootBreadcrumbName: string
    searchPlaceholder: string
    refreshButtonText: string
    searchButtonText: string
    resetButtonText: string
    selectActionText: string
    enterActionText: string
    previewActionText: string
    noSearchResultMessage: string
    missingAssetReferenceMessage: string
}

export type AssetPickerSelectionMode = 'file' | 'folder'

export type AssetPickerAllowedKind =
    | 'any-file'
    | 'image'
    | 'video'
    | 'audio'
    | 'file'
    | 'resource_center'
    | 'chat_attachment'
    | 'chat_upload'
    | 'directory'
    | 'virtual_directory'
    | 'recycle_bin'

export const DEFAULT_ASSET_PICKER_TEXT: AssetPickerTextConfig = {
    rootBreadcrumbName: '我的文件',
    searchPlaceholder: '搜索文件名...',
    refreshButtonText: '刷新',
    searchButtonText: '搜索全部',
    resetButtonText: '重置',
    selectActionText: '选择',
    enterActionText: '进入',
    previewActionText: '查看',
    noSearchResultMessage: '没有找到匹配的文件',
    missingAssetReferenceMessage: '该文件缺少资产引用，暂时无法发送',
}

export type UseAssetPickerSceneOptions = {
    enabled?: MaybeRefValue<boolean>
    scope?: MaybeRefValue<FileManageScope>
    parentId?: MaybeRefValue<number | null | undefined>
    ownerUserId?: MaybeRefValue<number | null | undefined>
    virtualPath?: MaybeRefValue<string | null | undefined>
    selectionMode?: MaybeRefValue<AssetPickerSelectionMode | undefined>
    allowedKinds?: MaybeRefValue<AssetPickerAllowedKind[] | undefined>
    text?: MaybeRefValue<Partial<AssetPickerTextConfig> | undefined>
}

export function resolveAssetPickerTextConfig(
    overrides?: Partial<AssetPickerTextConfig>,
): AssetPickerTextConfig {
    return {
        ...DEFAULT_ASSET_PICKER_TEXT,
        ...overrides,
    }
}

export function useAssetPickerScene(options?: UseAssetPickerSceneOptions) {
    const text = computed(() => resolveAssetPickerTextConfig(unref(options?.text)))
    const currentScope = computed<FileManageScope>(() => unref(options?.scope) ?? 'user')
    const selectionMode = computed<AssetPickerSelectionMode>(() => unref(options?.selectionMode) ?? 'file')
    const allowedKinds = computed(() => unref(options?.allowedKinds) ?? [])
    const entries = ref<FileEntryItem[]>([])
    const breadcrumbs = ref<AssetPickerBreadcrumb[]>([
        { id: null, name: text.value.rootBreadcrumbName },
    ])
    const currentParentId = ref<number | null>(null)
    const currentOwnerUserId = ref<number | null>(null)
    const currentVirtualPath = ref<string | null>(null)
    const loading = ref(false)

    const searchKeyword = ref('')
    const suggestResults = ref<SearchFileEntryItem[]>([])
    const searchResults = ref<SearchFileEntryItem[]>([])
    const searchLoading = ref(false)
    const isSearchMode = ref(false)

    let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

    const columns = computed(() => {
        if (!isSearchMode.value) {
            return [
                {
                    title: '名称',
                    dataIndex: 'display_name',
                    key: 'name',
                    width: 320,
                },
                { title: '类型', key: 'type', width: 120 },
                { title: '大小', key: 'size', width: 120 },
                {
                    title: '更新时间',
                    dataIndex: 'updated_at',
                    key: 'updated_at',
                    width: 220,
                },
                { title: '操作', key: 'actions', width: 140 },
            ]
        }

        return [
            { title: '名称', dataIndex: 'display_name', key: 'name', width: 260 },
            { title: '路径', key: 'path', width: 320 },
            ...(currentScope.value === 'system'
                ? [{ title: '归属用户', key: 'owner', width: 180 }]
                : []),
            { title: '类型', key: 'type', width: 120 },
            { title: '大小', key: 'size', width: 120 },
            {
                title: '更新时间',
                dataIndex: 'updated_at',
                key: 'updated_at',
                width: 220,
            },
            { title: '操作', key: 'actions', width: 140 },
        ]
    })

    const tableData = computed<AssetPickerEntry[]>(() => (
        isSearchMode.value ? searchResults.value : entries.value
    ))

    const getNormalizedKeyword = () => {
        const raw =
            typeof searchKeyword.value === 'string'
                ? searchKeyword.value
                : String(searchKeyword.value ?? '')
        return trimText(raw)
    }

    const searchOptions = computed(() => {
        if (!getNormalizedKeyword()) {
            return []
        }

        return [
            {
                label: '搜索选项',
                options: suggestResults.value.slice(0, 5).map((item) => ({
                    label: `${item.display_name} (${item.directory_path || '根目录'})`,
                    value: item.display_name,
                    fileId: item.id,
                })),
            },
        ]
    })

    const clearSearchState = () => {
        searchKeyword.value = ''
        suggestResults.value = []
        searchResults.value = []
        isSearchMode.value = false
    }

    const clearSearchDebounce = () => {
        if (!searchDebounceTimer) {
            return
        }
        clearTimeout(searchDebounceTimer)
        searchDebounceTimer = null
    }

    const loadEntries = async (
        parentId?: number | null,
        ownerUserId?: number | null,
        virtualPath?: string | null,
    ) => {
        loading.value = true
        try {
            const targetParentId = parentId === undefined ? currentParentId.value : parentId
            const targetOwnerUserId = currentScope.value === 'system'
                ? (ownerUserId === undefined ? currentOwnerUserId.value : ownerUserId)
                : null
            const targetVirtualPath = currentScope.value === 'system'
                ? (virtualPath === undefined ? currentVirtualPath.value : virtualPath)
                : null
            const { data } = await getFileEntriesApi(
                targetParentId ?? null,
                currentScope.value,
                targetOwnerUserId,
                targetVirtualPath,
            )
            entries.value = data.items
            breadcrumbs.value = data.breadcrumbs
            currentParentId.value = data.parent?.is_virtual
                ? null
                : (data.parent?.id ?? (targetParentId ?? null))
            currentOwnerUserId.value = currentScope.value === 'system'
                ? (data.owner_user?.id ?? targetOwnerUserId ?? null)
                : null
            currentVirtualPath.value = currentScope.value === 'system'
                ? (data.parent?.virtual_path ?? targetVirtualPath ?? null)
                : null
        } finally {
            loading.value = false
        }
    }

    const navigateToFile = async (item: SearchFileEntryItem) => {
        if (item.is_dir) {
            if (currentScope.value === 'system' && item.is_virtual && item.virtual_path) {
                await loadEntries(null, item.owner_user_id ?? null, item.virtual_path)
            } else {
                await loadEntries(item.id, item.owner_user_id ?? null)
            }
        } else {
            const parentVirtualPath =
                currentScope.value === 'system' && item.virtual_path
                    ? item.virtual_path.split('/').slice(0, -1).join('/') || null
                    : null
            await loadEntries(item.parent_id ?? null, item.owner_user_id ?? null, parentVirtualPath)
        }
        clearSearchState()
    }

    const performSearch = async () => {
        const keyword = getNormalizedKeyword()
        if (!keyword) {
            suggestResults.value = []
            return
        }

        searchLoading.value = true
        try {
            const { data } = await searchFileEntriesApi(
                keyword,
                50,
                currentScope.value,
                currentOwnerUserId.value,
            )
            suggestResults.value = data.items
        } finally {
            searchLoading.value = false
        }
    }

    const refresh = async () => {
        if (isSearchMode.value) {
            await doFullSearch()
            return
        }
        await loadEntries(currentParentId.value)
    }

    const goToBreadcrumb = async (item: AssetPickerBreadcrumb) => {
        clearSearchState()
        await loadEntries(
            item.virtual_path ? null : item.id,
            item.owner_user_id ?? null,
            item.virtual_path ?? null,
        )
    }

    const enterFolder = async (item: AssetPickerEntry) => {
        if (!item.is_dir) {
            return
        }
        clearSearchState()
        if (currentScope.value === 'system' && item.is_virtual && item.virtual_path) {
            await loadEntries(null, item.owner_user_id ?? null, item.virtual_path)
            return
        }
        if (currentScope.value === 'system' && !currentOwnerUserId.value && item.is_virtual && item.owner_user_id) {
            await loadEntries(null, item.owner_user_id, null)
            return
        }
        await loadEntries(item.id, item.owner_user_id ?? null)
    }

    const onSearchInput = () => {
        clearSearchDebounce()
        if (!getNormalizedKeyword()) {
            suggestResults.value = []
            return
        }

        searchDebounceTimer = setTimeout(async () => {
            await performSearch()
        }, 500)
    }

    const onSearchSelect = async (value: string, option: { fileId?: number }) => {
        searchKeyword.value = value
        const item =
            suggestResults.value.find((entry) => entry.id === option?.fileId)
            || suggestResults.value.find((entry) => entry.display_name === value)

        if (item) {
            await navigateToFile(item)
        }
    }

    const doFullSearch = async () => {
        const keyword = getNormalizedKeyword()
        if (!keyword) {
            await resetSearch()
            return
        }

        searchLoading.value = true
        try {
            const { data } = await searchFileEntriesApi(
                keyword,
                200,
                currentScope.value,
                currentOwnerUserId.value,
            )
            searchResults.value = data.items
            isSearchMode.value = true
            if (searchResults.value.length === 0) {
                message.info(text.value.noSearchResultMessage)
            }
        } finally {
            searchLoading.value = false
        }
    }

    const resetSearch = async () => {
        clearSearchDebounce()
        clearSearchState()
        await loadEntries(currentParentId.value, currentOwnerUserId.value, currentVirtualPath.value)
    }

    const formatPath = (item: SearchFileEntryItem) => item.full_path

    const getEntryAllowedKinds = (item: AssetPickerEntry): AssetPickerAllowedKind[] => {
        if (item.is_dir) {
            return [
                ...(item.is_recycle_bin ? ['recycle_bin' as const] : []),
                ...(item.is_virtual ? ['virtual_directory' as const] : ['directory' as const]),
            ]
        }

        const mediaType = String(item.asset?.media_type || '').trim().toLowerCase()
        const resourceKind = item.resource_kind

        return [
            'any-file',
            'file',
            ...(mediaType === 'image' ? ['image' as const] : []),
            ...(mediaType === 'video' ? ['video' as const] : []),
            ...(mediaType === 'audio' ? ['audio' as const] : []),
            ...(resourceKind ? [resourceKind] : []),
        ]
    }

    const matchesAllowedKinds = (item: AssetPickerEntry) => {
        if (allowedKinds.value.length === 0) {
            return true
        }

        const entryKinds = getEntryAllowedKinds(item)
        return allowedKinds.value.some((kind) => entryKinds.includes(kind))
    }

    const canSelect = (item: AssetPickerEntry) => {
        if (selectionMode.value === 'folder') {
            return item.is_dir && matchesAllowedKinds(item)
        }

        return !item.is_dir && Boolean(item.asset_reference_id) && matchesAllowedKinds(item)
    }

    const pickItem = (item: AssetPickerEntry): AssetPickerSelection | null => {
        if (selectionMode.value !== 'file') {
            return null
        }
        if (!canSelect(item)) {
            message.warning(text.value.missingAssetReferenceMessage)
            return null
        }
        return buildAssetPickerSelection(item)
    }

    watch(
        () => ({
            enabled: unref(options?.enabled) ?? true,
            parentId: unref(options?.parentId),
            ownerUserId: unref(options?.ownerUserId),
            scope: currentScope.value,
            virtualPath: unref(options?.virtualPath),
        }),
        (state) => {
            if (!state.enabled) {
                return
            }
            clearSearchDebounce()
            clearSearchState()
            currentParentId.value = null
            currentOwnerUserId.value = null
            currentVirtualPath.value = null
            breadcrumbs.value = [{ id: null, name: text.value.rootBreadcrumbName }]
            void loadEntries(
                state.parentId ?? null,
                state.ownerUserId ?? null,
                state.virtualPath ?? null,
            )
        },
        { immediate: true },
    )

    if (getCurrentScope()) {
        onScopeDispose(() => {
            clearSearchDebounce()
        })
    }

    return {
        allowedKinds,
        breadcrumbs,
        canSelect,
        columns,
        currentParentId,
        currentOwnerUserId,
        currentScope,
        currentVirtualPath,
        doFullSearch,
        enterFolder,
        formatPath,
        goToBreadcrumb,
        isSearchMode,
        loading,
        onSearchInput,
        onSearchSelect,
        pickItem,
        refresh,
        resetSearch,
        searchKeyword,
        searchLoading,
        searchOptions,
        selectionMode,
        tableData,
        text,
    }
}