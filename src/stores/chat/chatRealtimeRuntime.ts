import type { Ref } from 'vue'
import { createChatRealtimeHandler, ensureChatRealtimeSubscription } from '@/stores/chat/realtime'
import type { ChatConversationItem, ChatFriendNoticeItem, ChatGroupNoticeItem, ChatMessageItem, ChatUserBrief } from '@/types/chat'

type TypingTimer = ReturnType<typeof setTimeout>

export type ChatRealtimeRuntime = ReturnType<typeof createChatRealtimeRuntime>

export function createChatRealtimeRuntime(options: {
    activeConversationId: Ref<number | null>
    shouldAutoMarkRead: () => boolean
    getCurrentUserId: () => number | undefined
    typingMap: Record<number, ChatUserBrief[]>
    typingTimers: Map<string, TypingTimer>
    appendFriendNotice: (notice: ChatFriendNoticeItem) => void
    appendGroupNotice: (notice: ChatGroupNoticeItem) => void
    clearSendingState: () => void
    loadConversations: () => Promise<void>
    loadFriendRequests: () => Promise<void>
    loadFriends: () => Promise<void>
    loadGlobalGroupJoinRequests: () => Promise<void>
    loadJoinRequests: (conversationId: number) => Promise<void>
    markConversationRead: (conversationId: number, lastReadSequence: number) => Promise<void>
    markLatestSendingMessageFailed: (conversationId: number | null, error: string) => void
    reconcileLocalMessage: (conversationId: number, clientMessageId: string | null | undefined, nextMessage: ChatMessageItem) => void
    removeTypingUser: (conversationId: number, userId: number) => void
    setConversationUnread: (conversationId: number, unreadCount: number, lastReadSequence?: number) => void
    syncConversationPreview: (conversationId: number, messageItem: Pick<ChatMessageItem, 'content' | 'created_at'>) => void
    upsertConversation: (item: ChatConversationItem) => void
    upsertMessage: (conversationId: number, nextMessage: ChatMessageItem) => void
}) {
    let wsUnsubscribe: (() => void) | null = null

    const handler = createChatRealtimeHandler(options)

    const ensureSubscription = () => {
        ensureChatRealtimeSubscription({
            currentUnsubscribe: wsUnsubscribe,
            handler,
            setUnsubscribe: (unsubscribe) => {
                wsUnsubscribe = unsubscribe
            },
        })
    }

    const dispose = () => {
        if (!wsUnsubscribe) {
            return
        }
        wsUnsubscribe()
        wsUnsubscribe = null
    }

    return {
        handler,
        ensureSubscription,
        dispose,
    }
}