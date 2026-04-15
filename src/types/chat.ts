import type { ListResult } from '@/types/user'

export type ChatConversationType = 'direct' | 'group'
export type ChatAccessMode = 'member' | 'stealth_readonly' | 'former_member_readonly' | 'discover_preview'
export type ChatMessageType = 'text' | 'system' | 'image' | 'file' | 'chat_record'
export type ChatMemberRole = 'owner' | 'admin' | 'member'
export type ChatRequestStatus = 'pending' | 'accepted' | 'rejected' | 'canceled' | 'expired'
export type ChatJoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'canceled'
export type ChatLocalMessageStatus = 'sending' | 'failed'

export interface ChatVideoSubtitleTrack {
    language: string
    label: string
    path?: string
    url: string
    default?: boolean
    forced?: boolean
}

export interface ChatVideoProcessingMetadata {
    status?: string
    codec?: string
    duration_seconds?: number | null
    width?: number | null
    height?: number | null
    playlist_url?: string
    thumbnail_url?: string
    subtitle_tracks?: ChatVideoSubtitleTrack[]
    error?: string
}

export interface ChatUserBrief {
    id: number
    username: string
    display_name: string
    avatar: string
}

export interface ChatGroupConfig {
    join_approval_required: boolean
    allow_member_invite: boolean
    max_members: number | null
    mute_all: boolean
}

export interface ChatConversationMemberSettings {
    mute_notifications: boolean
    group_nickname: string
}

export interface ChatConversationCapabilities {
    can_view: boolean
    can_open: boolean
    can_read_history: boolean
    can_send_message: boolean
    can_mark_read: boolean
    can_view_members: boolean
    can_manage_members: boolean
    can_manage_group_settings: boolean
    can_invite_members: boolean
    can_join: boolean
}

export interface ChatConversationItem {
    id: number
    type: ChatConversationType
    name: string
    avatar: string
    direct_target: ChatUserBrief | null
    friend_remark: string | null
    is_pinned: boolean
    access_mode: ChatAccessMode
    member_role: ChatMemberRole | null
    show_in_list: boolean
    unread_count: number
    last_message_preview: string
    last_message_at: string | null
    member_count: number
    can_send_message: boolean
    capabilities?: ChatConversationCapabilities
    status: string
    last_read_sequence: number
    member_settings: ChatConversationMemberSettings
    group_config: ChatGroupConfig | null
    owner: ChatUserBrief | null
}

export interface ChatMessageItem {
    id: number
    sequence: number
    client_message_id?: string | null
    message_type: ChatMessageType
    content: string
    payload: Record<string, unknown>
    is_system: boolean
    sender: ChatUserBrief | null
    created_at: string
    local_status?: ChatLocalMessageStatus | null
    local_error?: string | null
}

export interface ChatMessageAssetPayload {
    asset_reference_id: number
    source_asset_reference_id?: number
    display_name: string
    media_type: string
    mime_type?: string
    file_size?: number
    url?: string
    stream_url?: string
    thumbnail_url?: string
    processing_status?: string
    subtitle_tracks?: ChatVideoSubtitleTrack[]
    upload_progress?: number
    upload_phase?: 'uploading' | 'sending'
    local_upload_id?: string
    extra_metadata?: {
        video_processing?: ChatVideoProcessingMetadata
        [key: string]: unknown
    }
}

export interface ChatMessageReplyPayload {
    id: number
    sequence: number
    message_type: ChatMessageType
    sender_name: string
    content_preview: string
    is_revoked?: boolean
}

export interface ChatMessageForwardedPayload {
    id: number
    sequence: number
    conversation_id: number
    message_type: ChatMessageType
    sender_name: string
    content_preview: string
}

export interface ChatMessageRecordItem {
    source_message_id: number
    sequence: number
    conversation_id: number
    message_type: ChatMessageType
    sender_name: string
    sender_avatar: string
    content: string
    asset?: ChatMessageAssetPayload
    chat_record?: ChatMessageRecordPayload
}

