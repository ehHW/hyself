import { message } from 'ant-design-vue'
import type { UploadProps } from 'ant-design-vue'
import { nextTick, onBeforeUnmount, reactive, ref, watch, type ComputedRef } from 'vue'
import { uploadFileWithCategory } from '@/utils/fileUploader'
import { getErrorMessage } from '@/utils/error'
import { trimText, validateAvatarFile } from '@/validators/common'

type InputFocusTarget = {
    focus: (options?: { cursor?: 'start' | 'end' | 'all' }) => void
}

type SettingsSceneOptions = {
    authAccessToken: ComputedRef<string | undefined>
    chatConversationState: {
        activeConversationId: number | null
        activeConversation: {
            id: number
            name: string
            type: string
            avatar?: string | null
            access_mode?: string
            group_config?: {
                join_approval_required?: boolean
                allow_member_invite?: boolean
                mute_all?: boolean
                max_members?: number | null
            } | null
            member_settings?: {
                mute_notifications?: boolean
                group_nickname?: string | null
            } | null
            is_pinned?: boolean
        } | null
    }
    chatGroup: {
        loadMembers: (conversationId: number) => Promise<void>
        leaveConversation: (conversationId: number) => Promise<void>
    }
    chatFriendship: {
        loadFriends: () => Promise<void>
        updateFriendRemark: (friendUserId: number, remark: string) => Promise<void>
        submitFriendRequest: (targetUserId: number) => Promise<void>
        removeFriend: (friendUserId: number) => Promise<void>
    }
    chatConversation: {
        updateGroupConfig: (conversationId: number, payload: Record<string, unknown>) => Promise<unknown>
        toggleConversationPin: (conversationId: number, isPinned: boolean) => Promise<unknown>
        updateConversationPreferences: (conversationId: number, payload: Record<string, unknown>) => Promise<unknown>
    }
    currentFriendship: ComputedRef<{ friend_user: { id: number }; remark?: string | null } | null>
    directTargetUser: ComputedRef<{ id: number } | null>
    directConversationTitle: ComputedRef<string>
    canManageGroupPermission: ComputedRef<boolean>
    canPinConversationPermission: ComputedRef<boolean>
    canDeleteFriend: ComputedRef<boolean>
    canAddFriend: ComputedRef<boolean>
    formatDateTime: (value: string) => string
    confirmAction: (options: { title: string; content: string; okText?: string; danger?: boolean }) => Promise<boolean>
    onCloseDrawerAfterLeave?: () => Promise<void> | void
}

