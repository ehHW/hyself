import { defineStore, storeToRefs } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { useConversationChatStore } from '@/stores/chat/conversationState'
import type { ChatConversationMemberItem, ChatGroupJoinRequestItem, ChatGroupNoticeItem } from '@/types/chat'

export const useGroupChatStore = defineStore('chat-group-state', () => {
    const conversationStore = useConversationChatStore()
    const { activeConversationId } = storeToRefs(conversationStore)
    const memberMap = reactive<Record<number, ChatConversationMemberItem[]>>({})
    const joinRequestMap = reactive<Record<number, ChatGroupJoinRequestItem[]>>({})
    const groupNoticeItems = ref<ChatGroupNoticeItem[]>([])
    const globalGroupJoinRequests = ref<ChatGroupJoinRequestItem[]>([])
    const seenGroupNoticeIds = ref<string[]>([])

    const activeMembers = computed(() => (activeConversationId.value ? memberMap[activeConversationId.value] || [] : []))
    const activeJoinRequests = computed(() => (activeConversationId.value ? joinRequestMap[activeConversationId.value] || [] : []))
    const unreadGroupNoticeCount = computed(() => groupNoticeItems.value.filter((item) => !seenGroupNoticeIds.value.includes(item.id)).length)

    const markGroupNoticesSeen = (noticeIds: string[]) => {
        if (!noticeIds.length) {
            return
        }
        const nextIds = new Set(seenGroupNoticeIds.value)
        noticeIds.forEach((id) => nextIds.add(id))
        seenGroupNoticeIds.value = Array.from(nextIds)
    }

    const markAllGroupNoticesSeen = () => {
        markGroupNoticesSeen(groupNoticeItems.value.map((item) => item.id))
    }

    return {
        memberMap,
        joinRequestMap,
        groupNoticeItems,
        globalGroupJoinRequests,
        seenGroupNoticeIds,
        activeMembers,
        activeJoinRequests,
        unreadGroupNoticeCount,
        markGroupNoticesSeen,
        markAllGroupNoticesSeen,
    }
})