import type { Ref } from 'vue'

function clearReactiveRecord<T>(target: Record<number, T> | Record<string, T>) {
    for (const key of Object.keys(target)) {
        delete target[key as keyof typeof target]
    }
}

export async function initializeChatLifecycle(options: {
    clearSendingState: () => void
    ensureWsSubscription: () => void
    loadConversations: (sortMode: 'recent' | 'unread') => Promise<void>
    loadFriends: () => Promise<void>
    loadFriendRequests: () => Promise<void>
    loadGlobalGroupJoinRequests: () => Promise<void>
    loadContactGroupConversations: () => Promise<void>
    loadMessages: (conversationId: number) => Promise<void>
    activeConversationId: Ref<number | null>
    initialized: Ref<boolean>
    sortMode: 'recent' | 'unread'
}) {
    options.clearSendingState()
    options.ensureWsSubscription()
    await Promise.all([
        options.loadConversations(options.sortMode),
        options.loadFriends(),
        options.loadFriendRequests(),
        options.loadGlobalGroupJoinRequests(),
        options.loadContactGroupConversations(),
    ])
    options.initialized.value = true
    if (options.activeConversationId.value) {
        await options.loadMessages(options.activeConversationId.value)
    }
}

export function resetChatLifecycle(options: {
    conversations: Ref<unknown[]>
    friends: Ref<unknown[]>
    receivedRequests: Ref<unknown[]>
    sentRequests: Ref<unknown[]>
    seenPendingRequestIds: Ref<number[]>
    seenFriendNoticeIds: Ref<number[]>
    seenGroupNoticeIds: Ref<string[]>
    friendNoticeItems: Ref<unknown[]>
    groupNoticeItems: Ref<unknown[]>
    globalGroupJoinRequests: Ref<unknown[]>
    contactGroupConversations: Ref<unknown[]>
    failedMessageMap: Ref<Record<number, unknown[]>>
    activeConversationId: Ref<number | null>
    messageMap: Record<number, unknown[]>
    cursorMap: Record<number, unknown>
    memberMap: Record<number, unknown[]>
    joinRequestMap: Record<number, unknown[]>
    typingMap: Record<number, unknown[]>
    focusedSequenceMap: Record<number, number | null>
    typingTimers: Map<string, ReturnType<typeof window.setTimeout>>
    clearSendingState: () => void
    initialized: Ref<boolean>
}) {
    options.conversations.value = []
    options.friends.value = []
    options.receivedRequests.value = []
    options.sentRequests.value = []
    options.seenPendingRequestIds.value = []
    options.seenFriendNoticeIds.value = []
    options.seenGroupNoticeIds.value = []
    options.friendNoticeItems.value = []
    options.groupNoticeItems.value = []
    options.globalGroupJoinRequests.value = []
    options.contactGroupConversations.value = []
    options.failedMessageMap.value = {}
    options.activeConversationId.value = null
    clearReactiveRecord(options.messageMap)
    clearReactiveRecord(options.cursorMap)
    clearReactiveRecord(options.memberMap)
    clearReactiveRecord(options.joinRequestMap)
    clearReactiveRecord(options.typingMap)
    clearReactiveRecord(options.focusedSequenceMap)
    options.typingTimers.forEach((timer) => window.clearTimeout(timer))
    options.typingTimers.clear()
    options.clearSendingState()
    options.initialized.value = false
}

export function resetChatSearchAuditState(options: {
    searchResult: Ref<unknown | null>
    adminConversations: Ref<unknown[]>
    adminMessages: Ref<unknown[]>
}) {
    options.searchResult.value = null
    options.adminConversations.value = []
    options.adminMessages.value = []
}