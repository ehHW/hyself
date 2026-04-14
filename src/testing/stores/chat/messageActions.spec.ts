import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatConversationItem, ChatFriendshipItem } from '@/types/chat'
import { sendAssetMessageAction } from '@/stores/chat/messageActions'
import { globalWebSocket } from '@/utils/websocket'

vi.mock('@/utils/websocket', () => ({
    globalWebSocket: {
        connected: { value: true },
        send: vi.fn(),
    },
}))

const baseConversation: ChatConversationItem = {
    id: 12,
    type: 'direct',
    name: '测试会话',
    avatar: '',
    direct_target: null,
    friend_remark: null,
    is_pinned: false,
    access_mode: 'member',
    member_role: null,
    show_in_list: true,
    unread_count: 0,
    last_message_preview: '',
    last_message_at: null,
    member_count: 2,
    can_send_message: true,
    status: 'active',
    last_read_sequence: 0,
    member_settings: {
        mute_notifications: false,
        group_nickname: '',
    },
    group_config: null,
    owner: null,
}

describe('sendAssetMessageAction', () => {
    beforeEach(() => {
        vi.mocked(globalWebSocket.send).mockReset()
            ; (globalWebSocket.connected as { value: boolean }).value = true
    })

    it('rejects direct attachment send when friendship is gone', async () => {
        const insertLocalAttachmentMessage = vi.fn()
        const updateLocalMessageStatus = vi.fn()
        const updateLocalAttachmentPayload = vi.fn()

        await expect(
            sendAssetMessageAction({
                sourceAssetReferenceId: 99,
                displayName: '合同.pdf',
                mediaType: 'file',
                activeConversation: computed(() => baseConversation),
                friends: ref<ChatFriendshipItem[]>([]),
                insertLocalAttachmentMessage,
                updateLocalMessageStatus,
                updateLocalAttachmentPayload,
                clearSendingState: vi.fn(),
                setSending: vi.fn(),
                scheduleFallback: vi.fn(),
                scheduleSync: vi.fn(),
            }),
        ).rejects.toThrow('你们已不是好友，当前私聊附件发送失败')

        expect(insertLocalAttachmentMessage).toHaveBeenCalledWith(
            12,
            expect.objectContaining({
                status: 'failed',
                displayName: '合同.pdf',
            }),
        )
        expect(globalWebSocket.send).not.toHaveBeenCalled()
    })

    it('sends attachment message through websocket with the unified protocol', async () => {
        vi.mocked(globalWebSocket.send).mockReturnValue(true)
        const insertLocalAttachmentMessage = vi.fn()
        const scheduleFallback = vi.fn()
        const scheduleSync = vi.fn()
        const updateLocalAttachmentPayload = vi.fn()

        await sendAssetMessageAction({
            sourceAssetReferenceId: 108,
            displayName: '设计稿.png',
            mediaType: 'image',
            mimeType: 'image/png',
            fileSize: 4096,
            url: '/uploads/design.png',
            activeConversation: computed(() => baseConversation),
            friends: ref<ChatFriendshipItem[]>([
                {
                    friendship_id: 3,
                    accepted_at: '2025-01-01T00:00:00Z',
                    remark: '',
                    friend_user: {
                        id: 2,
                        username: 'friend',
                        display_name: '好友',
                        avatar: '',
                    },
                    direct_conversation: {
                        id: 12,
                        show_in_list: true,
                    },
                },
            ]),
            insertLocalAttachmentMessage,
            updateLocalMessageStatus: vi.fn(),
            updateLocalAttachmentPayload,
            clearSendingState: vi.fn(),
            setSending: vi.fn(),
            scheduleFallback,
            scheduleSync,
        })

        expect(insertLocalAttachmentMessage).toHaveBeenCalledWith(
            12,
            expect.objectContaining({
                status: 'sending',
                displayName: '设计稿.png',
                messageType: 'image',
            }),
        )
        expect(globalWebSocket.send).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'chat_send_asset_message',
                conversation_id: 12,
                asset_reference_id: 108,
            }),
        )
        expect(scheduleFallback).toHaveBeenCalledOnce()
        expect(scheduleSync).toHaveBeenCalledOnce()
    })
})