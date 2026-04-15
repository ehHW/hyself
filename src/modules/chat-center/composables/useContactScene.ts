import { message } from 'ant-design-vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatCapabilityScene } from '@/modules/chat-center/composables/useChatCapabilityScene'
import type { ChatSearchUserItem } from '@/types/chat'
import { getErrorMessage } from '@/utils/error'
import { useChatShell } from '@/views/Chat/useChatShell'

export function useContactScene() {
    const route = useRoute()
    const router = useRouter()
    const { chatStore } = useChatShell()
    const { canAddFriend, canManageGroup } = useChatCapabilityScene()
    const chatConversationState = chatStore.state.conversationState
    const chatFriendshipState = chatStore.state.friendshipState
    const chatGroupState = chatStore.state.groupState
    const chatConversation = chatStore.conversation
    const chatFriendship = chatStore.friendship
    const chatGroup = chatStore.group
    const chatAudit = chatStore.audit

    const contactKeyword = ref('')
    const activeContactTab = ref<'friends' | 'groups'>('friends')
    const addFriendModalOpen = ref(false)
    const discoverKeyword = ref('')
    const friendRequestMessage = ref('')
    const searchTimer = ref<ReturnType<typeof setTimeout> | null>(null)
    const CHAT_MODAL_WIDTH_SM = 427
    const tallModalBodyStyle = {
        minHeight: '54vh',
        maxHeight: '72vh',
        overflowY: 'auto' as const,
    }

    const pendingFriendRequestCount = computed(() => chatFriendshipState.unreadPendingFriendRequestCount)
    const groupNoticeCount = computed(() => chatGroupState.globalGroupJoinRequests.length + chatGroupState.unreadGroupNoticeCount)
    const friendNoticeShortcutCount = computed(() => pendingFriendRequestCount.value + chatFriendshipState.unreadFriendNoticeCount)
    const friendUserIds = computed(() => new Set(chatFriendshipState.friends.map((item) => item.friend_user.id)))

    const filteredFriends = computed(() => {
        const keyword = contactKeyword.value.trim().toLowerCase()
        if (!keyword) {
            return chatFriendshipState.friends
        }
        return chatFriendshipState.friends.filter((item) => {
            const target = `${item.remark || ''} ${item.friend_user.display_name} ${item.friend_user.username}`.toLowerCase()
            return target.includes(keyword)
        })
    })

    const filteredGroups = computed(() => {
        const keyword = contactKeyword.value.trim().toLowerCase()
        if (!keyword) {
            return chatConversationState.contactGroupConversations
        }
        return chatConversationState.contactGroupConversations.filter((item) => {
            const target = `${item.name} ${item.last_message_preview || ''}`.toLowerCase()
            return target.includes(keyword)
        })
    })

    const reloadFriendData = async () => {
        try {
            const tasks: Array<Promise<unknown>> = [
                chatFriendship.loadFriends(),
                chatConversation.loadContactGroupConversations(),
                chatFriendship.loadFriendRequests(),
            ]
            if (canManageGroup.value) {
                tasks.push(chatGroup.loadGlobalGroupJoinRequests())
            }
            await Promise.all(tasks)
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '加载好友数据失败'))
        }
    }

    const handleOpenFriendChat = async (userId: number, conversationId: number | null) => {
        try {
            if (conversationId) {
                await chatConversation.selectConversation(conversationId)
            } else {
                await chatConversation.openDirectConversation(userId)
            }
            await chatFriendship.loadFriends()
            addFriendModalOpen.value = false
            await router.push({ name: 'ChatMessages' })
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '打开私聊失败'))
        }
    }

    const handleOpenGroup = async (conversationId: number) => {
        try {
            await chatConversation.selectConversation(conversationId)
            await chatConversation.loadContactGroupConversations()
            await router.push({ name: 'ChatMessages' })
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '打开群聊失败'))
        }
    }

    const handleSendFriendRequest = async (userId: number) => {
        try {
            await chatFriendship.submitFriendRequest(userId, friendRequestMessage.value.trim() || undefined)
            message.success('好友申请已发送')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '发送好友申请失败'))
        }
    }

    const shouldShowAddFriendAction = (user: ChatSearchUserItem) => canAddFriend.value && !friendUserIds.value.has(user.id)

    watch(
        () => discoverKeyword.value,
        (keyword) => {
            if (searchTimer.value) {
                clearTimeout(searchTimer.value)
                searchTimer.value = null
            }
            if (!keyword.trim()) {
                chatAudit.clearSearchResult()
                return
            }
            searchTimer.value = setTimeout(() => {
                void chatAudit.runSearch(keyword.trim(), 'discover')
            }, 250)
        },
    )

    onMounted(() => {
        void reloadFriendData()
    })

    onBeforeUnmount(() => {
        if (searchTimer.value) {
            clearTimeout(searchTimer.value)
        }
    })

    return {
        CHAT_MODAL_WIDTH_SM,
        activeContactTab,
        addFriendModalOpen,
        canAddFriend,
        chatAudit,
        chatConversationState,
        chatFriendshipState,
        contactKeyword,
        discoverKeyword,
        filteredFriends,
        filteredGroups,
        friendNoticeShortcutCount,
        friendRequestMessage,
        groupNoticeCount,
        handleOpenFriendChat,
        handleOpenGroup,
        handleSendFriendRequest,
        route,
        router,
        shouldShowAddFriendAction,
        tallModalBodyStyle,
    }
}