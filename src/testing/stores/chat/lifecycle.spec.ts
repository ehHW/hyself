import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { initializeChatLifecycle, resetChatLifecycle, resetChatSearchAuditState } from '@/stores/chat/lifecycle'

describe('chat lifecycle helpers', () => {
    it('initializes chat lifecycle and loads active conversation messages', async () => {
        const clearSendingState = vi.fn()
        const ensureWsSubscription = vi.fn()
        const loadConversations = vi.fn(async () => undefined)
        const loadFriends = vi.fn(async () => undefined)
        const loadFriendRequests = vi.fn(async () => undefined)
        const loadGlobalGroupJoinRequests = vi.fn(async () => undefined)
        const loadContactGroupConversations = vi.fn(async () => undefined)
        const loadMessages = vi.fn(async () => undefined)
        const activeConversationId = ref<number | null>(42)
        const initialized = ref(false)

        await initializeChatLifecycle({
            clearSendingState,
            ensureWsSubscription,
            loadConversations,
            loadFriends,
            loadFriendRequests,
            loadGlobalGroupJoinRequests,
            loadContactGroupConversations,
            loadMessages,
            activeConversationId,
            initialized,
            sortMode: 'unread',
        })

        expect(clearSendingState).toHaveBeenCalledOnce()
        expect(ensureWsSubscription).toHaveBeenCalledOnce()
        expect(loadConversations).toHaveBeenCalledWith('unread')
        expect(loadMessages).toHaveBeenCalledWith(42)
        expect(initialized.value).toBe(true)
    })

    it('does not require global group join requests to be loaded by unauthorized callers', async () => {
        const clearSendingState = vi.fn()
        const ensureWsSubscription = vi.fn()
        const loadConversations = vi.fn(async () => undefined)
        const loadFriends = vi.fn(async () => undefined)
        const loadFriendRequests = vi.fn(async () => undefined)
        const loadGlobalGroupJoinRequests = vi.fn(async () => undefined)
        const loadContactGroupConversations = vi.fn(async () => undefined)
        const loadMessages = vi.fn(async () => undefined)
        const activeConversationId = ref<number | null>(null)
        const initialized = ref(false)

        await initializeChatLifecycle({
            clearSendingState,
            ensureWsSubscription,
            loadConversations,
            loadFriends,
            loadFriendRequests,
            loadGlobalGroupJoinRequests,
            loadContactGroupConversations,
            loadMessages,
            activeConversationId,
            initialized,
            sortMode: 'recent',
        })

        expect(loadGlobalGroupJoinRequests).toHaveBeenCalledOnce()
    })

    it('resets chat lifecycle state and clears timers', () => {
        const conversations = ref([{ id: 1 }])
        const friends = ref([{ id: 2 }])
        const receivedRequests = ref([{ id: 3 }])
        const sentRequests = ref([{ id: 4 }])
        const seenPendingRequestIds = ref([5])
        const seenFriendNoticeIds = ref([6])
        const seenGroupNoticeIds = ref(['notice-7'])
        const friendNoticeItems = ref([{ id: 'notice-1' }])
        const groupNoticeItems = ref([{ id: 7 }])
        const globalGroupJoinRequests = ref([{ id: 8 }])
        const contactGroupConversations = ref([{ id: 9 }])
        const failedMessageMap = ref<Record<number, unknown[]>>({ 1: [{ id: 10 }] })
        const activeConversationId = ref<number | null>(99)
        const messageMap: Record<number, unknown[]> = { 1: [{ id: 11 }] }
        const cursorMap: Record<number, unknown> = { 1: { next: 1 } }
        const memberMap: Record<number, unknown[]> = { 1: [{ id: 12 }] }
        const joinRequestMap: Record<number, unknown[]> = { 1: [{ id: 13 }] }
        const typingMap: Record<number, unknown[]> = { 1: [{ id: 14 }] }
        const focusedSequenceMap: Record<number, number | null> = { 1: 15 }
        const typingTimers = new Map<string, ReturnType<typeof setTimeout>>()
        const timer = setTimeout(() => undefined, 1000)
        typingTimers.set('1:2', timer)
        const clearSendingState = vi.fn()
        const initialized = ref(true)

        resetChatLifecycle({
            conversations,
            friends,
            receivedRequests,
            sentRequests,
            seenPendingRequestIds,
            seenFriendNoticeIds,
            seenGroupNoticeIds,
            friendNoticeItems,
            groupNoticeItems,
            globalGroupJoinRequests,
            contactGroupConversations,
            failedMessageMap,
            activeConversationId,
            messageMap,
            cursorMap,
            memberMap,
            joinRequestMap,
            typingMap,
            focusedSequenceMap,
            typingTimers,
            clearSendingState,
            initialized,
        })

        expect(conversations.value).toEqual([])
        expect(friends.value).toEqual([])
        expect(receivedRequests.value).toEqual([])
        expect(sentRequests.value).toEqual([])
        expect(seenPendingRequestIds.value).toEqual([])
        expect(seenFriendNoticeIds.value).toEqual([])
        expect(seenGroupNoticeIds.value).toEqual([])
        expect(friendNoticeItems.value).toEqual([])
        expect(groupNoticeItems.value).toEqual([])
        expect(globalGroupJoinRequests.value).toEqual([])
        expect(contactGroupConversations.value).toEqual([])
        expect(failedMessageMap.value).toEqual({})
        expect(activeConversationId.value).toBeNull()
        expect(messageMap).toEqual({})
        expect(cursorMap).toEqual({})
        expect(memberMap).toEqual({})
        expect(joinRequestMap).toEqual({})
        expect(typingMap).toEqual({})
        expect(focusedSequenceMap).toEqual({})
        expect(typingTimers.size).toBe(0)
        expect(clearSendingState).toHaveBeenCalledOnce()
        expect(initialized.value).toBe(false)
        clearTimeout(timer)
    })

    it('resets search audit state', () => {
        const searchResult = ref({ keyword: 'hello' })
        const adminConversations = ref([{ id: 1 }])
        const adminMessages = ref([{ id: 2 }])

        resetChatSearchAuditState({
            searchResult,
            adminConversations,
            adminMessages,
        })

        expect(searchResult.value).toBeNull()
        expect(adminConversations.value).toEqual([])
        expect(adminMessages.value).toEqual([])
    })
})