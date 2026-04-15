import { ref, type ComputedRef, type Ref } from 'vue'
import {
    setConversationUnreadInList,
    sortConversations,
    syncConversationPreviewInList,
    syncFriendRemarkInConversations,
    upsertConversationItem,
} from '@/stores/chat/conversation'
import { createConversationOrchestration } from '@/stores/chat/conversationOrchestration'
import { createFriendshipOrchestration } from '@/stores/chat/friendshipOrchestration'
import { createGroupOrchestration } from '@/stores/chat/groupOrchestration'
import { createChatRealtimeRuntime } from '@/stores/chat/chatRealtimeRuntime'
import { initializeChatLifecycle, resetChatLifecycle } from '@/stores/chat/lifecycle'
import { upsertMessageItem } from '@/stores/chat/message'
import { createMessageLocalState } from '@/stores/chat/messageLocalState'
import { createMessageOrchestration } from '@/stores/chat/messageOrchestration'
import type {
    ChatConversationItem,
    ChatConversationMemberItem,
    ChatFriendNoticeItem,
    ChatFriendRequestItem,
    ChatFriendshipItem,
    ChatGroupJoinRequestItem,
    ChatGroupNoticeItem,
    ChatMessageCursor,
    ChatMessageItem,
    ChatUserBrief,
} from '@/types/chat'

type MessageRuntime = ReturnType<typeof createMessageOrchestration>
type ConversationRuntime = ReturnType<typeof createConversationOrchestration>
type FriendshipRuntime = ReturnType<typeof createFriendshipOrchestration>
type GroupRuntime = ReturnType<typeof createGroupOrchestration>
type ChatAssemblyActions = MessageRuntime & ConversationRuntime & FriendshipRuntime & GroupRuntime

