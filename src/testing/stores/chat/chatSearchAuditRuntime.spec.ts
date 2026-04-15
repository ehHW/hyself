import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChatSearchAuditRuntime } from '@/stores/chat/chatSearchAuditRuntime'
import * as searchAuditScenes from '@/stores/chat/searchAudit'

const dispatcherListeners = new Map<string, () => void>()

vi.mock('@/realtime/dispatcher', () => ({
    subscribeToRealtimeEvent: vi.fn((eventType: string, listener: () => void) => {
        dispatcherListeners.set(eventType, listener)
        return vi.fn(() => dispatcherListeners.delete(eventType))
    }),
}))

vi.mock('@/stores/chat/searchAudit', () => ({
    runSearchScene: vi.fn(async (keyword: string, searchResult) => {
        searchResult.value = {
            keyword,
            conversations: [],
            messages: [],
            users: [],
        }
    }),
    loadAuditDataScene: vi.fn(async ({ adminConversations, adminMessages }) => {
        adminConversations.value = [{ id: 1 }]
        adminMessages.value = [{ id: 2 }]
    }),
}))

describe('createChatSearchAuditRuntime', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        dispatcherListeners.clear()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('derives audit availability from permission and stealth setting', () => {
        const runtime = createChatSearchAuditRuntime({
            userStore: {
                hasPermission: (code: string) => code === 'chat.review_all_messages',
            },
            settingsStore: {
                chatStealthInspectEnabled: true,
            },
        })

        expect(runtime.isAuditAvailable.value).toBe(true)
    })

    it('runs search, loads audit data, and resets state', async () => {
        const runtime = createChatSearchAuditRuntime({
            userStore: {
                hasPermission: () => true,
            },
            settingsStore: {
                chatStealthInspectEnabled: true,
            },
        })

        await runtime.runSearch('hello')
        await runtime.loadAuditData('hello', 12)

        expect(searchAuditScenes.runSearchScene).toHaveBeenCalledWith('hello', runtime.searchResult)
        expect(searchAuditScenes.loadAuditDataScene).toHaveBeenCalled()
        expect(runtime.searchResult.value).toMatchObject({ keyword: 'hello' })
        expect(runtime.adminConversations.value).toHaveLength(1)
        expect(runtime.adminMessages.value).toHaveLength(1)

        runtime.clearSearchResult()
        expect(runtime.searchResult.value).toBeNull()

        runtime.reset()
        expect(runtime.searchResult.value).toBeNull()
        expect(runtime.adminConversations.value).toEqual([])
        expect(runtime.adminMessages.value).toEqual([])
    })

    it('refreshes active search and audit snapshots on dispatcher events', async () => {
        const runtime = createChatSearchAuditRuntime({
            userStore: {
                hasPermission: () => true,
            },
            settingsStore: {
                chatStealthInspectEnabled: true,
            },
        })

        await runtime.runSearch('hello', 'audit')
        await runtime.loadAuditData('hello', 12)

        dispatcherListeners.get('chat.message.created')?.()
        dispatcherListeners.get('chat.friendship.updated')?.()
        vi.advanceTimersByTime(300)
        await Promise.resolve()

        expect(searchAuditScenes.runSearchScene).toHaveBeenCalledTimes(2)
        expect(searchAuditScenes.runSearchScene).toHaveBeenLastCalledWith('hello', runtime.searchResult, 'audit')
        expect(searchAuditScenes.loadAuditDataScene).toHaveBeenCalledTimes(2)
    })
})