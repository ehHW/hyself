import { message } from 'ant-design-vue'
import { onMounted, watch } from 'vue'
import type { ChatRequestStatus } from '@/types/chat'
import { getErrorMessage } from '@/utils/error'
import { useChatShell } from '@/views/Chat/useChatShell'

export function useContactRequestsScene() {
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

    const loadData = async () => {
        try {
            await chatFriendship.loadFriendRequests()
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '加载好友申请失败'))
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
        handleRequestAction,
        statusColorMap,
        statusLabelMap,
    }
}