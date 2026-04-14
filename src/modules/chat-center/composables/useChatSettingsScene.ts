import { useRoute, useRouter } from 'vue-router'
import { useChatCapabilityScene } from '@/modules/chat-center/composables/useChatCapabilityScene'

export function useChatSettingsScene() {
    const route = useRoute()
    const router = useRouter()
    const { canReviewAllMessages } = useChatCapabilityScene()

    return {
        canReviewAllMessages,
        route,
        router,
    }
}