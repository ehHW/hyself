import instance from '@/utils/request'

export type FileManageScope = 'user' | 'system'

export interface AssetPayload {
    id: number
    file_md5: string | null
    sha256: string | null
    storage_backend: string
    storage_key: string
    mime_type: string
    media_type: string
    file_size: number
    original_name: string
    extension: string
    width: number | null
    height: number | null
    duration_seconds: number | null
    extra_metadata: Record<string, unknown>
    url: string
}

export interface AssetReferencePayload {
    id: number
    asset_id: number | null
    owner_user_id: number | null
    ref_domain: string
    ref_type: string
    ref_object_id: string
    display_name: string
    parent_reference_id: number | null
    relative_path_cache: string
    status: string
    recycled_at: string | null
    deleted_at: string | null
    visibility: string
    asset: AssetPayload | null
}

export interface FileEntryItem {
    id: number
    display_name: string
    stored_name: string
    resource_kind?: 'resource_center' | 'chat_attachment' | 'chat_upload'
    owner_user_id?: number | null
    virtual_path?: string | null
    virtual_kind?: 'video_artifacts_root' | 'video_artifact_directory' | 'video_artifact_file' | null
    is_dir: boolean
    is_virtual?: boolean
    parent_id: number | null
    file_size: number
    file_md5: string
    relative_path: string
    url: string
    created_at: string
    updated_at: string
    is_system: boolean
    is_recycle_bin: boolean
    in_recycle_bin_tree?: boolean
    recycled_at: string | null
    expires_at: string | null
    remaining_days: number | null
    recycle_original_parent_id: number | null
    owner_name?: string
    asset_reference_id?: number | null
    asset_reference?: AssetReferencePayload | null
    asset?: AssetPayload | null
}

export interface FileEntriesResponse {
    parent: FileEntryItem | null
    breadcrumbs: Array<{ id: number | null; name: string; owner_user_id?: number | null; virtual_path?: string | null }>
    items: FileEntryItem[]
    owner_user?: { id: number; name: string } | null
}

export interface SearchFileEntryItem extends FileEntryItem {
    directory_path: string
    full_path: string
}

export interface SearchFileEntriesResponse {
    items: SearchFileEntryItem[]
}

export interface RecycleBinEntriesResponse {
    items: FileEntryItem[]
}

export interface UploadPrecheckPayload {
    file_md5: string
    file_name: string
    file_size: number
    category?: string
    parent_id?: number | null
    relative_path?: string
}

const buildScopeParams = (scope: FileManageScope = 'user', ownerUserId?: number | null) => (
    scope === 'system'
        ? {
            scope: 'system',
            owner_user_id: ownerUserId ?? undefined,
        }
        : {}
)

const buildScopePayload = <T extends Record<string, unknown>>(payload: T, scope: FileManageScope = 'user') => (
    scope === 'system'
        ? { ...payload, scope: 'system' }
        : payload
)

export const getFileEntriesApi = (parentId?: number | null, scope: FileManageScope = 'user', ownerUserId?: number | null, virtualPath?: string | null) => {
    return instance.get<FileEntriesResponse>('upload/files/', {
        params: {
            parent_id: parentId ?? undefined,
            ...buildScopeParams(scope, ownerUserId),
            virtual_path: scope === 'system' ? (virtualPath ?? undefined) : undefined,
        },
    })
}

export const searchFileEntriesApi = (keyword: string, limit: number = 50, scope: FileManageScope = 'user', ownerUserId?: number | null) => {
    return instance.get<SearchFileEntriesResponse>('upload/search/', {
        params: {
            keyword,
            limit,
            ...buildScopeParams(scope, ownerUserId),
        },
    })
}

export const getRecycleBinEntriesApi = () => {
    return instance.get<RecycleBinEntriesResponse>('upload/recycle-bin/')
}

export const restoreRecycleBinEntryApi = (id: number) => {
    return instance.post<{ detail: string; item: FileEntryItem }>('upload/recycle-bin/restore/', { id })
}

export const clearRecycleBinApi = (ids?: number[]) => {
    return instance.post<{ detail: string; removed_db_files: number; removed_db_dirs: number; removed_disk_files: number }>(
        'upload/recycle-bin/clear/',
        { ids },
    )
}

export const createFolderApi = (payload: { name: string; parent_id?: number | null }) => {
    return instance.post<FileEntryItem>('upload/folders/', payload)
}

export const deleteFileEntryApi = (id: number, scope: FileManageScope = 'user') => {
    return instance.post<{ detail: string; moved_count?: number; removed_db_files?: number; removed_db_dirs?: number; removed_disk_files?: number }>('upload/delete/', buildScopePayload({ id }, scope))
}

export const renameFileEntryApi = (payload: { id: number; name: string }) => {
    return instance.post<FileEntryItem>('upload/rename/', payload)
}

export const uploadSmallFileApi = (formData: FormData) => {
    return instance.post<{ mode: string; file: FileEntryItem }>('upload/small/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
    })
}

export const uploadPrecheckApi = (payload: UploadPrecheckPayload) => {
    return instance.post<{ exists: boolean; message: string; file?: FileEntryItem }>('upload/precheck/', payload)
}

export const uploadChunkApi = (formData: FormData) => {
    return instance.post<{ chunk_index: number; uploaded: boolean }>('upload/chunk/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
    })
}

export const getUploadedChunksApi = (fileMd5: string, category?: string) => {
    return instance.get<{ uploaded_chunks: number[] }>('upload/chunks/', {
        params: { file_md5: fileMd5, category },
    })
}

export const mergeChunksApi = (payload: {
    file_md5: string
    total_md5: string
    file_name: string
    total_chunks: number
    file_size: number
    category?: string
    parent_id?: number | null
    relative_path?: string
}) => {
    return instance.post<{ task_id: string; message: string; asset_reference_id?: number }>('upload/merge/', payload, {
        timeout: 30000,
    })
}

export const saveChatAttachmentToResourceApi = (payload: {
    source_asset_reference_id: number
    parent_id?: number | null
    display_name?: string
}) => {
    return instance.post<{ detail: string; file: FileEntryItem }>('upload/chat-attachments/save/', payload)
}