export interface ChatMessageRecordPayload {
    version: number
    title: string
    footer_label: string
    items: ChatMessageRecordItem[]
}

export interface ChatGroupInvitationPayload {
    conversation_id: number
    group_name: string
    group_avatar: string
    member_count: number
    join_approval_required: boolean
    inviter: ChatUserBrief
}

export interface ChatComposerAttachmentToken {
    token_id: string
    source_asset_reference_id?: number
    display_name: string
    media_type: string
    mime_type?: string
    file_size?: number
    url?: string
    stream_url?: string
    thumbnail_url?: string
    processing_status?: string
    subtitle_tracks?: ChatVideoSubtitleTrack[]
    local_upload_id?: string
}

export type ChatComposerSegment =
    | { kind: 'text'; text: string }
    | { kind: 'attachment'; attachment: ChatComposerAttachmentToken }

export interface ChatMessageCursor {
    before_sequence: number | null
    after_sequence: number | null
    has_more_before: boolean
    has_more_after: boolean
}

export interface ChatMessageListResult {
    conversation: {
        id: number
        type: ChatConversationType
        access_mode: ChatAccessMode
        can_send_message: boolean
        capabilities?: ChatConversationCapabilities
    }
    cursor: ChatMessageCursor
    items: ChatMessageItem[]
}

export interface ChatFriendRequestItem {
    id: number
    status: ChatRequestStatus
    from_user: ChatUserBrief
    to_user: ChatUserBrief
    request_message: string
    auto_accepted: boolean
    handled_by: ChatUserBrief | null
    handled_at: string | null
    created_at: string
}

export interface ChatFriendshipItem {
    friendship_id: number
    friend_user: ChatUserBrief
    accepted_at: string
    remark: string
    direct_conversation: {
        id: number
        show_in_list: boolean
    } | null
}

export interface ChatFriendNoticeItem {
    id: string
    title: string
    description: string
    created_at: string
    payload: Record<string, unknown>
}

export interface ChatMessageRevokedPayload {
    revoked_at: string
    revoked_by_user_id: number | null
    can_restore_once?: boolean
    restore_used?: boolean
}

export interface ChatMessageDeletedPayload {
    deleted_at: string
}

export interface ChatConversationMemberItem {
    user: ChatUserBrief
    role: ChatMemberRole
    status: string
    mute_until: string | null
    joined_at: string
    group_nickname: string
    friend_remark: string | null
}

export interface ChatGroupJoinRequestItem {
    id: number
    conversation_id: number
    status: ChatJoinRequestStatus
    target_user: ChatUserBrief
    created_at: string
}

export interface ChatGroupNoticeItem {
    id: string
    conversation_id: number | null
    message: string
    created_at: string
    payload: Record<string, unknown>
}

export interface ChatSearchConversationItem {
    id: number
    type: ChatConversationType
    name: string
    access_mode: ChatAccessMode
    capabilities?: ChatConversationCapabilities
}

export interface ChatSearchUserItem {
    id: number
    username: string
    display_name: string
    avatar: string
    can_open_direct: boolean
    direct_conversation: {
        id: number
        show_in_list: boolean
    } | null
}

export interface ChatSearchMessageItem {
    conversation_id: number
    conversation_name: string
    message_id: number
    sequence: number
    message_type: ChatMessageType
    content_preview: string
    sender: ChatUserBrief | null
    created_at: string
}

export interface ChatSearchResult {
    keyword: string
    conversations: ChatSearchConversationItem[]
    users: ChatSearchUserItem[]
    messages: ChatSearchMessageItem[]
}

export interface ChatPreferencePayload {
    theme_mode: 'light' | 'dark'
    chat_receive_notification: boolean
    chat_list_sort_mode: 'recent' | 'unread'
    chat_stealth_inspect_enabled: boolean
    settings_json: Record<string, unknown>
}

export interface ChatAdminConversationResult extends ListResult<ChatConversationItem> { }
export interface ChatAdminMessageResult extends ListResult<ChatMessageItem & { conversation_id: number }> { }
