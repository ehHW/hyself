import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFileManageRealtimeRuntime } from '@/views/FileManage/resourceRealtimeRuntime'

const listeners = new Map<string, (payload: { payload: Record<string, unknown> }) => void>()

vi.mock('@/realtime/dispatcher', () => ({
    subscribeToRealtimeEvent: (eventType: string, listener: (payload: { payload: Record<string, unknown> }) => void) => {
        listeners.set(eventType, listener)
        return vi.fn(() => listeners.delete(eventType))
    },
}))

describe('createFileManageRealtimeRuntime', () => {
    beforeEach(() => {
        listeners.clear()
        vi.clearAllMocks()
    })

    it('updates current directory incrementally when updated or moved hits current parent', async () => {
        vi.useFakeTimers()
        const refreshEntries = vi.fn(async () => undefined)
        const refreshSearch = vi.fn(async () => undefined)
        const upsertEntry = vi.fn()
        const removeEntry = vi.fn()
        const runtime = createFileManageRealtimeRuntime({
            isViewActive: () => true,
            isSystemScope: () => false,
            hasActiveSearch: () => false,
            getCurrentParentId: () => 45,
            getCurrentOwnerUserId: () => null,
            getCurrentVirtualPath: () => null,
            upsertEntry,
            removeEntry,
            refreshEntries,
            refreshSearch,
            delayMs: 10,
        })

        runtime.ensureSubscription()
        listeners.get('resource.entry.updated')?.({ payload: { entry: { id: 8, parent_id: 45, display_name: 'b.txt', is_dir: false }, previous_parent_id: 45 } })
        expect(upsertEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 8, parent_id: 45 }))

        listeners.get('resource.entry.moved')?.({ payload: { entry: { id: 9, parent_id: 45, display_name: 'c.txt', is_dir: false }, from_parent_id: 12, to_parent_id: 45 } })
        expect(upsertEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 9, parent_id: 45 }))

        listeners.get('resource.entry.deleted')?.({ payload: { entry_id: 9, parent_id: 45 } })
        expect(removeEntry).toHaveBeenCalledWith(9)

        expect(refreshSearch).not.toHaveBeenCalled()
        expect(refreshEntries).not.toHaveBeenCalled()

        runtime.dispose()
        vi.useRealTimers()
    })

    it('refreshes active search instead of entry list when search mode is enabled', async () => {
        vi.useFakeTimers()
        const refreshEntries = vi.fn(async () => undefined)
        const refreshSearch = vi.fn(async () => undefined)
        const upsertEntry = vi.fn()
        const removeEntry = vi.fn()
        const runtime = createFileManageRealtimeRuntime({
            isViewActive: () => true,
            isSystemScope: () => false,
            hasActiveSearch: () => true,
            getCurrentParentId: () => 7,
            getCurrentOwnerUserId: () => null,
            getCurrentVirtualPath: () => null,
            upsertEntry,
            removeEntry,
            refreshEntries,
            refreshSearch,
            delayMs: 10,
        })

        runtime.ensureSubscription()
        listeners.get('resource.entry.created')?.({ payload: { parent_id: 7 } })
        await vi.advanceTimersByTimeAsync(20)
        expect(refreshSearch).toHaveBeenCalledTimes(1)
        expect(refreshEntries).not.toHaveBeenCalled()
        expect(upsertEntry).not.toHaveBeenCalled()
        expect(removeEntry).not.toHaveBeenCalled()

        runtime.dispose()
        vi.useRealTimers()
    })

    it('filters system-scope incremental updates by owner dimension', () => {
        const refreshEntries = vi.fn(async () => undefined)
        const refreshSearch = vi.fn(async () => undefined)
        const upsertEntry = vi.fn()
        const removeEntry = vi.fn()
        const runtime = createFileManageRealtimeRuntime({
            isViewActive: () => true,
            isSystemScope: () => true,
            hasActiveSearch: () => false,
            getCurrentParentId: () => null,
            getCurrentOwnerUserId: () => 99,
            getCurrentVirtualPath: () => null,
            upsertEntry,
            removeEntry,
            refreshEntries,
            refreshSearch,
        })

        runtime.ensureSubscription()
        listeners.get('resource.entry.created')?.({
            payload: {
                owner_user_id: 99,
                parent_id: null,
                entry: { id: 21, owner_user_id: 99, parent_id: null, display_name: 'root.txt', is_dir: false },
            },
        })
        listeners.get('resource.entry.created')?.({
            payload: {
                owner_user_id: 100,
                parent_id: null,
                entry: { id: 22, owner_user_id: 100, parent_id: null, display_name: 'other.txt', is_dir: false },
            },
        })

        expect(upsertEntry).toHaveBeenCalledTimes(1)
        expect(upsertEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 21, owner_user_id: 99 }))
        expect(refreshEntries).not.toHaveBeenCalled()
        expect(removeEntry).not.toHaveBeenCalled()

        runtime.dispose()
    })

    it('upserts owner folders incrementally on system root view', () => {
        const refreshEntries = vi.fn(async () => undefined)
        const refreshSearch = vi.fn(async () => undefined)
        const upsertEntry = vi.fn()
        const removeEntry = vi.fn()
        const runtime = createFileManageRealtimeRuntime({
            isViewActive: () => true,
            isSystemScope: () => true,
            hasActiveSearch: () => false,
            getCurrentParentId: () => null,
            getCurrentOwnerUserId: () => null,
            getCurrentVirtualPath: () => null,
            upsertEntry,
            removeEntry,
            refreshEntries,
            refreshSearch,
        })

        runtime.ensureSubscription()
        listeners.get('resource.entry.updated')?.({
            payload: {
                owner_user_id: 7,
                updated_at: '2026-04-15T10:00:00Z',
                entry: {
                    id: 31,
                    owner_user_id: 7,
                    owner_name: '系统管理员甲',
                    parent_id: 3,
                    display_name: 'nested.doc',
                    is_dir: false,
                    updated_at: '2026-04-15T10:00:00Z',
                },
            },
        })

        expect(upsertEntry).toHaveBeenCalledWith(expect.objectContaining({
            id: -7,
            owner_user_id: 7,
            display_name: '系统管理员甲',
            is_virtual: true,
        }))
        expect(refreshEntries).not.toHaveBeenCalled()

        runtime.dispose()
    })

    it('removes owner folders incrementally on system root delete when owner becomes empty', () => {
        const refreshEntries = vi.fn(async () => undefined)
        const refreshSearch = vi.fn(async () => undefined)
        const upsertEntry = vi.fn()
        const removeEntry = vi.fn()
        const runtime = createFileManageRealtimeRuntime({
            isViewActive: () => true,
            isSystemScope: () => true,
            hasActiveSearch: () => false,
            getCurrentParentId: () => null,
            getCurrentOwnerUserId: () => null,
            getCurrentVirtualPath: () => null,
            upsertEntry,
            removeEntry,
            refreshEntries,
            refreshSearch,
        })

        runtime.ensureSubscription()
        listeners.get('resource.entry.deleted')?.({
            payload: {
                owner_user_id: 12,
                entry_id: 88,
                owner_has_entries: false,
            },
        })

        expect(removeEntry).toHaveBeenCalledWith(-12)
        expect(refreshEntries).not.toHaveBeenCalled()
        expect(upsertEntry).not.toHaveBeenCalled()

        runtime.dispose()
    })
})