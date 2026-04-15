import { message } from 'ant-design-vue'
import { computed, onMounted, watch } from 'vue'
import type { ChatRequestStatus } from '@/types/chat'
import type { ChatFriendRequestItem } from '@/types/chat'
import { getErrorMessage } from '@/utils/error'
import { useChatShell } from '@/views/Chat/useChatShell'

type FriendNoticeItem = {
    id: string
    sourceId: number | string
    sourceType: 'system'
    kind: 'received' | 'sent' | 'system'
    title: string
    description: string
    created_at: string
}

export function useContactFriendNoticesScene() {
    const { chatStore, formatDateTime } = useChatShell()
    const chatFriendshipState = chatStore.state.friendshipState
    const chatFriendship = chatStore.friendship

    const statusLabelMap: Record<ChatRequestStatus, string> = {
        pending: '待处理',
        accepted: '已通过',
        rejected: '已拒绝',
        canceled: '已撤销',
        expired: '已过期',
    }

    const statusColorMap: Partial<Record<ChatRequestStatus, string>> = {
        accepted: 'success',
        rejected: 'error',
        canceled: 'default',
        expired: 'warning',
    }

    const friendNoticeItems = computed<FriendNoticeItem[]>(() => {
        const system = chatFriendshipState.friendNoticeItems.map((item) => ({
            id: item.id,
            sourceId: item.id,
            sourceType: 'system' as const,
            kind: (String(item.payload.request_direction || item.payload.notice_type || '').includes('received') ? 'received' : String(item.payload.request_direction || '').includes('sent') ? 'sent' : 'system') as 'received' | 'sent' | 'system',
            title: item.title,
            description: item.description,
            created_at: item.created_at,
        }))
        return system.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    })

    const sortRequestsByTime = (items: ChatFriendRequestItem[]) => {
        return [...items].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    }

    const receivedHistory = computed(() => sortRequestsByTime(chatFriendshipState.receivedRequests))
    const sentHistory = computed(() => sortRequestsByTime(chatFriendshipState.sentRequests))

    const loadData = async () => {
        try {
            await chatFriendship.loadFriendRequests()
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '加载好友通知失败'))
        }
    }

    const handleRequestAction = async (requestId: number, action: 'accept' | 'reject' | 'cancel') => {
        try {
            await chatFriendship.handleFriendRequest(requestId, action)
            message.success('操作成功')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '处理好友申请失败'))
        }
    }

    watch(
        friendNoticeItems,
        (items) => {
            chatFriendship.markFriendSystemNoticesSeen(items.filter((item) => item.sourceType === 'system').map((item) => item.sourceId as string))
        },
        { immediate: true },
    )

    watch(
        () => chatFriendshipState.receivedRequests.filter((item) => item.status === 'pending').map((item) => item.id),
        (requestIds) => {
            chatFriendship.markPendingRequestsSeen(requestIds)
        },
        { immediate: true },
    )

    onMounted(() => {
        void loadData()
    })

    return {
        chatFriendshipState,
        formatDateTime,
        friendNoticeItems,
        receivedHistory,
        sentHistory,
        handleRequestAction,
        statusColorMap,
        statusLabelMap,
    }
}