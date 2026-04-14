import { message } from 'ant-design-vue'
import { computed, onMounted, watch } from 'vue'
import type { ChatRequestStatus } from '@/types/chat'
import { getErrorMessage } from '@/utils/error'
import { useChatShell } from '@/views/Chat/useChatShell'

type FriendNoticeItem = {
    id: string
    sourceId: number | string
    sourceType: 'request' | 'system'
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
        const received = chatFriendshipState.receivedRequests
            .filter((item) => item.status !== 'pending')
            .map((item) => ({
                id: `request-received-${item.id}`,
                sourceId: item.id,
                sourceType: 'request' as const,
                kind: 'received' as const,
                title: `${item.from_user.display_name || item.from_user.username} 的好友申请${item.status === 'accepted' ? '已通过' : item.status === 'rejected' ? '已拒绝' : '已处理'}`,
                description: item.request_message || '无附言',
                created_at: item.handled_at || item.created_at,
            }))
        const sent = chatFriendshipState.sentRequests
            .filter((item) => item.status !== 'pending')
            .map((item) => ({
                id: `request-sent-${item.id}`,
                sourceId: item.id,
                sourceType: 'request' as const,
                kind: 'sent' as const,
                title: `你发给 ${item.to_user.display_name || item.to_user.username} 的好友申请${item.status === 'accepted' ? '已通过' : item.status === 'rejected' ? '已拒绝' : item.status === 'canceled' ? '已撤销' : '已处理'}`,
                description: item.request_message || '无附言',
                created_at: item.handled_at || item.created_at,
            }))
        const system = chatFriendshipState.friendNoticeItems.map((item) => ({
            id: item.id,
            sourceId: item.id,
            sourceType: 'system' as const,
            kind: 'system' as const,
            title: item.title,
            description: item.description,
            created_at: item.created_at,
        }))
        return [...received, ...sent, ...system].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    })

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
            chatFriendship.markFriendNoticesSeen(items.filter((item) => item.sourceType === 'request').map((item) => item.sourceId as number))
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
        handleRequestAction,
        statusColorMap,
        statusLabelMap,
    }
}