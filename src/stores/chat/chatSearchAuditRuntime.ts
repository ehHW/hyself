import { computed, ref, type Ref } from 'vue'
import { resetChatSearchAuditState } from '@/stores/chat/lifecycle'
import { createChatSearchAuditRealtimeRuntime } from '@/stores/chat/searchAuditRealtimeRuntime'
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
    const lastSearchKeyword = ref('')
    const lastSearchScope = ref<'connected' | 'discover' | 'audit'>('connected')
    const lastAuditKeyword = ref('')
    const lastAuditConversationId = ref<number | undefined>(undefined)
    const isAuditAvailable = computed(() => deps.userStore.hasPermission('chat.review_all_messages') && deps.settingsStore.chatStealthInspectEnabled)

    const runSearch = async (keyword: string, scope: 'connected' | 'discover' | 'audit' = 'connected') => {
        lastSearchKeyword.value = keyword
        lastSearchScope.value = scope
        if (scope === 'connected') {
            await runSearchScene(keyword, searchResult)
            return
        }
        await runSearchScene(keyword, searchResult, scope)
    }

    const clearSearchResult = () => {
        searchResult.value = null
        lastSearchKeyword.value = ''
        lastSearchScope.value = 'connected'
    }

    const loadAuditData = async (keyword = '', conversationId?: number) => {
        lastAuditKeyword.value = keyword
        lastAuditConversationId.value = conversationId
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
        lastSearchKeyword.value = ''
        lastSearchScope.value = 'connected'
        lastAuditKeyword.value = ''
        lastAuditConversationId.value = undefined
    }

    const refreshSearch = async () => {
        if (!searchResult.value || !lastSearchKeyword.value.trim()) {
            return
        }
        await runSearch(lastSearchKeyword.value, lastSearchScope.value)
    }

    const refreshAudit = async () => {
        const hasAuditSnapshot = adminConversations.value.length > 0 || adminMessages.value.length > 0 || Boolean(lastAuditKeyword.value.trim()) || typeof lastAuditConversationId.value === 'number'
        if (!hasAuditSnapshot) {
            return
        }
        await loadAuditData(lastAuditKeyword.value, lastAuditConversationId.value)
    }

    const realtimeRuntime = createChatSearchAuditRealtimeRuntime({
        hasActiveSearch: () => Boolean(searchResult.value && lastSearchKeyword.value.trim()),
        refreshSearch,
        hasActiveAudit: () => isAuditAvailable.value && (adminConversations.value.length > 0 || adminMessages.value.length > 0 || Boolean(lastAuditKeyword.value.trim()) || typeof lastAuditConversationId.value === 'number'),
        refreshAudit,
    })

    realtimeRuntime.ensureSubscription()

    return {
        searchResult,
        adminConversations,
        adminMessages,
        isAuditAvailable,
        runSearch,
        clearSearchResult,
        loadAuditData,
        reset,
        refreshSearch,
        refreshAudit,
    }
}