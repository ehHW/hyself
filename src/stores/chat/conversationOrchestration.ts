import type { Ref } from 'vue'
import { getConversationsApi, hideConversationApi, toggleConversationPinApi } from '@/api/chat'
import {
    createGroupConversationScene,
    openDirectConversationScene,
    updateConversationPreferencesScene,
    updateGroupConfigScene,
} from '@/stores/chat/conversationScenes'
import { sortConversations } from '@/stores/chat/conversation'
import type { ChatConversationItem, ChatMessageItem } from '@/types/chat'

export function createConversationOrchestration(deps: {
    loading: Ref<boolean>
    conversations: Ref<ChatConversationItem[]>
    activeConversationId: Ref<number | null>
    contactGroupConversations: Ref<ChatConversationItem[]>
    focusedSequenceMap: Record<number, number | null>
    upsertConversation: (conversation: ChatConversationItem) => void
    chatListSortMode: () => 'recent' | 'unread'
    loadMessages: (conversationId: number, params?: { around_sequence?: number; limit?: number }) => Promise<void>
    getMessages: (conversationId: number) => ChatMessageItem[]
    markConversationRead: (conversationId: number, lastReadSequence: number) => Promise<void>
    loadFriends: () => Promise<void>
}) {
    const loadConversations = async (sortMode: 'recent' | 'unread' = 'recent') => {
        deps.loading.value = true
        try {
            const { data } = await getConversationsApi()
            deps.conversations.value = sortConversations(data.results, sortMode)
            const firstConversation = deps.conversations.value[0]
            const activeStillExists = deps.conversations.value.some((item) => item.id === deps.activeConversationId.value)
            if ((!deps.activeConversationId.value || !activeStillExists) && firstConversation) {
                deps.activeConversationId.value = firstConversation.id
            }
        } finally {
            deps.loading.value = false
        }
    }

    const loadContactGroupConversations = async () => {
        const { data } = await getConversationsApi({ category: 'group', include_hidden: true })
        deps.contactGroupConversations.value = data.results
    }

    const selectConversation = async (conversationId: number, options?: { focusSequence?: number }) => {
        deps.activeConversationId.value = conversationId
        const focusSequence = options?.focusSequence
        deps.focusedSequenceMap[conversationId] = focusSequence ?? null
        await deps.loadMessages(conversationId, focusSequence ? { around_sequence: focusSequence, limit: 30 } : undefined)
        const conversation = deps.conversations.value.find((item) => item.id === conversationId)
        const lastSequence = deps.getMessages(conversationId).at(-1)?.sequence || 0
        if (conversation && conversation.unread_count > 0 && lastSequence > 0) {
            await deps.markConversationRead(conversationId, lastSequence)
        }
    }

    const toggleConversationPin = async (conversationId: number, isPinned: boolean) => {
        const { data } = await toggleConversationPinApi(conversationId, isPinned)
        deps.upsertConversation(data.conversation)
    }

    const hideConversation = async (conversationId: number) => {
        await hideConversationApi(conversationId)
        deps.conversations.value = deps.conversations.value.filter((item) => item.id !== conversationId)
        deps.contactGroupConversations.value = deps.contactGroupConversations.value.map((item) => (item.id === conversationId ? { ...item, show_in_list: false } : item))
        if (deps.activeConversationId.value === conversationId) {
            deps.activeConversationId.value = deps.conversations.value[0]?.id || null
        }
    }

    const openDirectConversation = async (targetUserId: number) => {
        await openDirectConversationScene({
            targetUserId,
            loadConversations,
            loadContactGroupConversations,
            loadFriends: deps.loadFriends,
            selectConversation,
        })
    }

    const createGroupConversation = async (payload: {
        name: string
        member_user_ids: number[]
        join_approval_required: boolean
        allow_member_invite: boolean
    }) => {
        await createGroupConversationScene({
            payload,
            loadConversations,
            loadContactGroupConversations,
            selectConversation,
        })
    }

    const updateGroupConfig = async (
        conversationId: number,
        payload: { name?: string; avatar?: string; join_approval_required?: boolean; allow_member_invite?: boolean; max_members?: number | null; mute_all?: boolean },
    ) => updateGroupConfigScene({ conversationId, payload, conversations: deps.conversations, upsertConversation: deps.upsertConversation })

    const updateConversationPreferences = async (conversationId: number, payload: { mute_notifications?: boolean; group_nickname?: string }) => (
        updateConversationPreferencesScene({ conversationId, payload, upsertConversation: deps.upsertConversation })
    )

    const setFocusedSequence = (conversationId: number, sequence: number | null) => {
        deps.focusedSequenceMap[conversationId] = sequence
    }

    const clearFocusedSequence = (conversationId: number) => {
        deps.focusedSequenceMap[conversationId] = null
    }

    return {
        loadConversations,
        loadContactGroupConversations,
        selectConversation,
        toggleConversationPin,
        hideConversation,
        openDirectConversation,
        createGroupConversation,
        updateGroupConfig,
        updateConversationPreferences,
        setFocusedSequence,
        clearFocusedSequence,
    }
}