import { computed, ref, type Ref } from 'vue'
import { resetChatSearchAuditState } from '@/stores/chat/lifecycle'
import { loadAuditDataScene, runSearchScene } from '@/stores/chat/searchAudit'
import type { ChatConversationItem, ChatMessageItem, ChatSearchResult } from '@/types/chat'

export function createChatSearchAuditRuntime(deps: {
    userStore: {
        hasPermission: (code: string) => boolean
    }
    settingsStore: {
        chatStealthInspectEnabled: boolean
    }
}) {
    const searchResult = ref<ChatSearchResult | null>(null)
    const adminConversations = ref<ChatConversationItem[]>([])
    const adminMessages = ref<(ChatMessageItem & { conversation_id: number })[]>([])
    const isAuditAvailable = computed(() => deps.userStore.hasPermission('chat.review_all_messages') && deps.settingsStore.chatStealthInspectEnabled)

    const runSearch = async (keyword: string, scope: 'connected' | 'discover' | 'audit' = 'connected') => {
        if (scope === 'connected') {
            await runSearchScene(keyword, searchResult)
            return
        }
        await runSearchScene(keyword, searchResult, scope)
    }

    const clearSearchResult = () => {
        searchResult.value = null
    }

    const loadAuditData = async (keyword = '', conversationId?: number) => {
        await loadAuditDataScene({
            keyword,
            conversationId,
            isAuditAvailable,
            adminConversations,
            adminMessages,
        })
    }

    const reset = () => {
        resetChatSearchAuditState({
            searchResult,
            adminConversations,
            adminMessages,
        })
    }

    return {
        searchResult,
        adminConversations,
        adminMessages,
        isAuditAvailable,
        runSearch,
        clearSearchResult,
        loadAuditData,
        reset,
    }
}