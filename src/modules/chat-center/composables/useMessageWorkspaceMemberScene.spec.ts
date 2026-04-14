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

describe('useMessageWorkspaceMemberScene', () => {
    const loadFriends = vi.fn(async () => undefined)
    const inviteMember = vi.fn(async () => undefined)
    const removeMember = vi.fn(async () => undefined)
    const updateMemberRole = vi.fn(async () => undefined)
    const muteMember = vi.fn(async () => undefined)
    const loadMembers = vi.fn(async () => undefined)
    const transferOwner = vi.fn(async () => undefined)
    const disbandConversation = vi.fn(async () => undefined)
    const handleJoinRequest = vi.fn(async () => undefined)
    const openDirectConversation = vi.fn(async () => undefined)
    const push = vi.fn(async () => undefined)
    const confirmAction = vi.fn(async () => true)

    const canManageMembersRef = ref(true)
    const canEditRolesRef = ref(true)
    const canInviteGroupMembersRef = ref(true)
    const canManageGroupPermissionRef = ref(true)
    const canManageMembers = computed(() => canManageMembersRef.value)
    const canEditRoles = computed(() => canEditRolesRef.value)
    const canInviteGroupMembers = computed(() => canInviteGroupMembersRef.value)
    const canManageGroupPermission = computed(() => canManageGroupPermissionRef.value)
    const currentUserId = ref<number | undefined>(7)
    const directSourceContext = ref<{ userId: number; groupName: string } | null>(null)
    const groupDrawerOpen = ref(true)
    const chatConversationState = {
        activeConversationId: 18,
        activeConversation: {
            id: 18,
            name: '测试群',
            type: 'group',
        },
    }
    const chatGroupState = {
        activeMembers: [
            {
                user: { id: 8, username: 'peer', display_name: '成员', avatar: '' },
                role: 'admin',
                group_nickname: '',
                friend_remark: '',
                mute_until: null,
            },
        ],
    }
    const availableInviteFriends = computed(() => [
        {
            friend_user: { id: 12, username: 'friend', display_name: '好友' },
            remark: '老友',
        },
    ])

    beforeEach(() => {
        vi.clearAllMocks()
        canManageMembersRef.value = true
        canEditRolesRef.value = true
        canInviteGroupMembersRef.value = true
        canManageGroupPermissionRef.value = true
        directSourceContext.value = null
        groupDrawerOpen.value = true
    })

    async function mountScene() {
        const { useMessageWorkspaceMemberScene } = await import('@/modules/chat-center/composables/useMessageWorkspaceMemberScene')
        let scene: ReturnType<typeof useMessageWorkspaceMemberScene>
        const wrapper = mount(defineComponent({
            setup() {
                scene = useMessageWorkspaceMemberScene({
                    router: { push } as any,
                    currentUserId,
                    chatConversationState,
                    chatGroupState: chatGroupState as any,
                    availableInviteFriends,
                    canManageMembers,
                    canEditRoles,
                    canInviteGroupMembers,
                    canManageGroupPermission,
                    chatFriendship: { loadFriends },
                    chatGroup: {
                        inviteMember,
                        removeMember,
                        updateMemberRole,
                        muteMember,
                        loadMembers,
                        transferOwner,
                        disbandConversation,
                        handleJoinRequest,
                    },
                    chatConversation: { openDirectConversation },
                    directSourceContext,
                    groupDrawerOpen,
                    confirmAction,
                })
                return () => null
            },
        }))
        await nextTick()
        return { wrapper, scene: scene! }
    }

    it('loads friends before opening invite modal', async () => {
        const { wrapper, scene } = await mountScene()

        await scene.openInviteModal()

        expect(loadFriends).toHaveBeenCalledOnce()
        expect(scene.inviteModalOpen.value).toBe(true)

        wrapper.unmount()
    })

    it('handles owner transfer through confirmed member action', async () => {
        const { wrapper, scene } = await mountScene()

        await scene.handleMemberActionMenuClick(chatGroupState.activeMembers[0] as any, { key: 'transfer-owner' })

        expect(confirmAction).toHaveBeenCalledOnce()
        expect(transferOwner).toHaveBeenCalledWith(18, 8)

        wrapper.unmount()
    })
})