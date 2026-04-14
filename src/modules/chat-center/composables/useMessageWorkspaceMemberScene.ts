import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import { message } from 'ant-design-vue'
import type { Router } from 'vue-router'
import type { ChatConversationMemberItem } from '@/types/chat'
import { getErrorMessage } from '@/utils/error'

type FriendCandidate = {
    friend_user: {
        id: number
        username: string
        display_name?: string | null
        avatar?: string | null
    }
    remark?: string | null
}

type MemberSceneOptions = {
    router: Router
    currentUserId: Ref<number | undefined>
    chatConversationState: {
        activeConversationId: number | null
        activeConversation: {
            id: number
            name: string
            type: string
        } | null
    }
    chatGroupState: {
        activeMembers: ChatConversationMemberItem[]
    }
    availableInviteFriends: ComputedRef<FriendCandidate[]>
    canManageMembers: ComputedRef<boolean>
    canEditRoles: ComputedRef<boolean>
    canInviteGroupMembers: ComputedRef<boolean>
    canManageGroupPermission: ComputedRef<boolean>
    chatFriendship: {
        loadFriends: () => Promise<void>
    }
    chatGroup: {
        inviteMember: (conversationId: number, userId: number) => Promise<void>
        removeMember: (conversationId: number, userId: number) => Promise<void>
        updateMemberRole: (conversationId: number, userId: number, role: 'admin' | 'member') => Promise<void>
        muteMember: (conversationId: number, userId: number, muteMinutes: number, reason?: string) => Promise<void>
        loadMembers: (conversationId: number) => Promise<void>
        transferOwner: (conversationId: number, userId: number) => Promise<void>
        disbandConversation: (conversationId: number) => Promise<void>
        handleJoinRequest: (requestId: number, action: 'approve' | 'reject', conversationId: number) => Promise<void>
    }
    chatConversation: {
        openDirectConversation: (userId: number) => Promise<void>
    }
    directSourceContext: Ref<{ userId: number; groupName: string } | null>
    groupDrawerOpen: Ref<boolean>
    confirmAction: (options: { title: string; content: string; okText?: string; danger?: boolean }) => Promise<boolean>
}

