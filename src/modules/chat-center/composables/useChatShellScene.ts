import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import { computed, onBeforeUnmount, onMounted, unref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatCapabilityScene } from '@/modules/chat-center/composables/useChatCapabilityScene'
import { useChatStore, type ChatStoreFacade } from '@/stores/chat'
import { useSettingsStore } from '@/stores/settings'
import { useUserStore } from '@/stores/user'
import { subscribeAppRefresh } from '@/utils/appRefresh'
import type { ChatMessageItem } from '@/types/chat'
import { getErrorMessage } from '@/utils/error'

let bootstrapped = false

export function useChatShellScene(options?: { bootstrap?: boolean }) {
    const chatStore: ChatStoreFacade = useChatStore()
    const chatState = chatStore.state
    const chatConversationState = chatState.conversationState
    const chatMessageState = chatState.messageState
    const chatLifecycle = chatStore.lifecycle
    const chatAudit = chatStore.audit
    const chatConversation = chatStore.conversation
    const chatMessage = chatStore.message
    const settingsStore = useSettingsStore()
    const userStore = useUserStore()
    const { activeConversationCapabilities } = useChatCapabilityScene()
    const router = useRouter()
    const route = useRoute()

    const avatarText = (value: string) => (value || '?').slice(0, 1).toUpperCase()
    const avatarStyle = (type: 'direct' | 'group') => ({ backgroundColor: type === 'group' ? '#154c79' : '#6c3d1b' })
    const formatShortTime = (value: string | null) => (value ? dayjs(value).format('MM-DD HH:mm') : '')
    const formatDateTime = (value: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '')
    const isSelfMessage = (messageItem: ChatMessageItem) => messageItem.sender?.id === userStore.user?.id
    const messageRowClass = (messageItem: ChatMessageItem) => ({ self: isSelfMessage(messageItem), system: messageItem.is_system })
    const canManageMembers = computed(() => activeConversationCapabilities.value.canManageMembers)
    const canEditRoles = computed(() => activeConversationCapabilities.value.canManageGroupSettings)
    const canLoadOlderMessages = computed(() => {
        const activeId = chatConversationState.activeConversationId
        if (!activeId) {
            return false
        }
        const firstSequence = chatMessageState.activeMessages[0]?.sequence || 0
        return firstSequence > 1
    })
    const typingText = computed(() => {
        const activeConversation = chatConversationState.activeConversation
        if (activeConversation?.type && activeConversation.type !== 'direct') {
            return ''
        }
        if (!chatMessageState.typingUsers.length) {
            return ''
        }
        const typingUser = chatMessageState.typingUsers[0]
        const displayName = typingUser?.display_name || typingUser?.username || '对方'
        return `${displayName} 正在输入...`
    })
    const isStealthAuditEnabled = computed(() => Boolean(unref(chatAudit.isAuditAvailable)))
    let unsubscribeAppRefresh: (() => void) | null = null

    const initializeChat = async () => {
        try {
            await settingsStore.loadChatPreferences()
        } catch {
            // ignore and use local persisted settings
        }
        try {
            await chatLifecycle.initialize(settingsStore.chatListSortMode)
            if (route.name === 'ChatCenter') {
                await router.replace({ name: 'ChatMessages' })
            }
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '初始化聊天失败'))
        }
    }

    const refreshCurrentChatScene = async () => {
        try {
            await settingsStore.loadChatPreferences()
        } catch {
            // ignore and use local persisted settings
        }

        const tasks: Array<Promise<unknown>> = [
            chatConversation.loadConversations(settingsStore.chatListSortMode),
            chatConversation.loadContactGroupConversations(),
            chatStore.friendship.loadFriends(),
            chatStore.friendship.loadFriendRequests(),
        ]

        if (userStore.hasPermission('chat.manage_group')) {
            tasks.push(chatStore.group.loadGlobalGroupJoinRequests())
        }

        if (chatConversationState.activeConversationId) {
            tasks.push(
                chatStore.message.loadMessages(
                    chatConversationState.activeConversationId,
                ),
            )
        }

        const routeName = String(route.name || '')
        if (routeName.includes('Audit') || routeName === 'ChatSettingsInspect') {
            tasks.push(chatAudit.loadAuditData())
        }

        await Promise.allSettled(tasks)
    }

    if (options?.bootstrap) {
        onMounted(() => {
            if (!bootstrapped || !chatLifecycle.initialized) {
                bootstrapped = true
                void initializeChat()
            }
            unsubscribeAppRefresh = subscribeAppRefresh(async () => {
                await refreshCurrentChatScene()
            })
        })

        watch(
            () => settingsStore.chatListSortMode,
            (nextMode) => {
                void chatConversation.loadConversations(nextMode)
            },
        )

        onBeforeUnmount(() => {
            unsubscribeAppRefresh?.()
            unsubscribeAppRefresh = null
            chatMessage.sendTyping(false)
        })
    }

    return {
        chatStore,
        settingsStore,
        userStore,
        avatarText,
        avatarStyle,
        formatShortTime,
        formatDateTime,
        isSelfMessage,
        messageRowClass,
        canManageMembers,
        canEditRoles,
        canLoadOlderMessages,
        typingText,
        isStealthAuditEnabled,
    }
}