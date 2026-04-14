import { message } from 'ant-design-vue'
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useChatCapabilityScene } from '@/modules/chat-center/composables/useChatCapabilityScene'
import { useGroupChatStore } from '@/stores/chat/groupState'
import { getErrorMessage } from '@/utils/error'
import { useChatShell } from '@/views/Chat/useChatShell'

export function useContactGroupNoticesScene() {
    const router = useRouter()
    const groupStateStore = useGroupChatStore()
    const { chatStore, formatDateTime } = useChatShell()
    const { canManageGroup } = useChatCapabilityScene()
    const chatGroupState = chatStore.state.groupState
    const chatConversationState = chatStore.state.conversationState
    const chatGroup = chatStore.group
    const chatConversation = chatStore.conversation

    const loadData = async () => {
        if (!canManageGroup.value) {
            return
        }
        try {
            await chatGroup.loadGlobalGroupJoinRequests()
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '加载群通知失败'))
        }
    }

    const handleJoinRequestAction = async (requestId: number, action: 'approve' | 'reject', conversationId: number) => {
        try {
            await chatGroup.handleJoinRequest(requestId, action, conversationId)
            if (canManageGroup.value) {
                await chatGroup.loadGlobalGroupJoinRequests()
            }
            message.success('审批已处理')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '处理入群申请失败'))
        }
    }

    const openConversation = async (conversationId: number) => {
        const target = chatConversationState.conversations.find((item) => item.id === conversationId)
        if (target) {
            await chatConversation.selectConversation(conversationId)
        }
        await router.push({ name: 'ChatMessages' })
    }

    onMounted(() => {
        void loadData()
            ; (groupStateStore as any).markAllGroupNoticesSeen()
    })

    watch(
        () => chatGroupState.groupNoticeItems.map((item) => item.id).join(','),
        () => {
            ; (groupStateStore as any).markAllGroupNoticesSeen()
        },
        { immediate: true },
    )

    return {
        canManageGroup,
        chatGroupState,
        formatDateTime,
        handleJoinRequestAction,
        openConversation,
    }
}