export function useMessageWorkspaceSettingsScene(options: SettingsSceneOptions) {
    const groupDrawerOpen = ref(false)
    const groupConfigSaving = ref(false)
    const groupAvatarUploading = ref(false)
    const groupNameEditing = ref(false)
    const groupNicknameEditing = ref(false)
    const directRemarkEditing = ref(false)
    const groupNameInputRef = ref<InputFocusTarget | null>(null)
    const groupNicknameInputRef = ref<InputFocusTarget | null>(null)
    const directRemarkInputRef = ref<InputFocusTarget | null>(null)
    const skipNextGroupNameBlur = ref(false)
    const skipNextGroupNicknameBlur = ref(false)
    const skipNextDirectRemarkBlur = ref(false)
    const friendRemarkSaving = ref(false)
    const groupNicknameSaving = ref(false)
    const muteNotifications = ref(false)
    const pinnedConversation = ref(false)
    const groupNicknameInput = ref('')
    const directRemark = ref('')
    const avatarCropOpen = ref(false)
    const avatarCropImageUrl = ref('')

    let avatarTempObjectUrl = ''

    const groupConfigForm = reactive({
        name: '',
        avatar: '',
        join_approval_required: true,
        allow_member_invite: true,
        mute_all: false,
        max_members: null as number | null,
    })

    const syncGroupConfigForm = () => {
        const config = options.chatConversationState.activeConversation?.group_config
        groupNameEditing.value = false
        groupConfigForm.name = options.chatConversationState.activeConversation?.name || ''
        groupConfigForm.avatar = options.chatConversationState.activeConversation?.avatar || ''
        groupConfigForm.join_approval_required = config?.join_approval_required ?? true
        groupConfigForm.allow_member_invite = config?.allow_member_invite ?? true
        groupConfigForm.mute_all = config?.mute_all ?? false
        groupConfigForm.max_members = config?.max_members ?? null
    }

    const syncPreferenceForm = () => {
        muteNotifications.value = options.chatConversationState.activeConversation?.member_settings?.mute_notifications ?? false
        pinnedConversation.value = options.chatConversationState.activeConversation?.is_pinned ?? false
        groupNicknameInput.value = options.chatConversationState.activeConversation?.member_settings?.group_nickname || ''
        directRemark.value = options.currentFriendship.value?.remark || ''
        directRemarkEditing.value = false
    }

    const clearCropState = () => {
        avatarCropOpen.value = false
        avatarCropImageUrl.value = ''
        if (avatarTempObjectUrl) {
            URL.revokeObjectURL(avatarTempObjectUrl)
            avatarTempObjectUrl = ''
        }
    }

    const focusEditableInput = async (target: InputFocusTarget | null) => {
        await nextTick()
        target?.focus({ cursor: 'all' })
    }

    const openSettingsDrawer = async () => {
        if (!options.chatConversationState.activeConversationId) {
            return
        }
        groupDrawerOpen.value = true
        try {
            if (options.chatConversationState.activeConversation?.type === 'group' && options.chatConversationState.activeConversation.access_mode === 'member') {
                await Promise.all([
                    options.chatGroup.loadMembers(options.chatConversationState.activeConversationId),
                    options.chatFriendship.loadFriends(),
                ])
            } else {
                await options.chatFriendship.loadFriends()
            }
            syncGroupConfigForm()
            syncPreferenceForm()
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '加载会话设置失败'))
        }
    }

    const handleGroupAvatarUpload: UploadProps['beforeUpload'] = async (file) => {
        if (!options.canManageGroupPermission.value) {
            message.warning('仅群主可修改群资料和群设置')
            return false
        }
        const warning = validateAvatarFile(file as File)
        if (warning) {
            message.warning(warning)
            return false
        }

        if (avatarTempObjectUrl) {
            URL.revokeObjectURL(avatarTempObjectUrl)
            avatarTempObjectUrl = ''
        }

        avatarTempObjectUrl = URL.createObjectURL(file as File)
        avatarCropImageUrl.value = avatarTempObjectUrl
        avatarCropOpen.value = true
        return false
    }

    const handleAvatarCropCancel = () => {
        clearCropState()
    }

    const handleAvatarCropConfirm = async (avatarFile: File) => {
        if (!options.canManageGroupPermission.value) {
            message.warning('仅群主可修改群资料和群设置')
            clearCropState()
            return
        }
        if (!options.chatConversationState.activeConversationId) {
            clearCropState()
            return
        }
        if (!options.authAccessToken.value) {
            message.error('登录状态无效，无法上传头像')
            return
        }

        groupAvatarUploading.value = true
        try {
            const result = await uploadFileWithCategory({
                file: avatarFile,
                category: 'profile',
                token: options.authAccessToken.value,
            })
            groupConfigForm.avatar = result.url
            await options.chatConversation.updateGroupConfig(options.chatConversationState.activeConversationId, { avatar: result.url })
            message.success('群头像已更新')
            clearCropState()
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '上传群头像失败'))
        } finally {
            groupAvatarUploading.value = false
        }
    }

    const updateGroupConfigPartial = async (payload: {
        name?: string
        max_members?: number | null
        join_approval_required?: boolean
        allow_member_invite?: boolean
        mute_all?: boolean
    }) => {
        if (!options.canManageGroupPermission.value) {
            message.warning('仅群主可修改群资料和群设置')
            return
        }
        if (!options.chatConversationState.activeConversationId) {
            return
        }
        groupConfigSaving.value = true
        try {
            await options.chatConversation.updateGroupConfig(options.chatConversationState.activeConversationId, payload)
        } catch (error: unknown) {
            syncGroupConfigForm()
            message.error(getErrorMessage(error, '更新群聊设置失败'))
        } finally {
            groupConfigSaving.value = false
        }
    }

    const handleSaveGroupConfig = async () => {
        if (!options.canManageGroupPermission.value) {
            message.warning('仅群主可修改群资料和群设置')
            return
        }
        if (!options.chatConversationState.activeConversationId) {
            return
        }
        if (!trimText(groupConfigForm.name)) {
            message.warning('请输入群名称')
            return
        }
        groupConfigSaving.value = true
        try {
            await options.chatConversation.updateGroupConfig(options.chatConversationState.activeConversationId, {
                name: trimText(groupConfigForm.name),
                avatar: trimText(groupConfigForm.avatar),
                join_approval_required: groupConfigForm.join_approval_required,
                allow_member_invite: groupConfigForm.allow_member_invite,
                mute_all: groupConfigForm.mute_all,
                max_members: groupConfigForm.max_members,
            })
            syncGroupConfigForm()
            groupNameEditing.value = false
            message.success('群聊设置已更新')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '更新群聊设置失败'))
        } finally {
            groupConfigSaving.value = false
        }
    }

    const toggleGroupNameEditing = async () => {
        if (!options.canManageGroupPermission.value) {
            message.warning('仅群主可修改群资料和群设置')
            return
        }
        if (groupNameEditing.value) {
            groupConfigForm.name = options.chatConversationState.activeConversation?.name || ''
            groupNameEditing.value = false
            return
        }
        groupConfigForm.name = options.chatConversationState.activeConversation?.name || groupConfigForm.name
        groupNameEditing.value = true
        await focusEditableInput(groupNameInputRef.value)
    }

    const commitGroupName = async () => {
        const nextValue = trimText(groupConfigForm.name)
        groupNameEditing.value = false
        if (!options.chatConversationState.activeConversationId || !nextValue || nextValue === (options.chatConversationState.activeConversation?.name || '')) {
            groupConfigForm.name = nextValue || options.chatConversationState.activeConversation?.name || ''
            return
        }
        groupConfigForm.name = nextValue
        await updateGroupConfigPartial({ name: nextValue })
    }

    const handleGroupNameBlur = async () => {
        if (skipNextGroupNameBlur.value) {
            skipNextGroupNameBlur.value = false
            return
        }
        await commitGroupName()
    }

    const handleGroupNameEnter = async (event: KeyboardEvent) => {
        event.preventDefault()
        skipNextGroupNameBlur.value = true
            ; (event.target as HTMLInputElement | null)?.blur()
        await commitGroupName()
    }

    const handleGroupNameEscape = () => {
        groupConfigForm.name = options.chatConversationState.activeConversation?.name || ''
        groupNameEditing.value = false
    }

    const handleGroupMaxMembersBlur = async () => {
        if (!options.canManageGroupPermission.value) {
            syncGroupConfigForm()
            message.warning('仅群主可修改群资料和群设置')
            return
        }
        if (!options.chatConversationState.activeConversationId) {
            return
        }
        const currentValue = options.chatConversationState.activeConversation?.group_config?.max_members ?? null
        if ((groupConfigForm.max_members ?? null) === currentValue) {
            return
        }
        await updateGroupConfigPartial({ max_members: groupConfigForm.max_members ?? null })
    }

    const handleGroupSwitchChange = async (field: 'join_approval_required' | 'allow_member_invite' | 'mute_all', checked: boolean) => {
        if (!options.canManageGroupPermission.value) {
            syncGroupConfigForm()
            message.warning('仅群主可修改群资料和群设置')
            return
        }
        await updateGroupConfigPartial({ [field]: checked })
    }

    const handlePinChange = async (checked: boolean) => {
        if (!options.canPinConversationPermission.value) {
            message.warning('当前角色无会话置顶权限')
            return
        }
        if (!options.chatConversationState.activeConversationId) {
            return
        }
        const previous = pinnedConversation.value
        pinnedConversation.value = checked
        try {
            await options.chatConversation.toggleConversationPin(options.chatConversationState.activeConversationId, checked)
        } catch (error: unknown) {
            pinnedConversation.value = previous
            message.error(getErrorMessage(error, '更新置顶状态失败'))
        }
    }

    const handleMuteNotificationChange = async (checked: boolean) => {
        if (!options.chatConversationState.activeConversationId) {
            return
        }
        const previous = muteNotifications.value
        muteNotifications.value = checked
        try {
            await options.chatConversation.updateConversationPreferences(options.chatConversationState.activeConversationId, { mute_notifications: checked })
        } catch (error: unknown) {
            muteNotifications.value = previous
            message.error(getErrorMessage(error, '更新免打扰状态失败'))
        }
    }

    const handleSaveGroupNickname = async () => {
        if (!options.chatConversationState.activeConversationId || groupNicknameSaving.value) {
            return
        }
        groupNicknameSaving.value = true
        try {
            const nextValue = trimText(groupNicknameInput.value)
            await options.chatConversation.updateConversationPreferences(options.chatConversationState.activeConversationId, { group_nickname: nextValue })
            groupNicknameInput.value = nextValue
            message.success('群昵称已更新')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '更新群昵称失败'))
        } finally {
            groupNicknameSaving.value = false
        }
    }

    const commitGroupNickname = async () => {
        const nextValue = trimText(groupNicknameInput.value)
        const currentValue = options.chatConversationState.activeConversation?.member_settings?.group_nickname || ''
        groupNicknameEditing.value = false
        groupNicknameInput.value = nextValue
        if (nextValue === currentValue) {
            return
        }
        await handleSaveGroupNickname()
    }

    const handleGroupNicknameBlur = async () => {
        if (skipNextGroupNicknameBlur.value) {
            skipNextGroupNicknameBlur.value = false
            return
        }
        await commitGroupNickname()
    }

    const toggleGroupNicknameEditing = async () => {
        if (groupNicknameEditing.value) {
            groupNicknameInput.value = options.chatConversationState.activeConversation?.member_settings?.group_nickname || ''
            groupNicknameEditing.value = false
            return
        }
        groupNicknameInput.value = options.chatConversationState.activeConversation?.member_settings?.group_nickname || ''
        groupNicknameEditing.value = true
        await focusEditableInput(groupNicknameInputRef.value)
    }

    const handleGroupNicknameEnter = async (event: KeyboardEvent) => {
        event.preventDefault()
        skipNextGroupNicknameBlur.value = true
            ; (event.target as HTMLInputElement | null)?.blur()
        await commitGroupNickname()
    }

    const handleGroupNicknameEscape = () => {
        groupNicknameInput.value = options.chatConversationState.activeConversation?.member_settings?.group_nickname || ''
        groupNicknameEditing.value = false
    }

    const handleSaveDirectRemark = async () => {
        if (!options.currentFriendship.value || friendRemarkSaving.value) {
            return
        }
        friendRemarkSaving.value = true
        try {
            const nextValue = trimText(directRemark.value)
            await options.chatFriendship.updateFriendRemark(options.currentFriendship.value.friend_user.id, nextValue)
            directRemark.value = nextValue
            message.success('好友备注已更新')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '更新好友备注失败'))
        } finally {
            friendRemarkSaving.value = false
        }
    }

    const toggleDirectRemarkEditing = async () => {
        if (directRemarkEditing.value) {
            directRemark.value = options.currentFriendship.value?.remark || ''
            directRemarkEditing.value = false
            return
        }
        directRemark.value = options.currentFriendship.value?.remark || ''
        directRemarkEditing.value = true
        await focusEditableInput(directRemarkInputRef.value)
    }

    const commitDirectRemark = async () => {
        const nextValue = trimText(directRemark.value)
        const currentValue = options.currentFriendship.value?.remark || ''
        directRemarkEditing.value = false
        directRemark.value = nextValue
        if (nextValue === currentValue) {
            return
        }
        await handleSaveDirectRemark()
    }

    const handleDirectRemarkBlur = async () => {
        if (skipNextDirectRemarkBlur.value) {
            skipNextDirectRemarkBlur.value = false
            return
        }
        await commitDirectRemark()
    }

    const handleDirectRemarkEnter = async (event: KeyboardEvent) => {
        event.preventDefault()
        skipNextDirectRemarkBlur.value = true
            ; (event.target as HTMLInputElement | null)?.blur()
        await commitDirectRemark()
    }

    const handleDirectRemarkEscape = () => {
        directRemark.value = options.currentFriendship.value?.remark || ''
        directRemarkEditing.value = false
    }

    const handleLeaveConversation = async () => {
        if (!options.chatConversationState.activeConversationId) {
            return
        }
        try {
            await options.chatGroup.leaveConversation(options.chatConversationState.activeConversationId)
            groupDrawerOpen.value = false
            message.success('已退出群聊')
            await options.onCloseDrawerAfterLeave?.()
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '退出群聊失败'))
        }
    }

    const handleAddFriend = async () => {
        if (!options.directTargetUser.value || !options.canAddFriend.value) {
            return
        }
        try {
            await options.chatFriendship.submitFriendRequest(options.directTargetUser.value.id)
            message.success('好友申请已发送')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '发送好友申请失败'))
        }
    }

    const handleDeleteCurrentFriend = async () => {
        if (!options.currentFriendship.value || !options.canDeleteFriend.value) {
            return
        }
        const confirmed = await options.confirmAction({
            title: '确认删除好友',
            content: `确认删除好友 ${options.directConversationTitle.value}？`,
            okText: '确认删除',
            danger: true,
        })
        if (!confirmed) {
            return
        }
        try {
            await options.chatFriendship.removeFriend(options.currentFriendship.value.friend_user.id)
            await options.chatFriendship.loadFriends()
            groupDrawerOpen.value = false
            message.success('好友已删除')
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '删除好友失败'))
        }
    }

    watch(() => options.chatConversationState.activeConversation?.group_config, () => {
        syncGroupConfigForm()
    }, { immediate: true })

    watch(() => [options.chatConversationState.activeConversation, options.currentFriendship.value], () => {
        syncPreferenceForm()
    }, { immediate: true })

    onBeforeUnmount(() => {
        clearCropState()
    })

    return {
        groupDrawerOpen,
        groupConfigSaving,
        groupAvatarUploading,
        groupNameEditing,
        groupNicknameEditing,
        directRemarkEditing,
        groupNameInputRef,
        groupNicknameInputRef,
        directRemarkInputRef,
        muteNotifications,
        pinnedConversation,
        groupNicknameInput,
        directRemark,
        avatarCropOpen,
        avatarCropImageUrl,
        groupConfigForm,
        openSettingsDrawer,
        handleGroupAvatarUpload,
        handleAvatarCropCancel,
        handleAvatarCropConfirm,
        handleSaveGroupConfig,
        toggleGroupNameEditing,
        handleGroupNameBlur,
        handleGroupNameEnter,
        handleGroupNameEscape,
        handleGroupMaxMembersBlur,
        handleGroupSwitchChange,
        handlePinChange,
        handleMuteNotificationChange,
        toggleGroupNicknameEditing,
        handleGroupNicknameBlur,
        handleGroupNicknameEnter,
        handleGroupNicknameEscape,
        toggleDirectRemarkEditing,
        handleDirectRemarkBlur,
        handleDirectRemarkEnter,
        handleDirectRemarkEscape,
        handleLeaveConversation,
        handleAddFriend,
        handleDeleteCurrentFriend,
        syncGroupConfigForm,
        syncPreferenceForm,
    }
}