export function useMessageWorkspaceMemberScene(options: MemberSceneOptions) {
    const memberModalOpen = ref(false)
    const inviteModalOpen = ref(false)
    const selectedInviteUserIds = ref<number[]>([])
    const memberSearchKeyword = ref('')
    const inviteSearchKeyword = ref('')
    const memberSearchTerm = ref('')
    const inviteSearchTerm = ref('')

    let memberSearchTimer: ReturnType<typeof setTimeout> | null = null
    let inviteSearchTimer: ReturnType<typeof setTimeout> | null = null

    const previewMembers = computed(() => options.chatGroupState.activeMembers.slice(0, 8))

    const buildMemberSearchText = (member: ChatConversationMemberItem) => {
        return `${member.group_nickname || ''} ${member.friend_remark || ''} ${member.user.display_name || ''} ${member.user.username || ''}`.toLowerCase()
    }

    const buildFriendSearchText = (friend: FriendCandidate) => {
        return `${friend.remark || ''} ${friend.friend_user.display_name || ''} ${friend.friend_user.username || ''}`.toLowerCase()
    }

    const filteredGroupMembers = computed(() => {
        const keyword = memberSearchTerm.value.trim().toLowerCase()
        if (!keyword) {
            return options.chatGroupState.activeMembers
        }
        return options.chatGroupState.activeMembers.filter((member) => buildMemberSearchText(member).includes(keyword))
    })

    const filteredAvailableInviteFriends = computed(() => {
        const keyword = inviteSearchTerm.value.trim().toLowerCase()
        if (!keyword) {
            return options.availableInviteFriends.value
        }
        return options.availableInviteFriends.value.filter((friend) => buildFriendSearchText(friend).includes(keyword))
    })

    const memberRoleLabel = (role: ChatConversationMemberItem['role']) => {
        if (role === 'owner') {
            return '群主'
        }
        if (role === 'admin') {
            return '管理员'
        }
        return '成员'
    }

    const memberDisplayName = (member: ChatConversationMemberItem) =>
        member.friend_remark || member.group_nickname || member.user.display_name || member.user.username

    const memberRemarkHint = (member: ChatConversationMemberItem) => {
        if (member.friend_remark && member.group_nickname) {
            return `群昵称：${member.group_nickname}`
        }
        if (member.friend_remark) {
            return member.user.display_name || member.user.username
        }
        return ''
    }

    const isMuteActive = (member: ChatConversationMemberItem) => Boolean(member.mute_until && new Date(member.mute_until).getTime() > Date.now())

    const showMemberActionMenu = (member: ChatConversationMemberItem) => {
        if (member.role === 'owner') {
            return false
        }
        return options.canManageMembers.value || options.canEditRoles.value
    }

    const scheduleSearchSync = (keyword: string, assign: (value: string) => void, timerKey: 'member' | 'invite') => {
        const normalized = keyword.trim()
        const currentTimer = timerKey === 'member' ? memberSearchTimer : inviteSearchTimer
        if (currentTimer) {
            clearTimeout(currentTimer)
        }
        const nextTimer = setTimeout(() => {
            assign(normalized)
            if (timerKey === 'member') {
                memberSearchTimer = null
                return
            }
            inviteSearchTimer = null
        }, 220)
        if (timerKey === 'member') {
            memberSearchTimer = nextTimer
            return
        }
        inviteSearchTimer = nextTimer
    }

    const openMemberModal = () => {
        memberSearchKeyword.value = ''
        memberSearchTerm.value = ''
        memberModalOpen.value = true
    }

    const openInviteModal = async () => {
        if (!options.canInviteGroupMembers.value) {
            message.warning('当前角色不能邀请成员')
            return
        }
        if (!options.chatConversationState.activeConversationId) {
            return
        }
        try {
            await options.chatFriendship.loadFriends()
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '加载好友列表失败'))
            return
        }
        inviteSearchKeyword.value = ''
        inviteSearchTerm.value = ''
        selectedInviteUserIds.value = []
        inviteModalOpen.value = true
    }

    const toggleInviteUser = (userId: number) => {
        selectedInviteUserIds.value = selectedInviteUserIds.value.includes(userId)
            ? selectedInviteUserIds.value.filter((item) => item !== userId)
            : [...selectedInviteUserIds.value, userId]
    }

    const handleInviteMembers = async () => {
        if (!options.canInviteGroupMembers.value) {
            message.warning('当前角色不能邀请成员')
            return
        }
        if (!options.chatConversationState.activeConversationId || !selectedInviteUserIds.value.length) {
            return
        }
        try {
            for (const userId of selectedInviteUserIds.value) {
                await options.chatGroup.inviteMember(options.chatConversationState.activeConversationId, userId)
            }
            const invitedCount = selectedInviteUserIds.value.length
            selectedInviteUserIds.value = []
            inviteModalOpen.value = false
            message.success(invitedCount === 1 ? '邀请消息已发送' : `已发送 ${invitedCount} 条邀请消息`)
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '添加成员失败'))
        }
    }

    const handleRemoveMember = async (userId: number) => {
        if (!options.canManageMembers.value) {
            message.warning('当前角色无成员管理权限')
            return
        }
        if (!options.chatConversationState.activeConversationId) {
            return
        }
        try {
            await options.chatGroup.removeMember(options.chatConversationState.activeConversationId, userId)
            message.success('成员已移除')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '移除成员失败'))
        }
    }

    const handleToggleMemberRole = async (userId: number, role: 'admin' | 'member') => {
        if (!options.canEditRoles.value) {
            message.warning('当前角色无成员角色管理权限')
            return
        }
        if (!options.chatConversationState.activeConversationId) {
            return
        }
        try {
            await options.chatGroup.updateMemberRole(options.chatConversationState.activeConversationId, userId, role)
            message.success('成员角色已更新')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '更新成员角色失败'))
        }
    }

    const formatMuteMinutesLabel = (muteMinutes: number) => {
        if (muteMinutes % (60 * 24) === 0) {
            return `${muteMinutes / (60 * 24)} 天`
        }
        if (muteMinutes % 60 === 0) {
            return `${muteMinutes / 60} 小时`
        }
        return `${muteMinutes} 分钟`
    }

    const handleMuteMember = async (userId: number, muteMinutes = 10) => {
        if (!options.canManageMembers.value) {
            message.warning('当前角色无成员管理权限')
            return
        }
        if (!options.chatConversationState.activeConversationId) {
            return
        }
        try {
            await options.chatGroup.muteMember(
                options.chatConversationState.activeConversationId,
                userId,
                muteMinutes,
                muteMinutes > 0 ? '前端快捷禁言' : '解除禁言',
            )
            await options.chatGroup.loadMembers(options.chatConversationState.activeConversationId)
            message.success(muteMinutes > 0 ? `已禁言 ${formatMuteMinutesLabel(muteMinutes)}` : '已解除禁言')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, muteMinutes > 0 ? '禁言成员失败' : '解除禁言失败'))
        }
    }

    const handleMemberActionMenuClick = async (member: ChatConversationMemberItem, event: { key: string }) => {
        if (!options.chatConversationState.activeConversationId) {
            return
        }
        if (event.key.startsWith('mute:')) {
            const muteMinutes = Number(event.key.split(':')[1] || 0)
            if (muteMinutes > 0) {
                await handleMuteMember(member.user.id, muteMinutes)
            }
            return
        }
        if (event.key === 'unmute') {
            await handleMuteMember(member.user.id, 0)
            return
        }
        if (event.key === 'toggle-role') {
            await handleToggleMemberRole(member.user.id, member.role === 'admin' ? 'member' : 'admin')
            return
        }
        if (event.key === 'transfer-owner') {
            const confirmed = await options.confirmAction({
                title: '确认转让群主',
                content: `确认将群主转让给 ${memberDisplayName(member)}？`,
                okText: '确认转让',
                danger: true,
            })
            if (!confirmed) {
                return
            }
            try {
                await options.chatGroup.transferOwner(options.chatConversationState.activeConversationId, member.user.id)
                message.success('群主已转让')
            } catch (error: unknown) {
                message.error(getErrorMessage(error, '转让群主失败'))
            }
            return
        }
        if (event.key === 'remove') {
            const confirmed = await options.confirmAction({
                title: '确认移出成员',
                content: `确认将 ${memberDisplayName(member)} 移出当前群聊？`,
                okText: '确认移出',
                danger: true,
            })
            if (!confirmed) {
                return
            }
            await handleRemoveMember(member.user.id)
        }
    }

    const handleMemberDoubleClick = async (member: ChatConversationMemberItem) => {
        if (member.user.id === options.currentUserId.value) {
            return
        }
        try {
            const sourceGroupName = options.chatConversationState.activeConversation?.type === 'group'
                ? options.chatConversationState.activeConversation.name
                : ''
            await options.chatConversation.openDirectConversation(member.user.id)
            options.directSourceContext.value = sourceGroupName
                ? { userId: member.user.id, groupName: sourceGroupName }
                : null
            memberModalOpen.value = false
            options.groupDrawerOpen.value = false
            await options.router.push({ name: 'ChatMessages' })
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '发起私聊失败'))
        }
    }

    const handleDisbandConversation = async () => {
        const conversationId = options.chatConversationState.activeConversationId
        if (!conversationId || !options.canManageGroupPermission.value) {
            return
        }
        const confirmed = await options.confirmAction({
            title: '确认解散群聊',
            content: '确认解散当前群聊？该操作不可撤销。',
            okText: '确认解散',
            danger: true,
        })
        if (!confirmed) {
            return
        }
        try {
            await options.chatGroup.disbandConversation(conversationId)
            memberModalOpen.value = false
            options.groupDrawerOpen.value = false
            message.success('群聊已解散')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '解散群聊失败'))
        }
    }

    const handleJoinRequestAction = async (requestId: number, action: 'approve' | 'reject') => {
        if (!options.chatConversationState.activeConversationId) {
            return
        }
        try {
            await options.chatGroup.handleJoinRequest(requestId, action, options.chatConversationState.activeConversationId)
            message.success('审批已处理')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '处理审批失败'))
        }
    }

    const resetMemberManagementState = () => {
        memberModalOpen.value = false
        inviteModalOpen.value = false
        memberSearchKeyword.value = ''
        inviteSearchKeyword.value = ''
        memberSearchTerm.value = ''
        inviteSearchTerm.value = ''
        selectedInviteUserIds.value = []
    }

    watch(memberSearchKeyword, (value) => {
        scheduleSearchSync(value, (nextValue) => {
            memberSearchTerm.value = nextValue
        }, 'member')
    })

    watch(inviteSearchKeyword, (value) => {
        scheduleSearchSync(value, (nextValue) => {
            inviteSearchTerm.value = nextValue
        }, 'invite')
    })

    onBeforeUnmount(() => {
        if (memberSearchTimer) {
            clearTimeout(memberSearchTimer)
            memberSearchTimer = null
        }
        if (inviteSearchTimer) {
            clearTimeout(inviteSearchTimer)
            inviteSearchTimer = null
        }
    })

    return {
        memberModalOpen,
        inviteModalOpen,
        selectedInviteUserIds,
        memberSearchKeyword,
        inviteSearchKeyword,
        memberSearchTerm,
        inviteSearchTerm,
        previewMembers,
        filteredGroupMembers,
        filteredAvailableInviteFriends,
        memberRoleLabel,
        memberDisplayName,
        memberRemarkHint,
        isMuteActive,
        showMemberActionMenu,
        openMemberModal,
        openInviteModal,
        toggleInviteUser,
        handleInviteMembers,
        handleRemoveMember,
        handleToggleMemberRole,
        handleMuteMember,
        formatMuteMinutesLabel,
        handleMemberActionMenuClick,
        handleMemberDoubleClick,
        handleDisbandConversation,
        handleJoinRequestAction,
        resetMemberManagementState,
    }
}