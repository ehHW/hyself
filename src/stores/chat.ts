import { defineStore, storeToRefs } from 'pinia'
import { createChatAssemblyRuntime } from '@/stores/chat/chatAssemblyRuntime'
import { createChatFacade } from '@/stores/chat/chatFacade'
import { createChatSearchAuditRuntime } from '@/stores/chat/chatSearchAuditRuntime'
import { useSettingsStore } from '@/stores/settings'
import { useUserStore } from '@/stores/user'
import { useConversationChatStore } from '@/stores/chat/conversationState'
import { useFriendshipChatStore } from '@/stores/chat/friendshipState'
import { useGroupChatStore } from '@/stores/chat/groupState'
import { useMessageChatStore } from '@/stores/chat/messageState'

export const useChatStore = defineStore('chat', () => {
    const userStore = useUserStore()
    const settingsStore = useSettingsStore()

    const conversationStateStore = useConversationChatStore()
    const friendshipStateStore = useFriendshipChatStore()
    const messageStateStore = useMessageChatStore()
    const groupStateStore = useGroupChatStore()

    const {
        conversations,
        activeConversationId,
        contactGroupConversations,
        activeConversation,
        totalUnreadCount,
    } = storeToRefs(conversationStateStore)
    const { focusedSequenceMap } = conversationStateStore

    const {
        friends,
        receivedRequests,
        sentRequests,
        friendNoticeItems,
        seenPendingRequestIds,
        seenFriendNoticeIds,
        seenFriendSystemNoticeIds,
        unreadFriendNoticeCount,
        unreadPendingFriendRequestCount,
    } = storeToRefs(friendshipStateStore)

    const {
        loadingMessages,
        sending,
        failedMessageMap,
        sendingFallbackTimer,
        sendingSyncTimer,
        activeMessages,
        typingUsers,
    } = storeToRefs(messageStateStore)
    const { messageMap, cursorMap, typingMap, typingTimers } = messageStateStore

    const {
        groupNoticeItems,
        globalGroupJoinRequests,
        activeMembers,
        activeJoinRequests,
        seenGroupNoticeIds,
        unreadGroupNoticeCount,
    } = storeToRefs(groupStateStore)
    const { memberMap, joinRequestMap } = groupStateStore
    const assemblyRuntime = createChatAssemblyRuntime({
        userStore,
        settingsStore,
        conversations,
        activeConversationId,
        contactGroupConversations,
        activeConversation,
        focusedSequenceMap,
        friends,
        receivedRequests,
        sentRequests,
        friendNoticeItems,
        seenPendingRequestIds,
        seenFriendNoticeIds,
        seenFriendSystemNoticeIds,
        seenGroupNoticeIds,
        loadingMessages,
        sending,
        failedMessageMap,
        activeMembers,
        activeJoinRequests,
        typingUsers,
        groupNoticeItems,
        globalGroupJoinRequests,
        messageMap,
        cursorMap,
        typingMap,
        typingTimers,
        memberMap,
        joinRequestMap,
    })

    const searchAuditRuntime = createChatSearchAuditRuntime({
        userStore,
        settingsStore,
    })

    const state = {
        conversationState: {
            conversations,
            activeConversationId,
            activeConversation,
            totalUnreadCount,
            contactGroupConversations,
            focusedSequenceMap,
        },
        messageState: {
            loadingMessages,
            sending,
            activeMessages,
            typingUsers,
            failedMessageMap,
        },
        friendshipState: {
            friends,
            receivedRequests,
            sentRequests,
            friendNoticeItems,
            seenPendingRequestIds,
            seenFriendNoticeIds,
            seenFriendSystemNoticeIds,
            unreadPendingFriendRequestCount,
            unreadFriendNoticeCount,
        },
        groupState: {
            activeMembers,
            activeJoinRequests,
            groupNoticeItems,
            globalGroupJoinRequests,
            seenGroupNoticeIds,
            unreadGroupNoticeCount,
        },
    }

    return createChatFacade({
        state,
        assembly: assemblyRuntime,
        searchAudit: searchAuditRuntime,
    })
}, {
    persist: true,
})

export type ChatStoreFacade = ReturnType<typeof useChatStore>