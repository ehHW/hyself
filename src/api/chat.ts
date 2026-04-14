import instance from '@/utils/request'
import type {
    ChatAdminConversationResult,
    ChatAdminMessageResult,
    ChatConversationItem,
    ChatConversationMemberItem,
    ChatFriendRequestItem,
    ChatFriendshipItem,
    ChatGroupInvitationPayload,
    ChatMessageItem,
    ChatGroupJoinRequestItem,
    ChatMessageListResult,
    ChatPreferencePayload,
    ChatSearchResult,
} from '@/types/chat'
import type { ListResult } from '@/types/user'

export const getConversationsApi = (params?: { category?: 'all' | 'direct' | 'group'; keyword?: string; include_hidden?: boolean }) => {
    return instance.get<ListResult<ChatConversationItem>>('chat/conversations/', { params })
}

export const getConversationDetailApi = (conversationId: number) => {
    return instance.get<ChatConversationItem>(`chat/conversations/${conversationId}/`)
}

export const getConversationMessagesApi = (
    conversationId: number,
    params?: { before_sequence?: number; after_sequence?: number; around_sequence?: number; limit?: number },
) => {
    return instance.get<ChatMessageListResult>(`chat/conversations/${conversationId}/messages/`, { params })
}

export const sendConversationAttachmentApi = (conversationId: number, asset_reference_id: number) => {
    return instance.post<{
        detail: string
        conversation_id: number
        message: ChatMessageItem
        conversation: ChatConversationItem
        asset_reference: {
            id: number
            asset_id: number | null
            ref_domain: string
            ref_type: string
        }
    }>(`chat/conversations/${conversationId}/attachments/`, { asset_reference_id })
}

export const forwardMessagesApi = (payload: { target_conversation_id: number; message_ids: number[]; forward_mode?: 'separate' | 'merged' }) => {
    return instance.post<{ detail: string; target_conversation_id: number; forwarded_count: number; forward_mode: 'separate' | 'merged' }>('chat/messages/forward/', payload)
}

export const revokeMessageApi = (messageId: number) => {
    return instance.post<{ detail: string; message: ChatMessageItem }>(`chat/messages/${messageId}/revoke/`)
}

export const deleteMessageApi = (messageId: number) => {
    return instance.post<{ detail: string; message_id: number; conversation: ChatConversationItem }>(`chat/messages/${messageId}/delete/`)
}

export const restoreRevokedDraftApi = (messageId: number) => {
    return instance.post<{
        detail: string
        draft: {
            message_type: string
            content: string
            payload: Record<string, unknown>
        }
    }>(`chat/messages/${messageId}/restore-draft/`)
}

export const updateGroupConfigApi = (
    conversationId: number,
    payload: { name?: string; avatar?: string; join_approval_required?: boolean; allow_member_invite?: boolean; max_members?: number | null; mute_all?: boolean },
) => {
    return instance.patch<{ detail: string; conversation: ChatConversationItem; group_config: { join_approval_required: boolean; allow_member_invite: boolean; max_members: number | null; mute_all: boolean } }>(
        `chat/conversations/${conversationId}/group-config/`,
        payload,
    )
}

export const updateConversationPreferenceApi = (
    conversationId: number,
    payload: { mute_notifications?: boolean; group_nickname?: string },
) => {
    return instance.patch<{ detail: string; conversation: ChatConversationItem; member_settings: { mute_notifications: boolean; group_nickname: string } }>(
        `chat/conversations/${conversationId}/preferences/`,
        payload,
    )
}

export const toggleConversationPinApi = (conversationId: number, is_pinned: boolean) => {
    return instance.post<{ detail: string; conversation: ChatConversationItem }>(`chat/conversations/${conversationId}/pin/`, { is_pinned })
}

export const hideConversationApi = (conversationId: number) => {
    return instance.post<{ detail: string }>(`chat/conversations/${conversationId}/hide/`)
}

export const readConversationApi = (conversationId: number, last_read_sequence: number) => {
    return instance.post<{ detail: string; unread_count: number; last_read_sequence: number }>(
        `chat/conversations/${conversationId}/read/`,
        { last_read_sequence },
    )
}

export const openDirectConversationApi = (target_user_id: number) => {
    return instance.post<{ detail: string; created: boolean; conversation: ChatConversationItem }>(
        'chat/conversations/direct/open/',
        { target_user_id },
    )
}

export const createGroupConversationApi = (payload: {
    name: string
    member_user_ids: number[]
    join_approval_required: boolean
    allow_member_invite: boolean
}) => {
    return instance.post<{ detail: string; conversation: ChatConversationItem }>('chat/conversations/groups/', payload)
}

