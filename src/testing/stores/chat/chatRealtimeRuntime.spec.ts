import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChatRealtimeRuntime } from '@/stores/chat/chatRealtimeRuntime'
import { subscribeToRealtimeDomain } from '@/realtime/dispatcher'

vi.mock('@/realtime/dispatcher', () => ({
    subscribeToRealtimeDomain: vi.fn(),
}))

describe('createChatRealtimeRuntime', () => {
    beforeEach(() => {
        vi.mocked(subscribeToRealtimeDomain).mockReset()
    })

    it('subscribes only once and disposes the active subscription', () => {
        const unsubscribe = vi.fn()
        vi.mocked(subscribeToRealtimeDomain).mockReturnValue(unsubscribe)

        const runtime = createChatRealtimeRuntime({
            activeConversationId: ref(null),
            shouldAutoMarkRead: () => true,
            getCurrentUserId: () => 1,
            typingMap: {},
            typingTimers: new Map(),
            appendFriendNotice: vi.fn(),
            appendGroupNotice: vi.fn(),
            clearSendingState: vi.fn(),
            loadConversations: vi.fn(async () => undefined),
            loadFriendRequests: vi.fn(async () => undefined),
            loadFriends: vi.fn(async () => undefined),
            loadGlobalGroupJoinRequests: vi.fn(async () => undefined),
            loadJoinRequests: vi.fn(async () => undefined),
            markConversationRead: vi.fn(async () => undefined),
            markLatestSendingMessageFailed: vi.fn(),
            reconcileLocalMessage: vi.fn(),
            removeTypingUser: vi.fn(),
            setConversationUnread: vi.fn(),
            syncConversationPreview: vi.fn(),
            upsertConversation: vi.fn(),
            upsertMessage: vi.fn(),
        })

        runtime.ensureSubscription()
        runtime.ensureSubscription()

        expect(subscribeToRealtimeDomain).toHaveBeenCalledTimes(1)
        expect(subscribeToRealtimeDomain).toHaveBeenCalledWith('chat', expect.any(Function))

        runtime.dispose()

        expect(unsubscribe).toHaveBeenCalledTimes(1)

        runtime.ensureSubscription()

        expect(subscribeToRealtimeDomain).toHaveBeenCalledTimes(2)
    })
})