import { mount } from '@vue/test-utils'
import { computed, defineComponent, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('ant-design-vue', () => ({
    message: {
        warning: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('@/utils/fileUploader', () => ({
    uploadFileWithCategory: vi.fn(async () => ({ url: '/uploads/avatar.png' })),
}))

describe('useMessageWorkspaceSettingsScene', () => {
    const loadMembers = vi.fn(async () => undefined)
    const leaveConversation = vi.fn(async () => undefined)
    const loadFriends = vi.fn(async () => undefined)
    const updateFriendRemark = vi.fn(async () => undefined)
    const submitFriendRequest = vi.fn(async () => undefined)
    const removeFriend = vi.fn(async () => undefined)
    const updateGroupConfig = vi.fn(async () => undefined)
    const toggleConversationPin = vi.fn(async () => undefined)
    const updateConversationPreferences = vi.fn(async () => undefined)
    const confirmAction = vi.fn(async () => true)
    const onCloseDrawerAfterLeave = vi.fn(async () => undefined)

    const authAccessToken = computed(() => 'token')
    const canManageGroupPermissionRef = ref(true)
    const canPinConversationPermissionRef = ref(true)
    const canDeleteFriendRef = ref(true)
    const canAddFriendRef = ref(true)
    const canManageGroupPermission = computed(() => canManageGroupPermissionRef.value)
    const canPinConversationPermission = computed(() => canPinConversationPermissionRef.value)
    const canDeleteFriend = computed(() => canDeleteFriendRef.value)
    const canAddFriend = computed(() => canAddFriendRef.value)
    const chatConversationState = {
        activeConversationId: 18,
        activeConversation: {
            id: 18,
            name: '测试群',
            type: 'group',
            access_mode: 'member',
            avatar: '',
            group_config: {
                join_approval_required: true,
                allow_member_invite: true,
                mute_all: false,
                max_members: 200,
            },
            member_settings: {
                mute_notifications: false,
                group_nickname: '我的昵称',
            },
            is_pinned: false,
        },
    }
    const currentFriendship = computed(() => ({ friend_user: { id: 9 }, remark: '好友备注' }))
    const directTargetUser = computed(() => ({ id: 9 }))
    const directConversationTitle = computed(() => '好友备注')

    beforeEach(() => {
        vi.clearAllMocks()
        canManageGroupPermissionRef.value = true
        canPinConversationPermissionRef.value = true
        canDeleteFriendRef.value = true
        canAddFriendRef.value = true
    })

    async function mountScene() {
        const { useMessageWorkspaceSettingsScene } = await import('@/modules/chat-center/composables/useMessageWorkspaceSettingsScene')
        let scene: ReturnType<typeof useMessageWorkspaceSettingsScene>
        const wrapper = mount(defineComponent({
            setup() {
                scene = useMessageWorkspaceSettingsScene({
                    authAccessToken,
                    chatConversationState,
                    chatGroup: {
                        loadMembers,
                        leaveConversation,
                    },
                    chatFriendship: {
                        loadFriends,
                        updateFriendRemark,
                        submitFriendRequest,
                        removeFriend,
                    },
                    chatConversation: {
                        updateGroupConfig,
                        toggleConversationPin,
                        updateConversationPreferences,
                    },
                    currentFriendship,
                    directTargetUser,
                    directConversationTitle,
                    canManageGroupPermission,
                    canPinConversationPermission,
                    canDeleteFriend,
                    canAddFriend,
                    formatDateTime: (value: string) => value,
                    confirmAction,
                    onCloseDrawerAfterLeave,
                })
                return () => null
            },
        }))
        await nextTick()
        return { wrapper, scene: scene! }
    }

    it('loads members and friends when opening group settings drawer', async () => {
        const { wrapper, scene } = await mountScene()

        await scene.openSettingsDrawer()

        expect(loadMembers).toHaveBeenCalledWith(18)
        expect(loadFriends).toHaveBeenCalledOnce()
        expect(scene.groupDrawerOpen.value).toBe(true)

        wrapper.unmount()
    })

    it('removes current friend after confirmation and closes drawer', async () => {
        const { wrapper, scene } = await mountScene()
        scene.groupDrawerOpen.value = true

        await scene.handleDeleteCurrentFriend()

        expect(confirmAction).toHaveBeenCalledOnce()
        expect(removeFriend).toHaveBeenCalledWith(9)
        expect(loadFriends).toHaveBeenCalledOnce()
        expect(scene.groupDrawerOpen.value).toBe(false)

        wrapper.unmount()
    })
})