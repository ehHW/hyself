import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ChatFriendNoticeItem, ChatFriendRequestItem, ChatFriendshipItem } from '@/types/chat'

export const useFriendshipChatStore = defineStore('chat-friendship-state', () => {
    const friends = ref<ChatFriendshipItem[]>([])
    const receivedRequests = ref<ChatFriendRequestItem[]>([])
    const sentRequests = ref<ChatFriendRequestItem[]>([])
    const friendNoticeItems = ref<ChatFriendNoticeItem[]>([])
    const seenPendingRequestIds = ref<number[]>([])
    const seenFriendNoticeIds = ref<number[]>([])
    const seenFriendSystemNoticeIds = ref<string[]>([])

    const unreadFriendNoticeCount = computed(() => {
        const seenSystem = new Set(seenFriendSystemNoticeIds.value)
        return friendNoticeItems.value.filter((item) => !seenSystem.has(item.id)).length
    })

    const unreadPendingFriendRequestCount = computed(() => {
        const seen = new Set(seenPendingRequestIds.value)
        return receivedRequests.value.filter((item) => item.status === 'pending' && !seen.has(item.id)).length
    })

    return {
        friends,
        receivedRequests,
        sentRequests,
        friendNoticeItems,
        seenPendingRequestIds,
        seenFriendNoticeIds,
        seenFriendSystemNoticeIds,
        unreadFriendNoticeCount,
        unreadPendingFriendRequestCount,
    }
}, {
    persist: true,
})