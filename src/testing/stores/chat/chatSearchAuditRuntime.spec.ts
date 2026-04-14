import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChatSearchAuditRuntime } from '@/stores/chat/chatSearchAuditRuntime'
import * as searchAuditScenes from '@/stores/chat/searchAudit'

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
})