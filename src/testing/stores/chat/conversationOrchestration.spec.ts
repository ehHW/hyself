import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createConversationOrchestration } from '@/stores/chat/conversationOrchestration'

describe('conversation orchestration', () => {
    it('marks conversation read only after entering a conversation with unread messages', async () => {
        const loadMessages = vi.fn(async () => undefined)
        const markConversationRead = vi.fn(async () => undefined)
        const runtime = createConversationOrchestration({
            loading: ref(false),
            conversations: ref([
                {
                    id: 12,
                    unread_count: 3,
                    is_pinned: false,
                    type: 'direct',
                    name: '会话',
                } as any,
            ]),
            activeConversationId: ref<number | null>(null),
            contactGroupConversations: ref([]),
            focusedSequenceMap: {},
            upsertConversation: vi.fn(),
            chatListSortMode: () => 'recent',
            loadMessages,
            getMessages: () => [{ id: 1, sequence: 18 }] as any,
            markConversationRead,
            loadFriends: vi.fn(async () => undefined),
        })

        await runtime.selectConversation(12)

        expect(loadMessages).toHaveBeenCalledWith(12, undefined)
        expect(markConversationRead).toHaveBeenCalledWith(12, 18)
    })

    it('does not mark conversation read when there is no unread count or loaded sequence', async () => {
        const markConversationRead = vi.fn(async () => undefined)
        const runtime = createConversationOrchestration({
            loading: ref(false),
            conversations: ref([
                {
                    id: 7,
                    unread_count: 0,
                    is_pinned: false,
                    type: 'direct',
                    name: '已读会话',
                } as any,
            ]),
            activeConversationId: ref<number | null>(null),
            contactGroupConversations: ref([]),
            focusedSequenceMap: {},
            upsertConversation: vi.fn(),
            chatListSortMode: () => 'recent',
            loadMessages: vi.fn(async () => undefined),
            getMessages: () => [],
            markConversationRead,
            loadFriends: vi.fn(async () => undefined),
        })

        await runtime.selectConversation(7)

        expect(markConversationRead).not.toHaveBeenCalled()
    })
})