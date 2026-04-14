import { Modal, message } from 'ant-design-vue'
import { computed, ref } from 'vue'
import { forwardMessagesApi, openDirectConversationApi } from '@/api/chat'
import type { ChatStoreFacade } from '@/stores/chat'
import type { ChatConversationItem, ChatFriendshipItem, ChatMessageItem } from '@/types/chat'
import { getErrorMessage } from '@/utils/error'
import { trimText } from '@/validators/common'

export type ForwardTargetOption = {
    key: string
    targetType: 'conversation' | 'friend'
    conversationId: number | null
    userId: number | null
    name: string
    avatar: string
    description: string
    searchText: string
    sortTime: string
}

type ChatStoreForwardingLike = Pick<ChatStoreFacade, 'state' | 'conversation' | 'friendship'>

export function useChatWorkspaceForwarding(options: {
    chatStore: ChatStoreForwardingLike
    getMessageQuotePreview: (messageItem: ChatMessageItem) => string
    resolveMenuMessage: () => ChatMessageItem | null
    clearMessageSelection: () => void
    closeMessageMenu: () => void
}) {
    const forwardModalOpen = ref(false)
    const forwardModeModalOpen = ref(false)
    const forwardSearchKeyword = ref('')
    const selectedForwardTargetKey = ref('')
    const forwarding = ref(false)
    const forwardingMessageIds = ref<number[]>([])
    const pendingForwardTarget = ref<ForwardTargetOption | null>(null)
    const selectedForwardMode = ref<'separate' | 'merged' | null>(null)
    const recentForwardTargetKeys = ref<string[]>([])

    const FORWARD_RECENT_STORAGE_KEY = 'solbot.chat.forward.recent-targets'
    const FORWARD_RECENT_LIMIT = 7

    const loadRecentForwardTargetKeys = () => {
        if (typeof window === 'undefined') {
            return []
        }
        try {
            const rawValue = window.localStorage.getItem(FORWARD_RECENT_STORAGE_KEY)
            if (!rawValue) {
                return []
            }
            const parsed = JSON.parse(rawValue)
            if (!Array.isArray(parsed)) {
                return []
            }
            return parsed.filter((item): item is string => typeof item === 'string').slice(0, FORWARD_RECENT_LIMIT)
        } catch {
            return []
        }
    }

    const persistRecentForwardTarget = (targetKey: string) => {
        recentForwardTargetKeys.value = [targetKey, ...recentForwardTargetKeys.value.filter((item) => item !== targetKey)].slice(0, FORWARD_RECENT_LIMIT)
        if (typeof window === 'undefined') {
            return
        }
        window.localStorage.setItem(FORWARD_RECENT_STORAGE_KEY, JSON.stringify(recentForwardTargetKeys.value))
    }

    const buildForwardMessageSummary = () => {
        if (forwardingMessageIds.value.length > 1) {
            return `${forwardingMessageIds.value.length} 条消息`
        }
        const currentMessage = options.chatStore.state.messageState.activeMessages.find((item) => item.id === forwardingMessageIds.value[0]) || options.resolveMenuMessage()
        const preview = trimText(currentMessage ? options.getMessageQuotePreview(currentMessage) : '这条消息')
        return `“${preview.length > 22 ? `${preview.slice(0, 22)}...` : preview || '这条消息'}”`
    }

    const resolveForwardTargetConversationId = async (target: ForwardTargetOption) => {
        if (target.conversationId) {
            return target.conversationId
        }
        if (target.targetType !== 'friend' || !target.userId) {
            throw new Error('无法识别转发目标')
        }
        const { data } = await openDirectConversationApi(target.userId)
        await Promise.all([options.chatStore.conversation.loadConversations(), options.chatStore.friendship.loadFriends()])
        return data.conversation.id
    }

    const confirmForwardSelection = (target: ForwardTargetOption) => {
        return new Promise<boolean>((resolve) => {
            let settled = false
            Modal.confirm({
                title: '确认转发',
                content: `是否将${buildForwardMessageSummary()}发送给${target.name}${target.targetType === 'friend' ? '用户' : ''}`,
                okText: '确认',
                cancelText: '取消',
                onOk: () => {
                    settled = true
                    resolve(true)
                },
                onCancel: () => {
                    settled = true
                    resolve(false)
                },
                afterClose: () => {
                    if (!settled) {
                        resolve(false)
                    }
                },
            })
        })
    }

    const submitForward = async (target: ForwardTargetOption, forwardMode: 'separate' | 'merged') => {
        forwarding.value = true
        forwardModalOpen.value = false
        forwardModeModalOpen.value = false
        try {
            const targetConversationId = await resolveForwardTargetConversationId(target)
            await forwardMessagesApi({
                target_conversation_id: targetConversationId,
                message_ids: forwardingMessageIds.value,
                forward_mode: forwardMode,
            })
            persistRecentForwardTarget(target.key)
            selectedForwardTargetKey.value = ''
            selectedForwardMode.value = null
            forwardingMessageIds.value = []
            pendingForwardTarget.value = null
            options.clearMessageSelection()
            options.closeMessageMenu()
            message.success('转发成功')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '转发失败'))
        } finally {
            forwarding.value = false
        }
    }

    const buildForwardConversationTarget = (conversation: ChatConversationItem): ForwardTargetOption => ({
        key: `conversation:${conversation.id}`,
        targetType: 'conversation',
        conversationId: conversation.id,
        userId: conversation.direct_target?.id || null,
        name: conversation.name,
        avatar: conversation.avatar || conversation.direct_target?.avatar || '',
        description: conversation.last_message_preview || (conversation.type === 'group' ? '群聊' : '私聊'),
        searchText: `${conversation.name} ${conversation.last_message_preview || ''} ${conversation.direct_target?.display_name || ''} ${conversation.direct_target?.username || ''}`.toLowerCase(),
        sortTime: conversation.last_message_at || '',
    })

    const buildForwardFriendTarget = (friend: ChatFriendshipItem): ForwardTargetOption => ({
        key: `friend:${friend.friend_user.id}`,
        targetType: 'friend',
        conversationId: friend.direct_conversation?.id || null,
        userId: friend.friend_user.id,
        name: friend.remark || friend.friend_user.display_name || friend.friend_user.username,
        avatar: friend.friend_user.avatar || '',
        description: friend.friend_user.username,
        searchText: `${friend.remark || ''} ${friend.friend_user.display_name || ''} ${friend.friend_user.username || ''}`.toLowerCase(),
        sortTime: friend.accepted_at || '',
    })

    const allForwardTargets = computed<ForwardTargetOption[]>(() => {
        const targetMap = new Map<string, ForwardTargetOption>()
        for (const conversation of options.chatStore.state.conversationState.conversations) {
            if (conversation.access_mode !== 'member' || !conversation.can_send_message) {
                continue
            }
            const target = buildForwardConversationTarget(conversation)
            targetMap.set(target.key, target)
        }
        for (const friend of options.chatStore.state.friendshipState.friends) {
            const target = buildForwardFriendTarget(friend)
            if (target.conversationId) {
                const existingKey = `conversation:${target.conversationId}`
                if (targetMap.has(existingKey)) {
                    continue
                }
            }
            targetMap.set(target.key, target)
        }
        return Array.from(targetMap.values()).sort((left, right) => {
            if (left.sortTime === right.sortTime) {
                return left.name.localeCompare(right.name, 'zh-CN')
            }
            return right.sortTime.localeCompare(left.sortTime)
        })
    })

    const recentForwardTargets = computed(() => recentForwardTargetKeys.value.map((key) => allForwardTargets.value.find((item) => item.key === key)).filter(Boolean) as ForwardTargetOption[])

    const filteredForwardTargets = computed(() => {
        const keyword = forwardSearchKeyword.value.trim().toLowerCase()
        if (!keyword) {
            return allForwardTargets.value
        }
        return allForwardTargets.value.filter((item) => item.searchText.includes(keyword))
    })

    const openForwardModal = async () => {
        try {
            await Promise.all([options.chatStore.conversation.loadConversations(), options.chatStore.friendship.loadFriends()])
            recentForwardTargetKeys.value = loadRecentForwardTargetKeys().filter((key) => allForwardTargets.value.some((item) => item.key === key))
            forwardSearchKeyword.value = ''
            selectedForwardTargetKey.value = ''
            forwardModalOpen.value = true
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '加载转发目标失败'))
        }
    }

    const handleSelectForwardTarget = async (target: ForwardTargetOption) => {
        if (!forwardingMessageIds.value.length || forwarding.value) {
            return
        }
        selectedForwardTargetKey.value = target.key
        if (forwardingMessageIds.value.length > 1) {
            pendingForwardTarget.value = target
            forwardModalOpen.value = false
            forwardModeModalOpen.value = true
            return
        }
        const confirmed = await confirmForwardSelection(target)
        if (!confirmed) {
            return
        }
        await submitForward(target, 'separate')
    }

    const handleConfirmForwardMode = (forwardMode: 'separate' | 'merged') => {
        if (forwarding.value) {
            return
        }
        selectedForwardMode.value = forwardMode
        forwardModeModalOpen.value = false
        const target = pendingForwardTarget.value
        if (!target) {
            void openForwardModal()
            return
        }
        void submitForward(target, forwardMode)
    }

    const beginForwardSelection = (messageIds: number[]) => {
        forwardingMessageIds.value = [...messageIds]
        selectedForwardTargetKey.value = ''
        pendingForwardTarget.value = null
        selectedForwardMode.value = null
        void openForwardModal()
    }

    const resetForwardingState = () => {
        forwardModalOpen.value = false
        forwardModeModalOpen.value = false
        forwardingMessageIds.value = []
        pendingForwardTarget.value = null
        selectedForwardMode.value = null
        forwardSearchKeyword.value = ''
        selectedForwardTargetKey.value = ''
    }

    return {
        forwardModalOpen,
        forwardModeModalOpen,
        forwardSearchKeyword,
        selectedForwardTargetKey,
        forwarding,
        forwardingMessageIds,
        pendingForwardTarget,
        recentForwardTargets,
        filteredForwardTargets,
        buildForwardMessageSummary,
        beginForwardSelection,
        handleSelectForwardTarget,
        handleConfirmForwardMode,
        resetForwardingState,
    }
}