import { subscribeToRealtimeEvent } from '@/realtime/dispatcher'
import { createRealtimeRefreshScheduler } from '@/realtime/refreshScheduler'
import type { FileEntryItem } from '@/api/upload'

type ResourceRealtimePayloadBase = {
    scope?: 'user' | 'system'
    owner_user_id?: number | null
    owner_name?: string | null
    updated_at?: string | null
    virtual_path?: string | null
}

type ResourceCreatedPayload = {
    parent_id?: number | null
    entry?: FileEntryItem
} & ResourceRealtimePayloadBase

type ResourceUpdatedPayload = {
    entry?: FileEntryItem
    previous_parent_id?: number | null
    previous_virtual_path?: string | null
} & ResourceRealtimePayloadBase

type ResourceMovedPayload = {
    entry?: FileEntryItem
    from_parent_id?: number | null
    to_parent_id?: number | null
    from_virtual_path?: string | null
    to_virtual_path?: string | null
    entry_id?: number
} & ResourceRealtimePayloadBase

type ResourceDeletedPayload = {
    entry_id?: number
    parent_id?: number | null
    owner_has_entries?: boolean
} & ResourceRealtimePayloadBase

const RESOURCE_REFRESH_EVENTS = [
    'resource.entry.created',
    'resource.entry.updated',
    'resource.entry.moved',
    'resource.entry.deleted',
] as const

const normalizeParentId = (value: unknown) => (typeof value === 'number' ? value : null)
const normalizeOwnerUserId = (value: unknown) => (typeof value === 'number' ? value : null)
const normalizeVirtualPath = (value: unknown) => {
    if (typeof value !== 'string') {
        return null
    }
    const normalized = value.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, '')
    return normalized || null
}

const getParentVirtualPath = (virtualPath: string | null) => {
    if (!virtualPath) {
        return null
    }
    const segments = virtualPath.split('/').filter(Boolean)
    if (segments.length <= 1) {
        return null
    }
    return segments.slice(0, -1).join('/')
}

const buildSystemOwnerFolderEntry = (payload: ResourceRealtimePayloadBase): FileEntryItem | null => {
    const ownerUserId = normalizeOwnerUserId(payload.owner_user_id)
    const ownerName = String(payload.owner_name || '').trim()
    if (!ownerUserId || !ownerName) {
        return null
    }
    const timestamp = payload.updated_at || new Date().toISOString()
    return {
        id: -ownerUserId,
        display_name: ownerName,
        stored_name: ownerName,
        resource_kind: 'resource_center',
        owner_user_id: ownerUserId,
        virtual_path: null,
        virtual_kind: null,
        owner_name: ownerName,
        is_virtual: true,
        is_dir: true,
        parent_id: null,
        file_size: 0,
        file_md5: '',
        relative_path: '',
        url: '',
        created_at: timestamp,
        updated_at: timestamp,
        is_system: true,
        is_recycle_bin: false,
        in_recycle_bin_tree: false,
        recycled_at: null,
        expires_at: null,
        remaining_days: null,
        recycle_original_parent_id: null,
        asset_reference_id: null,
        asset_reference: null,
        asset: null,
    }
}

const extractPayloadEntry = (payload: ResourceRealtimePayloadBase & { entry?: FileEntryItem }) => payload.entry