export const getConversationMembersApi = (conversationId: number) => {
    return instance.get<{ conversation_id: number; items: ChatConversationMemberItem[] }>(`chat/conversations/${conversationId}/members/`)
}

export const inviteConversationMemberApi = (conversationId: number, target_user_id: number) => {
    return instance.post<{ detail: string; mode: 'message_sent'; direct_conversation: { id: number; type: 'direct' | 'group' }; message: ChatMessageItem }>(
        `chat/conversations/${conversationId}/members/invite/`,
        { target_user_id },
    )
}

export const applyGroupInvitationApi = (payload: { conversation_id: number; inviter_user_id?: number }) => {
    return instance.post<{
        detail: string
        mode: 'pending_approval' | 'joined'
        conversation?: ChatConversationItem
        join_request?: { id: number; status: string }
        member?: { user_id: number; status: string }
        invitation?: ChatGroupInvitationPayload
    }>('chat/group-invitations/apply/', payload)
}

export const removeConversationMemberApi = (conversationId: number, userId: number) => {
    return instance.post<{ detail: string }>(`chat/conversations/${conversationId}/members/${userId}/remove/`)
}

export const updateConversationMemberRoleApi = (conversationId: number, userId: number, role: 'admin' | 'member') => {
    return instance.post<{ detail: string }>(`chat/conversations/${conversationId}/members/${userId}/role/`, { role })
}

export const muteConversationMemberApi = (conversationId: number, userId: number, mute_minutes: number, reason?: string) => {
    return instance.post<{ detail: string }>(`chat/conversations/${conversationId}/members/${userId}/mute/`, { mute_minutes, reason })
}

export const leaveConversationApi = (conversationId: number) => {
    return instance.post<{ detail: string }>(`chat/conversations/${conversationId}/leave/`)
}

export const transferGroupOwnerApi = (conversationId: number, target_user_id: number) => {
    return instance.post<{ detail: string; conversation_id: number; target_user_id: number }>(
        `chat/conversations/${conversationId}/transfer-owner/`,
        { target_user_id },
    )
}

export const disbandGroupConversationApi = (conversationId: number) => {
    return instance.post<{ detail: string; conversation_id: number }>(`chat/conversations/${conversationId}/disband/`)
}

export const getGroupJoinRequestsApi = (params?: { conversation_id?: number; status?: string }) => {
    return instance.get<ListResult<ChatGroupJoinRequestItem>>('chat/group-join-requests/', { params })
}

export const handleGroupJoinRequestApi = (requestId: number, payload: { action: 'approve' | 'reject' | 'cancel'; review_note?: string }) => {
    return instance.post<{ detail: string }>(`chat/group-join-requests/${requestId}/handle/`, payload)
}

export const getFriendsApi = (params?: { keyword?: string }) => {
    return instance.get<ListResult<ChatFriendshipItem>>('chat/friends/', { params })
}

export const createFriendRequestApi = (payload: { to_user_id: number; request_message?: string }) => {
    return instance.post<{ detail: string; mode: string }>('chat/friends/requests/', payload)
}

export const getFriendRequestsApi = (params?: { direction?: 'received' | 'sent' | 'all'; status?: string }) => {
    return instance.get<ListResult<ChatFriendRequestItem>>('chat/friends/requests/', { params })
}

export const handleFriendRequestApi = (requestId: number, action: 'accept' | 'reject' | 'cancel') => {
    return instance.post<{ detail: string }>(`chat/friends/requests/${requestId}/handle/`, { action })
}

export const deleteFriendApi = (friendUserId: number) => {
    return instance.post<{ detail: string }>(`chat/friends/${friendUserId}/delete/`)
}

export const updateFriendSettingApi = (friendUserId: number, payload: { remark?: string }) => {
    return instance.patch<{ detail: string; remark: string }>(`chat/friends/${friendUserId}/settings/`, payload)
}

export const searchChatApi = (params: { keyword: string; limit?: number; scope?: 'connected' | 'discover' | 'audit' }) => {
    return instance.get<ChatSearchResult>('chat/search/', { params })
}

export const getChatSettingsApi = () => {
    return instance.get<ChatPreferencePayload>('chat/settings/')
}

export const updateChatSettingsApi = (payload: Partial<ChatPreferencePayload>) => {
    return instance.patch<ChatPreferencePayload>('chat/settings/', payload)
}

export const getAdminConversationsApi = (params?: { keyword?: string; type?: 'direct' | 'group' }) => {
    return instance.get<ChatAdminConversationResult>('chat/admin/conversations/', { params })
}

export const getAdminMessagesApi = (params?: { conversation_id?: number; keyword?: string }) => {
    return instance.get<ChatAdminMessageResult>('chat/admin/messages/', { params })
}
