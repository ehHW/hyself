import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import type { ChatConversationItem } from '@/types/chat'

export const useConversationChatStore = defineStore('chat-conversation-state', () => {
    const conversations = ref<ChatConversationItem[]>([])
    const activeConversationId = ref<number | null>(null)
    const contactGroupConversations = ref<ChatConversationItem[]>([])
    const focusedSequenceMap = reactive<Record<number, number | null>>({})

    const activeConversation = computed(() => conversations.value.find((item) => item.id === activeConversationId.value) || null)
    const totalUnreadCount = computed(() => conversations.value.reduce(
        (total, item) => total + (item.member_settings?.mute_notifications ? 0 : item.unread_count),
        0,
    ))

    return {
        conversations,
        activeConversationId,
        contactGroupConversations,
        focusedSequenceMap,
        activeConversation,
        totalUnreadCount,
    }
})