export function createChatAssemblyRuntime(deps: {
    userStore: {
        hasPermission: (code: string) => boolean
        user?: {
            id: number
            username: string
            display_name: string
            avatar: string
        } | null
    }
    settingsStore: {
        chatListSortMode: 'recent' | 'unread'
    }
    conversations: Ref<ChatConversationItem[]>
    activeConversationId: Ref<number | null>
    contactGroupConversations: Ref<ChatConversationItem[]>
    activeConversation: ComputedRef<ChatConversationItem | null>
    focusedSequenceMap: Record<number, number | null>
    friends: Ref<ChatFriendshipItem[]>
    receivedRequests: Ref<ChatFriendRequestItem[]>
    sentRequests: Ref<ChatFriendRequestItem[]>
    friendNoticeItems: Ref<ChatFriendNoticeItem[]>
    seenPendingRequestIds: Ref<number[]>
    seenFriendNoticeIds: Ref<number[]>
    seenFriendSystemNoticeIds: Ref<string[]>
    seenGroupNoticeIds: Ref<string[]>
    loadingMessages: Ref<boolean>
    sending: Ref<boolean>
    failedMessageMap: Ref<Record<number, ChatMessageItem[]>>
    activeMembers: Ref<ChatConversationMemberItem[]>
    activeJoinRequests: Ref<ChatGroupJoinRequestItem[]>
    typingUsers: Ref<ChatUserBrief[]>
    groupNoticeItems: Ref<ChatGroupNoticeItem[]>
    globalGroupJoinRequests: Ref<ChatGroupJoinRequestItem[]>
    messageMap: Record<number, ChatMessageItem[]>
    cursorMap: Record<number, ChatMessageCursor>
    typingMap: Record<number, ChatUserBrief[]>
    typingTimers: Map<string, ReturnType<typeof window.setTimeout>>
    memberMap: Record<number, ChatConversationMemberItem[]>
    joinRequestMap: Record<number, ChatGroupJoinRequestItem[]>
}) {
    const initialized = ref(false)
    const loading = ref(false)
    const sendingFallbackTimer = ref<ReturnType<typeof setTimeout> | null>(null)
    const sendingSyncTimer = ref<ReturnType<typeof setTimeout> | null>(null)

    const clearSendingState = () => {
        deps.sending.value = false
        if (sendingFallbackTimer.value) {
            window.clearTimeout(sendingFallbackTimer.value)
            sendingFallbackTimer.value = null
        }
        if (sendingSyncTimer.value) {
            window.clearTimeout(sendingSyncTimer.value)
            sendingSyncTimer.value = null
        }
    }

    const appendGroupNotice = (notice: ChatGroupNoticeItem) => {
        deps.groupNoticeItems.value = [notice, ...deps.groupNoticeItems.value.filter((item) => item.id !== notice.id)].slice(0, 100)
    }

    const sortCurrentConversations = () => {
        deps.conversations.value = sortConversations(deps.conversations.value, deps.settingsStore.chatListSortMode)
    }

    const upsertConversation = (nextConversation: ChatConversationItem) => {
        deps.conversations.value = upsertConversationItem(deps.conversations.value, nextConversation, deps.settingsStore.chatListSortMode)
    }

    const syncConversationPreview = (conversationId: number, messageItem: Pick<ChatMessageItem, 'content' | 'created_at'>) => {
        deps.conversations.value = syncConversationPreviewInList(deps.conversations.value, conversationId, messageItem, deps.settingsStore.chatListSortMode)
    }

    const syncFriendRemarkLocally = (friendUserId: number, remark: string) => {
        deps.friends.value = deps.friends.value.map((item) => (item.friend_user.id === friendUserId ? { ...item, remark } : item))
        deps.conversations.value = syncFriendRemarkInConversations(deps.conversations.value, friendUserId, remark)
    }

    const {
        updateLocalMessageStatus,
        updateLocalAttachmentPayload,
        insertLocalMessage,
        insertLocalAttachmentMessage,
        reconcileLocalMessage,
        markLatestSendingMessageFailed,
    } = createMessageLocalState({
        conversations: deps.conversations,
        messageMap: deps.messageMap,
        failedMessageMap: deps.failedMessageMap,
        currentUser: () => (
            deps.userStore.user
                ? {
                    id: deps.userStore.user.id,
                    username: deps.userStore.user.username,
                    display_name: deps.userStore.user.display_name,
                    avatar: deps.userStore.user.avatar,
                }
                : null
        ),
        sortCurrentConversations,
    })

    const setConversationUnread = (conversationId: number, unreadCount: number, lastReadSequence?: number) => {
        setConversationUnreadInList(deps.conversations.value, conversationId, unreadCount, lastReadSequence)
    }

    const upsertMessage = (conversationId: number, nextMessage: ChatMessageItem) => {
        const items = deps.messageMap[conversationId] || []
        deps.messageMap[conversationId] = upsertMessageItem(items, nextMessage)
    }

    const removeTypingUser = (conversationId: number, userId: number) => {
        const current = deps.typingMap[conversationId] || []
        deps.typingMap[conversationId] = current.filter((item) => item.id !== userId)
    }

    const runtime = {} as ChatAssemblyActions

    Object.assign(
        runtime,
        createMessageOrchestration({
            activeConversation: deps.activeConversation,
            friends: deps.friends,
            currentUserId: () => deps.userStore.user?.id,
            loadingMessages: deps.loadingMessages,
            messageMap: deps.messageMap,
            failedMessageMap: deps.failedMessageMap,
            cursorMap: deps.cursorMap,
            conversations: deps.conversations,
            sendingFallbackTimer,
            sendingSyncTimer,
            sending: deps.sending,
            upsertConversation,
            loadMembers: async (conversationId: number) => runtime.loadMembers(conversationId),
            markConversationRead: async (conversationId: number, lastReadSequence: number) => runtime.markConversationRead(conversationId, lastReadSequence),
            updateLocalMessageStatus,
            updateLocalAttachmentPayload,
            clearSendingState,
            insertLocalMessage,
            insertLocalAttachmentMessage,
            loadMessagesRef: async (conversationId: number, params?: { before_sequence?: number; after_sequence?: number; around_sequence?: number; limit?: number }) => runtime.loadMessages(conversationId, params),
            setConversationUnread,
        }),
        createConversationOrchestration({
            loading,
            conversations: deps.conversations,
            activeConversationId: deps.activeConversationId,
            contactGroupConversations: deps.contactGroupConversations,
            focusedSequenceMap: deps.focusedSequenceMap,
            upsertConversation,
            chatListSortMode: () => deps.settingsStore.chatListSortMode,
            loadMessages: async (conversationId: number, params?: { around_sequence?: number; limit?: number }) => runtime.loadMessages(conversationId, params),
            getMessages: (conversationId: number) => deps.messageMap[conversationId] || [],
            markConversationRead: async (conversationId: number, lastReadSequence: number) => runtime.markConversationRead(conversationId, lastReadSequence),
            loadFriends: async () => runtime.loadFriends(),
        }),
        createGroupOrchestration({
            canLoadGlobalGroupJoinRequests: () => deps.userStore.hasPermission('chat.manage_group'),
            globalGroupJoinRequests: deps.globalGroupJoinRequests,
            conversations: deps.conversations,
            memberMap: deps.memberMap,
            joinRequestMap: deps.joinRequestMap,
            loadConversations: async () => runtime.loadConversations(),
            loadContactGroupConversations: async () => runtime.loadContactGroupConversations(),
        }),
        createFriendshipOrchestration({
            friends: deps.friends,
            receivedRequests: deps.receivedRequests,
            sentRequests: deps.sentRequests,
            friendNoticeItems: deps.friendNoticeItems,
            seenFriendNoticeIds: deps.seenFriendNoticeIds,
            seenFriendSystemNoticeIds: deps.seenFriendSystemNoticeIds,
            seenPendingRequestIds: deps.seenPendingRequestIds,
            conversations: deps.conversations,
            syncFriendRemarkLocally,
            loadConversations: async () => runtime.loadConversations(),
            loadContactGroupConversations: async () => runtime.loadContactGroupConversations(),
        }),
    )

    const realtimeRuntime = createChatRealtimeRuntime({
        activeConversationId: deps.activeConversationId,
        shouldAutoMarkRead: () => typeof window !== 'undefined' && window.location.pathname.includes('/chat-center/messages'),
        getCurrentUserId: () => deps.userStore.user?.id,
        typingMap: deps.typingMap,
        typingTimers: deps.typingTimers,
        appendFriendNotice: runtime.appendFriendNotice,
        appendGroupNotice,
        clearSendingState,
        loadConversations: () => runtime.loadConversations(),
        loadFriendRequests: runtime.loadFriendRequests,
        loadFriends: runtime.loadFriends,
        loadGlobalGroupJoinRequests: runtime.loadGlobalGroupJoinRequests,
        loadJoinRequests: runtime.loadJoinRequests,
        markConversationRead: runtime.markConversationRead,
        markLatestSendingMessageFailed,
        reconcileLocalMessage: (conversationId, clientMessageId, nextMessage) => {
            reconcileLocalMessage(conversationId, clientMessageId, nextMessage, upsertMessage)
        },
        removeTypingUser,
        setConversationUnread,
        syncConversationPreview,
        upsertConversation,
        upsertMessage,
    })

    const initialize = async (sortMode: 'recent' | 'unread' = 'recent') => {
        await initializeChatLifecycle({
            clearSendingState,
            ensureWsSubscription: realtimeRuntime.ensureSubscription,
            loadConversations: runtime.loadConversations,
            loadFriends: runtime.loadFriends,
            loadFriendRequests: runtime.loadFriendRequests,
            loadGlobalGroupJoinRequests: runtime.loadGlobalGroupJoinRequests,
            loadContactGroupConversations: runtime.loadContactGroupConversations,
            loadMessages: (conversationId) => runtime.loadMessages(conversationId),
            activeConversationId: deps.activeConversationId,
            initialized,
            sortMode,
        })
    }

    const bootstrapSummaries = async () => {
        if (!deps.userStore.hasPermission('chat.view_conversation')) {
            realtimeRuntime.dispose()
            return
        }
        realtimeRuntime.ensureSubscription()
        await Promise.allSettled([
            runtime.loadConversations(deps.settingsStore.chatListSortMode),
            runtime.loadFriendRequests(),
            runtime.loadGlobalGroupJoinRequests(),
        ])
    }

    const reset = () => {
        resetChatLifecycle({
            conversations: deps.conversations,
            friends: deps.friends,
            receivedRequests: deps.receivedRequests,
            sentRequests: deps.sentRequests,
            seenPendingRequestIds: deps.seenPendingRequestIds,
            seenFriendNoticeIds: deps.seenFriendNoticeIds,
            seenFriendSystemNoticeIds: deps.seenFriendSystemNoticeIds,
            seenGroupNoticeIds: deps.seenGroupNoticeIds,
            friendNoticeItems: deps.friendNoticeItems,
            groupNoticeItems: deps.groupNoticeItems,
            globalGroupJoinRequests: deps.globalGroupJoinRequests,
            contactGroupConversations: deps.contactGroupConversations,
            failedMessageMap: deps.failedMessageMap,
            activeConversationId: deps.activeConversationId,
            messageMap: deps.messageMap,
            cursorMap: deps.cursorMap,
            memberMap: deps.memberMap,
            joinRequestMap: deps.joinRequestMap,
            typingMap: deps.typingMap,
            focusedSequenceMap: deps.focusedSequenceMap,
            typingTimers: deps.typingTimers,
            clearSendingState,
            initialized,
        })
        realtimeRuntime.dispose()
    }

    return {
        initialized,
        loading,
        realtime: realtimeRuntime,
        ...runtime,
        initialize,
        bootstrapSummaries,
        reset,
    }
}