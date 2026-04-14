import { message } from 'ant-design-vue'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { applyGroupInvitationApi, searchChatApi } from '@/api/chat'
import { useChatCapabilityScene } from '@/modules/chat-center/composables/useChatCapabilityScene'
import type { ChatConversationItem, ChatSearchConversationItem, ChatSearchResult } from '@/types/chat'
import { getErrorMessage } from '@/utils/error'
import { useChatShell } from '@/views/Chat/useChatShell'

type TopMatchItem = {
    key: string
    label: string
    meta: string
    kind: 'conversation' | 'user'
    id: number
}

export function useConversationListScene() {
    const route = useRoute()
    const router = useRouter()
    const {
        avatarStyle,
        avatarText,
        chatStore,
        formatShortTime,
        isStealthAuditEnabled,
    } = useChatShell()
    const {
        canAddFriend,
        canCreateGroup,
        canHideConversation,
        canPinConversation,
    } = useChatCapabilityScene()
    const chatConversationState = chatStore.state.conversationState
    const chatFriendshipState = chatStore.state.friendshipState
    const chatConversation = chatStore.conversation
    const chatFriendship = chatStore.friendship
    const chatAudit = chatStore.audit

    const searchKeyword = ref('')
    const friendRequestMessage = ref('')
    const groupModalOpen = ref(false)
    const groupSaving = ref(false)
    const allResultModalOpen = ref(false)
    const activeResultTab = ref('conversations')
    const searchFocused = ref(false)
    const contextMenuOpen = ref(false)
    const contextConversation = ref<ChatConversationItem | null>(null)
    const contextMenuPosition = ref({ x: 0, y: 0 })
    const discoverModalOpen = ref(false)
    const discoverKeyword = ref('')
    const discoverTab = ref('users')
    const discoverResult = ref<ChatSearchResult | null>(null)
    const searchTimer = ref<ReturnType<typeof setTimeout> | null>(null)
    const discoverTimer = ref<ReturnType<typeof setTimeout> | null>(null)

    const CHAT_MODAL_WIDTH_SM = 427
    const CHAT_MODAL_WIDTH_MD = 480
    const tallModalBodyStyle = {
        minHeight: '54vh',
        maxHeight: '72vh',
        overflowY: 'auto' as const,
    }

    const badgeStyle = {
        backgroundColor: '#ef4444',
        boxShadow: 'none',
        minWidth: '16px',
        height: '16px',
        paddingInline: '4px',
        fontSize: '10px',
        lineHeight: '16px',
    }

    const mutedBadgeStyle = {
        ...badgeStyle,
        backgroundColor: '#94a3b8',
    }

    const groupForm = reactive({
        name: '',
        member_user_ids: [] as number[],
        join_approval_required: true,
        allow_member_invite: true,
    })

    const showQuickActionTrigger = computed(() => canCreateGroup.value || canAddFriend.value)
    const friendOptions = computed(() =>
        chatFriendshipState.friends.map((item) => ({
            label: `${item.friend_user.display_name || item.friend_user.username} (${item.friend_user.username})`,
            value: item.friend_user.id,
        })),
    )
    const friendIds = computed(() => new Set(chatFriendshipState.friends.map((item) => item.friend_user.id)))
    const topUserMatches = computed<TopMatchItem[]>(() => {
        return (chatAudit.searchResult?.users || [])
            .map((item) => ({
                key: `user-${item.id}`,
                label: item.display_name || item.username,
                meta: friendIds.value.has(item.id) ? '好友' : '用户',
                kind: 'user' as const,
                id: item.id,
            }))
            .slice(0, 3)
    })
    const recentMessageMatches = computed(() => (chatAudit.searchResult?.messages || []).slice(0, 3))
    const matchedGroups = computed(() => (chatAudit.searchResult?.conversations || []).filter((item) => item.type === 'group'))
    const searchDropdownVisible = computed(
        () => searchFocused.value && Boolean(searchKeyword.value.trim()) && (topUserMatches.value.length > 0 || recentMessageMatches.value.length > 0),
    )
    const contextMenuStyle = computed(() => ({
        left: `${contextMenuPosition.value.x}px`,
        top: `${contextMenuPosition.value.y}px`,
    }))
    const discoverUsers = computed(() => discoverResult.value?.users || [])
    const discoverGroups = computed(() => (discoverResult.value?.conversations || []).filter((item) => item.type === 'group'))
    const joinedGroupConversationIds = computed(
        () =>
            new Set(
                [...chatConversationState.conversations, ...chatConversationState.contactGroupConversations]
                    .filter((item) => item.type === 'group' && item.access_mode === 'member')
                    .map((item) => item.id),
            ),
    )

    const conversationDisplayName = (conversation: ChatConversationItem) => conversation.friend_remark || conversation.name

    const getVisibleUnreadCount = (conversation: ChatConversationItem) => {
        if (route.name === 'ChatMessages' && chatConversationState.activeConversationId === conversation.id) {
            return 0
        }
        return conversation.unread_count
    }

    const getUnreadBadgeStyle = (conversation: ChatConversationItem) => (conversation.member_settings?.mute_notifications ? mutedBadgeStyle : badgeStyle)

    const closeContextMenu = () => {
        contextMenuOpen.value = false
        contextConversation.value = null
    }

    const handleDocumentClick = () => {
        closeContextMenu()
    }

    const triggerSearch = async (keyword: string) => {
        if (!keyword.trim()) {
            chatAudit.clearSearchResult()
            return
        }
        try {
            await chatAudit.runSearch(keyword.trim(), isStealthAuditEnabled.value ? 'audit' : 'connected')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '搜索失败'))
        }
    }

    const triggerDiscoverSearch = async (keyword: string) => {
        if (!keyword.trim()) {
            discoverResult.value = null
            return
        }
        try {
            const { data } = await searchChatApi({
                keyword: keyword.trim(),
                limit: 20,
                scope: 'discover',
            })
            discoverResult.value = data
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '搜索失败'))
        }
    }

    const openConversation = async (conversationId: number, focusSequence?: number) => {
        searchFocused.value = false
        discoverModalOpen.value = false
        await chatConversation.selectConversation(conversationId, focusSequence ? { focusSequence } : undefined)
        if (route.name !== 'ChatMessages') {
            await router.push({ name: 'ChatMessages' })
        }
        allResultModalOpen.value = false
        closeContextMenu()
    }

    const canOpenGroupConversation = (conversation: ChatConversationItem | ChatSearchConversationItem) => {
        const capabilityOpen = conversation.capabilities?.can_open
        if (typeof capabilityOpen === 'boolean') {
            return capabilityOpen
        }
        return conversation.access_mode === 'member' || joinedGroupConversationIds.value.has(conversation.id)
    }

    const canJoinGroupConversation = (conversation: ChatConversationItem | ChatSearchConversationItem) => {
        if (typeof conversation.capabilities?.can_join === 'boolean') {
            return conversation.capabilities.can_join
        }
        return !canOpenGroupConversation(conversation)
    }

    const getGroupSearchActionLabel = (conversation: ChatConversationItem | ChatSearchConversationItem) => (canOpenGroupConversation(conversation) ? '打开' : canJoinGroupConversation(conversation) ? '申请加入' : '打开')

    const getConversationSearchActionLabel = (conversation: ChatConversationItem | ChatSearchConversationItem) => (conversation.type === 'group' ? getGroupSearchActionLabel(conversation) : '打开')

    const handleApplyGroupConversation = async (conversationId: number) => {
        try {
            const { data } = await applyGroupInvitationApi({
                conversation_id: conversationId,
            })
            await Promise.all([
                chatConversation.loadConversations(),
                chatConversation.loadContactGroupConversations(),
            ])
            if (data.mode === 'joined' && data.conversation?.id) {
                await chatConversation.selectConversation(data.conversation.id)
                await router.push({ name: 'ChatMessages' })
                allResultModalOpen.value = false
                discoverModalOpen.value = false
            }
            message.success(data.detail || '申请已提交')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '申请入群失败'))
        }
    }

    const handleGroupSearchAction = async (conversation: ChatConversationItem | ChatSearchConversationItem) => {
        if (canOpenGroupConversation(conversation)) {
            await openConversation(conversation.id)
            return
        }
        await handleApplyGroupConversation(conversation.id)
    }

    const handleConversationSearchAction = async (conversation: ChatConversationItem | ChatSearchConversationItem) => {
        if (conversation.type === 'group') {
            await handleGroupSearchAction(conversation)
            return
        }
        await openConversation(conversation.id)
    }

    const openDirectConversation = async (userId: number) => {
        try {
            const directConversationId =
                chatAudit.searchResult?.users.find((item) => item.id === userId)?.direct_conversation?.id ||
                chatFriendshipState.friends.find((item) => item.friend_user.id === userId)?.direct_conversation?.id
            if (directConversationId) {
                await chatConversation.selectConversation(directConversationId)
            } else {
                await chatConversation.openDirectConversation(userId)
            }
            await router.push({ name: 'ChatMessages' })
            allResultModalOpen.value = false
            discoverModalOpen.value = false
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '打开私聊失败'))
        }
    }

    const openDiscoverModal = () => {
        discoverModalOpen.value = true
        discoverTab.value = 'users'
    }

    const handleQuickMenuClick = ({ key }: { key: string }) => {
        if (key === 'group') {
            void openGroupModal()
            return
        }
        if (key === 'discover') {
            openDiscoverModal()
        }
    }

    const handleTopMatchClick = async (item: TopMatchItem) => {
        if (item.kind === 'conversation') {
            await openConversation(item.id)
            return
        }
        await openDirectConversation(item.id)
    }

    const handleSendFriendRequest = async (userId: number) => {
        try {
            await chatFriendship.submitFriendRequest(userId, friendRequestMessage.value.trim() || undefined)
            message.success('好友申请已发送')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '发送好友申请失败'))
        }
    }

    const handleSearchBlur = () => {
        setTimeout(() => {
            searchFocused.value = false
        }, 120)
    }

    const openGroupModal = async () => {
        groupModalOpen.value = true
        try {
            await chatFriendship.loadFriends()
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '加载好友数据失败'))
        }
    }

    const handleCreateGroup = async () => {
        if (!groupForm.name.trim()) {
            message.warning('请输入群名称')
            return
        }
        groupSaving.value = true
        try {
            await chatConversation.createGroupConversation({
                name: groupForm.name.trim(),
                member_user_ids: groupForm.member_user_ids,
                join_approval_required: groupForm.join_approval_required,
                allow_member_invite: groupForm.allow_member_invite,
            })
            groupModalOpen.value = false
            groupForm.name = ''
            groupForm.member_user_ids = []
            message.success('群聊创建成功')
            await router.push({ name: 'ChatMessages' })
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '创建群聊失败'))
        } finally {
            groupSaving.value = false
        }
    }

    const openConversationMenu = (event: MouseEvent, conversation: ChatConversationItem) => {
        contextConversation.value = conversation
        contextMenuPosition.value = { x: event.clientX, y: event.clientY }
        contextMenuOpen.value = true
    }

    const handleHideConversation = async () => {
        if (!contextConversation.value) {
            return
        }
        try {
            await chatConversation.hideConversation(contextConversation.value.id)
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '删除会话失败'))
        } finally {
            closeContextMenu()
        }
    }

    const handleTogglePin = async () => {
        if (!contextConversation.value) {
            return
        }
        try {
            await chatConversation.toggleConversationPin(contextConversation.value.id, !contextConversation.value.is_pinned)
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '更新置顶状态失败'))
        } finally {
            closeContextMenu()
        }
    }

    watch(
        () => searchKeyword.value,
        (keyword) => {
            if (searchTimer.value) {
                clearTimeout(searchTimer.value)
                searchTimer.value = null
            }
            searchTimer.value = setTimeout(() => {
                void triggerSearch(keyword)
            }, 220)
        },
    )

    watch(
        () => discoverKeyword.value,
        (keyword) => {
            if (discoverTimer.value) {
                clearTimeout(discoverTimer.value)
                discoverTimer.value = null
            }
            discoverTimer.value = setTimeout(() => {
                void triggerDiscoverSearch(keyword)
            }, 220)
        },
    )

    onMounted(() => {
        document.addEventListener('click', handleDocumentClick)
        document.addEventListener('scroll', handleDocumentClick, true)
    })

    onBeforeUnmount(() => {
        document.removeEventListener('click', handleDocumentClick)
        document.removeEventListener('scroll', handleDocumentClick, true)
        if (searchTimer.value) {
            clearTimeout(searchTimer.value)
        }
        if (discoverTimer.value) {
            clearTimeout(discoverTimer.value)
        }
    })

    return {
        CHAT_MODAL_WIDTH_MD,
        CHAT_MODAL_WIDTH_SM,
        activeResultTab,
        allResultModalOpen,
        avatarStyle,
        avatarText,
        canAddFriend,
        canCreateGroup,
        canHideConversation,
        canPinConversation,
        chatAudit,
        chatConversationState,
        contextConversation,
        contextMenuOpen,
        contextMenuStyle,
        conversationDisplayName,
        discoverGroups,
        discoverKeyword,
        discoverModalOpen,
        discoverTab,
        discoverUsers,
        formatShortTime,
        friendOptions,
        getConversationSearchActionLabel,
        getGroupSearchActionLabel,
        getUnreadBadgeStyle,
        getVisibleUnreadCount,
        groupForm,
        groupModalOpen,
        groupSaving,
        handleConversationSearchAction,
        handleCreateGroup,
        handleGroupSearchAction,
        handleHideConversation,
        handleQuickMenuClick,
        handleSearchBlur,
        handleSendFriendRequest,
        handleTogglePin,
        handleTopMatchClick,
        matchedGroups,
        openConversation,
        openConversationMenu,
        openDirectConversation,
        recentMessageMatches,
        searchDropdownVisible,
        searchFocused,
        searchKeyword,
        showQuickActionTrigger,
        tallModalBodyStyle,
        topUserMatches,
    }
}