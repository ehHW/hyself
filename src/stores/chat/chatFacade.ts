import type { createChatAssemblyRuntime } from '@/stores/chat/chatAssemblyRuntime'
import type { createChatSearchAuditRuntime } from '@/stores/chat/chatSearchAuditRuntime'

export type ChatAssemblyRuntime = ReturnType<typeof createChatAssemblyRuntime>
export type ChatSearchAuditRuntime = ReturnType<typeof createChatSearchAuditRuntime>

type ConversationNamespace = Pick<ChatAssemblyRuntime,
    'loadConversations' | 'loadContactGroupConversations' | 'selectConversation' | 'toggleConversationPin' | 'hideConversation' | 'openDirectConversation' | 'createGroupConversation' | 'updateGroupConfig' | 'updateConversationPreferences' | 'setFocusedSequence' | 'clearFocusedSequence'
>

type FriendshipNamespace = Pick<ChatAssemblyRuntime,
    'loadFriends' | 'loadFriendRequests' | 'markPendingRequestsSeen' | 'markFriendNoticesSeen' | 'markFriendSystemNoticesSeen' | 'submitFriendRequest' | 'handleFriendRequest' | 'removeFriend' | 'updateFriendRemark'
>

type GroupNamespace = Pick<ChatAssemblyRuntime,
    'loadMembers' | 'loadJoinRequests' | 'loadGlobalGroupJoinRequests' | 'inviteMember' | 'removeMember' | 'updateMemberRole' | 'muteMember' | 'leaveConversation' | 'transferOwner' | 'disbandConversation' | 'handleJoinRequest'
>

type MessageNamespace = Pick<ChatAssemblyRuntime,
    'loadMessages' | 'loadOlderMessages' | 'markConversationRead' | 'sendTextMessage' | 'sendAttachmentMessage' | 'sendTyping' | 'retryMessage' | 'revokeMessage' | 'deleteMessage' | 'restoreRevokedDraft'
>

type LifecycleNamespace = Pick<ChatAssemblyRuntime, 'initialized' | 'loading' | 'initialize' | 'bootstrapSummaries'> & {
    reset: () => void
}

type AuditNamespace = Pick<ChatSearchAuditRuntime,
    'searchResult' | 'adminConversations' | 'adminMessages' | 'isAuditAvailable' | 'runSearch' | 'clearSearchResult' | 'loadAuditData'
>

export type ChatStateNamespaces = {
    conversationState: object
    messageState: object
    friendshipState: object
    groupState: object
}

export type ChatFacade<TState extends ChatStateNamespaces = ChatStateNamespaces> = {
    state: TState
    lifecycle: LifecycleNamespace
    audit: AuditNamespace
    conversation: ConversationNamespace
    friendship: FriendshipNamespace
    group: GroupNamespace
    message: MessageNamespace
}

export function createChatFacade<TState extends ChatStateNamespaces>(options: {
    state: TState
    assembly: ChatAssemblyRuntime
    searchAudit: ChatSearchAuditRuntime
}): ChatFacade<TState> {
    const reset = () => {
        options.assembly.reset()
        options.searchAudit.reset()
    }

    const lifecycle = {
        initialized: options.assembly.initialized,
        loading: options.assembly.loading,
        initialize: options.assembly.initialize,
        bootstrapSummaries: options.assembly.bootstrapSummaries,
        reset,
    }

    const audit = {
        searchResult: options.searchAudit.searchResult,
        adminConversations: options.searchAudit.adminConversations,
        adminMessages: options.searchAudit.adminMessages,
        isAuditAvailable: options.searchAudit.isAuditAvailable,
        runSearch: options.searchAudit.runSearch,
        clearSearchResult: options.searchAudit.clearSearchResult,
        loadAuditData: options.searchAudit.loadAuditData,
    }

    const conversation = {
        loadConversations: options.assembly.loadConversations,
        loadContactGroupConversations: options.assembly.loadContactGroupConversations,
        selectConversation: options.assembly.selectConversation,
        toggleConversationPin: options.assembly.toggleConversationPin,
        hideConversation: options.assembly.hideConversation,
        openDirectConversation: options.assembly.openDirectConversation,
        createGroupConversation: options.assembly.createGroupConversation,
        updateGroupConfig: options.assembly.updateGroupConfig,
        updateConversationPreferences: options.assembly.updateConversationPreferences,
        setFocusedSequence: options.assembly.setFocusedSequence,
        clearFocusedSequence: options.assembly.clearFocusedSequence,
    }

    const friendship = {
        loadFriends: options.assembly.loadFriends,
        loadFriendRequests: options.assembly.loadFriendRequests,
        markPendingRequestsSeen: options.assembly.markPendingRequestsSeen,
        markFriendNoticesSeen: options.assembly.markFriendNoticesSeen,
        markFriendSystemNoticesSeen: options.assembly.markFriendSystemNoticesSeen,
        submitFriendRequest: options.assembly.submitFriendRequest,
        handleFriendRequest: options.assembly.handleFriendRequest,
        removeFriend: options.assembly.removeFriend,
        updateFriendRemark: options.assembly.updateFriendRemark,
    }

    const group = {
        loadMembers: options.assembly.loadMembers,
        loadJoinRequests: options.assembly.loadJoinRequests,
        loadGlobalGroupJoinRequests: options.assembly.loadGlobalGroupJoinRequests,
        inviteMember: options.assembly.inviteMember,
        removeMember: options.assembly.removeMember,
        updateMemberRole: options.assembly.updateMemberRole,
        muteMember: options.assembly.muteMember,
        leaveConversation: options.assembly.leaveConversation,
        transferOwner: options.assembly.transferOwner,
        disbandConversation: options.assembly.disbandConversation,
        handleJoinRequest: options.assembly.handleJoinRequest,
    }

    const message = {
        loadMessages: options.assembly.loadMessages,
        loadOlderMessages: options.assembly.loadOlderMessages,
        markConversationRead: options.assembly.markConversationRead,
        sendTextMessage: options.assembly.sendTextMessage,
        sendAttachmentMessage: options.assembly.sendAttachmentMessage,
        sendTyping: options.assembly.sendTyping,
        retryMessage: options.assembly.retryMessage,
        revokeMessage: options.assembly.revokeMessage,
        deleteMessage: options.assembly.deleteMessage,
        restoreRevokedDraft: options.assembly.restoreRevokedDraft,
    }

    return {
        state: options.state,
        lifecycle,
        audit,
        conversation,
        friendship,
        group,
        message,
    }
}