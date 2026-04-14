import { message } from 'ant-design-vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useChatCapabilityScene } from '@/modules/chat-center/composables/useChatCapabilityScene'
import { subscribeAppRefresh } from '@/utils/appRefresh'
import { getErrorMessage } from '@/utils/error'
import { useChatShell } from '@/views/Chat/useChatShell'

export function useAuditScene(options?: { autoLoad?: boolean }) {
    const router = useRouter()
    const { chatStore } = useChatShell()
    const { canReviewAllMessages } = useChatCapabilityScene()
    const chatAudit = chatStore.audit
    const chatConversation = chatStore.conversation
    const auditKeyword = ref('')
    let unsubscribeAppRefresh: (() => void) | null = null

    const handleLoadAudit = async () => {
        if (!canReviewAllMessages.value) {
            return
        }
        try {
            await chatAudit.loadAuditData(auditKeyword.value.trim())
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '加载巡检数据失败'))
        }
    }

    const openConversation = async (conversationId: number, sequence?: number) => {
        await chatConversation.selectConversation(conversationId, sequence ? { focusSequence: sequence } : undefined)
        await router.push({ name: 'ChatMessages' })
    }

    onMounted(() => {
        if (!options?.autoLoad) {
            return
        }
        unsubscribeAppRefresh = subscribeAppRefresh(async () => {
            await handleLoadAudit()
        })
        void handleLoadAudit()
    })

    onBeforeUnmount(() => {
        unsubscribeAppRefresh?.()
        unsubscribeAppRefresh = null
    })

    return {
        auditKeyword,
        canReviewAllMessages,
        chatAudit,
        handleLoadAudit,
        openConversation,
    }
}