export function createFileManageRealtimeRuntime(options: {
    isViewActive: () => boolean
    isSystemScope: () => boolean
    hasActiveSearch: () => boolean
    getCurrentParentId: () => number | null
    getCurrentOwnerUserId: () => number | null
    getCurrentVirtualPath: () => string | null
    upsertEntry: (entry: FileEntryItem) => void
    removeEntry: (entryId: number) => void
    refreshEntries: () => Promise<void>
    refreshSearch: () => Promise<void>
    delayMs?: number
}) {
    let unsubscribes: Array<() => void> = []
    const delayMs = options.delayMs ?? 250
    const entriesScheduler = createRealtimeRefreshScheduler({
        delayMs,
        shouldRun: () => options.isViewActive() && !options.hasActiveSearch(),
        run: options.refreshEntries,
    })
    const searchScheduler = createRealtimeRefreshScheduler({
        delayMs,
        shouldRun: () => options.isViewActive() && options.hasActiveSearch(),
        run: options.refreshSearch,
    })

    const isSystemRootView = () => {
        return options.isSystemScope() && options.getCurrentParentId() === null && options.getCurrentOwnerUserId() === null && !normalizeVirtualPath(options.getCurrentVirtualPath())
    }

    const extractOwnerUserId = (payload: ResourceRealtimePayloadBase) => {
        return normalizeOwnerUserId(extractPayloadEntry(payload)?.owner_user_id ?? payload.owner_user_id)
    }

    const matchesSearchScope = (payload: ResourceRealtimePayloadBase) => {
        if (!options.isSystemScope()) {
            return true
        }
        const currentOwnerUserId = options.getCurrentOwnerUserId()
        return currentOwnerUserId === null || currentOwnerUserId === extractOwnerUserId(payload)
    }

    const matchesEntryListing = (payload: ResourceRealtimePayloadBase, parentId: number | null, virtualPath: string | null) => {
        const currentVirtualPath = normalizeVirtualPath(options.getCurrentVirtualPath())
        if (currentVirtualPath) {
            return getParentVirtualPath(virtualPath) === currentVirtualPath
        }
        if (options.isSystemScope()) {
            const currentOwnerUserId = options.getCurrentOwnerUserId()
            if (currentOwnerUserId !== null && currentOwnerUserId !== extractOwnerUserId(payload)) {
                return false
            }
        }
        return parentId === options.getCurrentParentId()
    }

    const scheduleRefresh = () => {
        if (options.hasActiveSearch()) {
            searchScheduler.schedule()
            return
        }
        entriesScheduler.schedule()
    }

    const handleCreated = (payload: ResourceCreatedPayload) => {
        if (!options.isViewActive()) {
            return
        }
        if (options.hasActiveSearch()) {
            if (matchesSearchScope(payload)) {
                scheduleRefresh()
            }
            return
        }
        if (isSystemRootView()) {
            const ownerFolder = buildSystemOwnerFolderEntry({
                ...payload,
                owner_name: payload.entry?.owner_name ?? payload.owner_name,
                updated_at: payload.entry?.updated_at ?? payload.updated_at,
            })
            if (ownerFolder) {
                options.upsertEntry(ownerFolder)
                return
            }
            scheduleRefresh()
            return
        }
        const parentId = normalizeParentId(payload.entry?.parent_id ?? payload.parent_id)
        const virtualPath = normalizeVirtualPath(payload.entry?.virtual_path ?? payload.virtual_path)
        if (!matchesEntryListing(payload, parentId, virtualPath)) {
            return
        }
        if (payload.entry) {
            options.upsertEntry(payload.entry)
            return
        }
        scheduleRefresh()
    }

    const handleUpdated = (payload: ResourceUpdatedPayload) => {
        if (!options.isViewActive()) {
            return
        }
        if (options.hasActiveSearch()) {
            if (matchesSearchScope(payload)) {
                scheduleRefresh()
            }
            return
        }
        if (isSystemRootView()) {
            const ownerFolder = buildSystemOwnerFolderEntry({
                ...payload,
                owner_name: payload.entry?.owner_name ?? payload.owner_name,
                updated_at: payload.entry?.updated_at ?? payload.updated_at,
            })
            if (ownerFolder) {
                options.upsertEntry(ownerFolder)
                return
            }
            scheduleRefresh()
            return
        }
        const nextParentId = normalizeParentId(payload.entry?.parent_id)
        const previousParentId = normalizeParentId(payload.previous_parent_id)
        const nextVirtualPath = normalizeVirtualPath(payload.entry?.virtual_path ?? payload.virtual_path)
        const previousVirtualPath = normalizeVirtualPath(payload.previous_virtual_path)
        const wasVisible = matchesEntryListing(payload, previousParentId, previousVirtualPath)
        const isVisible = matchesEntryListing(payload, nextParentId, nextVirtualPath)
        if (!wasVisible && !isVisible) {
            return
        }
        if (payload.entry) {
            if (wasVisible && !isVisible) {
                options.removeEntry(payload.entry.id)
                return
            }
            if (isVisible) {
                options.upsertEntry(payload.entry)
                return
            }
        }
        scheduleRefresh()
    }

    const handleMoved = (payload: ResourceMovedPayload) => {
        if (!options.isViewActive()) {
            return
        }
        if (options.hasActiveSearch()) {
            if (matchesSearchScope(payload)) {
                scheduleRefresh()
            }
            return
        }
        if (isSystemRootView()) {
            const ownerFolder = buildSystemOwnerFolderEntry({
                ...payload,
                owner_name: payload.entry?.owner_name ?? payload.owner_name,
                updated_at: payload.entry?.updated_at ?? payload.updated_at,
            })
            if (ownerFolder) {
                options.upsertEntry(ownerFolder)
                return
            }
            scheduleRefresh()
            return
        }
        const fromParentId = normalizeParentId(payload.from_parent_id)
        const toParentId = normalizeParentId(payload.to_parent_id)
        const fromVirtualPath = normalizeVirtualPath(payload.from_virtual_path)
        const toVirtualPath = normalizeVirtualPath(payload.entry?.virtual_path ?? payload.to_virtual_path ?? payload.virtual_path)
        const wasVisible = matchesEntryListing(payload, fromParentId, fromVirtualPath)
        const isVisible = matchesEntryListing(payload, toParentId, toVirtualPath)
        if (!wasVisible && !isVisible) {
            return
        }
        if (wasVisible && !isVisible) {
            const entryId = Number(payload.entry?.id || payload.entry_id || 0)
            if (entryId) {
                options.removeEntry(entryId)
                return
            }
        }
        if (isVisible && payload.entry) {
            options.upsertEntry(payload.entry)
            return
        }
        scheduleRefresh()
    }

    const handleDeleted = (payload: ResourceDeletedPayload) => {
        if (!options.isViewActive()) {
            return
        }
        if (options.hasActiveSearch()) {
            if (matchesSearchScope(payload)) {
                scheduleRefresh()
            }
            return
        }
        if (isSystemRootView()) {
            if (payload.owner_has_entries === false && typeof payload.owner_user_id === 'number') {
                options.removeEntry(-payload.owner_user_id)
                return
            }
            return
        }
        const parentId = normalizeParentId(payload.parent_id)
        const virtualPath = normalizeVirtualPath(payload.virtual_path)
        if (!matchesEntryListing(payload, parentId, virtualPath)) {
            return
        }
        if (typeof payload.entry_id === 'number') {
            options.removeEntry(payload.entry_id)
            return
        }
        scheduleRefresh()
    }

    const ensureSubscription = () => {
        if (unsubscribes.length) {
            return
        }
        unsubscribes = [
            subscribeToRealtimeEvent(RESOURCE_REFRESH_EVENTS[0], ({ payload }) => handleCreated(payload as ResourceCreatedPayload)),
            subscribeToRealtimeEvent(RESOURCE_REFRESH_EVENTS[1], ({ payload }) => handleUpdated(payload as ResourceUpdatedPayload)),
            subscribeToRealtimeEvent(RESOURCE_REFRESH_EVENTS[2], ({ payload }) => handleMoved(payload as ResourceMovedPayload)),
            subscribeToRealtimeEvent(RESOURCE_REFRESH_EVENTS[3], ({ payload }) => handleDeleted(payload as ResourceDeletedPayload)),
        ]
    }

    const dispose = () => {
        unsubscribes.forEach((unsubscribe) => unsubscribe())
        unsubscribes = []
        entriesScheduler.dispose()
        searchScheduler.dispose()
    }

    return {
        ensureSubscription,
        dispose,
    }
}