import type { ComputedRef, Ref } from 'vue'
import { deleteMessageApi, restoreRevokedDraftApi, revokeMessageApi } from '@/api/chat'
import { globalWebSocket } from '@/utils/websocket'
import { loadMessagesAction, loadOlderMessagesAction, markConversationReadAction, retryMessageAction, sendAssetMessageAction, sendTextMessageAction } from '@/stores/chat/messageActions'
import type { ChatConversationItem, ChatFriendshipItem, ChatMessageAssetPayload, ChatMessageCursor, ChatMessageItem } from '@/types/chat'

export function createMessageOrchestration(deps: {
    activeConversation: ComputedRef<ChatConversationItem | null>
    friends: Ref<ChatFriendshipItem[]>
    currentUserId: () => number | undefined
    loadingMessages: Ref<boolean>
    messageMap: Record<number, ChatMessageItem[]>
    failedMessageMap: Ref<Record<number, ChatMessageItem[]>>
    cursorMap: Record<number, ChatMessageCursor>
    conversations: Ref<ChatConversationItem[]>
    sendingFallbackTimer: Ref<ReturnType<typeof setTimeout> | null>
    sendingSyncTimer: Ref<ReturnType<typeof setTimeout> | null>
    sending: Ref<boolean>
    upsertConversation: (conversation: ChatConversationItem) => void
    loadMembers: (conversationId: number) => Promise<void>
    markConversationRead: (conversationId: number, lastReadSequence: number) => Promise<void>
    updateLocalMessageStatus: (conversationId: number, clientMessageId: string, status: 'sending' | 'failed', error?: string) => void
    updateLocalAttachmentPayload: (conversationId: number, clientMessageId: string, payloadPatch: Partial<ChatMessageAssetPayload>) => void
    clearSendingState: () => void
    insertLocalMessage: (conversationId: number, content: string, clientMessageId: string, status: 'sending' | 'failed', error?: string) => void
    insertLocalAttachmentMessage: (conversationId: number, options: { clientMessageId: string; displayName: string; messageType: 'image' | 'file'; payload: ChatMessageAssetPayload & { client_message_id: string }; status: 'sending' | 'failed'; error?: string }) => void
    loadMessagesRef: (conversationId: number, params?: { before_sequence?: number; after_sequence?: number; around_sequence?: number; limit?: number }) => Promise<void>
    setConversationUnread: (conversationId: number, unreadCount: number, lastReadSequence?: number) => void
}) {
    const scheduleFallback = (conversationId: number, clientMessageId: string) => {
        if (deps.sendingFallbackTimer.value) {
            clearTimeout(deps.sendingFallbackTimer.value)
        }
        deps.sendingFallbackTimer.value = setTimeout(() => {
            deps.updateLocalMessageStatus(conversationId, clientMessageId, 'failed', '发送超时，请重试')
            deps.clearSendingState()
        }, 12000)
    }

    const scheduleSync = (conversationId: number, clientMessageId: string) => {
        if (deps.sendingSyncTimer.value) {
            clearTimeout(deps.sendingSyncTimer.value)
        }
        deps.sendingSyncTimer.value = setTimeout(() => {
            void deps.loadMessagesRef(conversationId)
                .catch(() => undefined)
                .finally(() => {
                    deps.updateLocalMessageStatus(conversationId, clientMessageId, 'failed', '发送状态未知，请重试')
                    deps.clearSendingState()
                })
        }, 1500)
    }

    const loadMessages = async (conversationId: number, params?: { before_sequence?: number; after_sequence?: number; around_sequence?: number; limit?: number }) => {
        await loadMessagesAction({
            conversationId,
            params,
            loadingMessages: deps.loadingMessages,
            messageMap: deps.messageMap,
            failedMessageMap: deps.failedMessageMap,
            cursorMap: deps.cursorMap,
            upsertConversation: deps.upsertConversation,
            loadMembers: deps.loadMembers,
        })
    }

    const loadOlderMessages = async (conversationId: number) => {
        await loadOlderMessagesAction({ conversationId, cursorMap: deps.cursorMap, loadMessages })
    }

    const markConversationRead = async (conversationId: number, lastReadSequence: number) => {
        await markConversationReadAction({ conversationId, lastReadSequence, setConversationUnread: deps.setConversationUnread })
    }

    const sendTextMessage = async (content: string, quotedMessageId?: number) => {
        await sendTextMessageAction({
            content,
            quotedMessageId,
            activeConversation: deps.activeConversation,
            friends: deps.friends,
            currentUserId: deps.currentUserId(),
            insertLocalMessage: deps.insertLocalMessage,
            updateLocalMessageStatus: deps.updateLocalMessageStatus,
            clearSendingState: deps.clearSendingState,
            setSending: (value) => {
                deps.sending.value = value
            },
            scheduleFallback,
            scheduleSync,
        })
    }

    const sendAttachmentMessageByReference = async (options: {
        sourceAssetReferenceId?: number
        displayName: string
        mediaType: string
        mimeType?: string
        fileSize?: number
        url?: string
        streamUrl?: string
        thumbnailUrl?: string
        processingStatus?: string
        quotedMessageId?: number
        existingClientMessageId?: string
        uploadBeforeSend?: (updateProgress: (payloadPatch: Partial<ChatMessageAssetPayload>) => void) => Promise<{
            sourceAssetReferenceId: number
            displayName?: string
            mediaType?: string
            mimeType?: string
            fileSize?: number
            url?: string
            streamUrl?: string
            thumbnailUrl?: string
            processingStatus?: string
        }>
    }) => {
        await sendAssetMessageAction({
            ...options,
            activeConversation: deps.activeConversation,
            friends: deps.friends,
            currentUserId: deps.currentUserId(),
            insertLocalAttachmentMessage: deps.insertLocalAttachmentMessage,
            updateLocalMessageStatus: deps.updateLocalMessageStatus,
            updateLocalAttachmentPayload: deps.updateLocalAttachmentPayload,
            clearSendingState: deps.clearSendingState,
            setSending: (value) => {
                deps.sending.value = value
            },
            scheduleFallback,
            scheduleSync,
        })
    }

    const sendAttachmentMessage = async (options: {
        sourceAssetReferenceId?: number
        displayName: string
        mediaType: string
        mimeType?: string
        fileSize?: number
        url?: string
        streamUrl?: string
        thumbnailUrl?: string
        processingStatus?: string
        quotedMessageId?: number
        uploadBeforeSend?: (updateProgress: (payloadPatch: Partial<ChatMessageAssetPayload>) => void) => Promise<{
            sourceAssetReferenceId: number
            displayName?: string
            mediaType?: string
            mimeType?: string
            fileSize?: number
            url?: string
            streamUrl?: string
            thumbnailUrl?: string
            processingStatus?: string
        }>
    }) => {
        await sendAttachmentMessageByReference(options)
    }

    const retryMessage = async (messageItem: ChatMessageItem) => {
        if (messageItem.message_type === 'image' || messageItem.message_type === 'file') {
            const attachmentPayload = messageItem.payload as { source_asset_reference_id?: number; asset_reference_id?: number; client_message_id?: string; display_name?: string; media_type?: string; mime_type?: string; file_size?: number; url?: string }
            const sourceAssetReferenceId = Number(attachmentPayload.source_asset_reference_id || attachmentPayload.asset_reference_id || 0)
            const clientMessageId = String(attachmentPayload.client_message_id || '')
            if (!sourceAssetReferenceId || !clientMessageId) {
                return
            }
            await sendAttachmentMessageByReference({
                sourceAssetReferenceId,
                displayName: attachmentPayload.display_name || messageItem.content,
                mediaType: attachmentPayload.media_type || messageItem.message_type,
                mimeType: attachmentPayload.mime_type,
                fileSize: attachmentPayload.file_size,
                url: attachmentPayload.url,
                existingClientMessageId: clientMessageId,
            })
            return
        }
        await retryMessageAction({
            messageItem,
            activeConversation: deps.activeConversation,
            friends: deps.friends,
            currentUserId: deps.currentUserId(),
            updateLocalMessageStatus: deps.updateLocalMessageStatus,
        })
    }

    const revokeMessage = async (messageId: number) => {
        const { data } = await revokeMessageApi(messageId)
        const activeConversation = deps.activeConversation.value
        if (activeConversation && data.message) {
            const items = deps.messageMap[activeConversation.id] || []
            deps.messageMap[activeConversation.id] = items.map((item) => (item.id === data.message.id ? data.message : item))
        }
        return data
    }

    const deleteMessage = async (messageId: number) => {
        const { data } = await deleteMessageApi(messageId)
        const conversationId = data.conversation?.id || deps.activeConversation.value?.id
        if (conversationId) {
            const items = deps.messageMap[conversationId] || []
            deps.messageMap[conversationId] = items.filter((item) => item.id !== messageId)
        }
        if (data.conversation) {
            deps.upsertConversation(data.conversation)
        }
        return data
    }

    const restoreRevokedDraft = async (messageId: number) => {
        const { data } = await restoreRevokedDraftApi(messageId)
        const activeConversation = deps.activeConversation.value
        if (activeConversation) {
            const items = deps.messageMap[activeConversation.id] || []
            deps.messageMap[activeConversation.id] = items.map((item) => {
                if (item.id !== messageId) {
                    return item
                }
                return {
                    ...item,
                    payload: {
                        ...(item.payload || {}),
                        revoked: {
                            ...((item.payload || {}).revoked as Record<string, unknown> || {}),
                            restore_used: true,
                        },
                    },
                }
            })
        }
        return data
    }

    const sendTyping = (isTyping: boolean) => {
        if (!deps.activeConversation.value || deps.activeConversation.value.type !== 'direct' || !globalWebSocket.connected.value) {
            return
        }
        globalWebSocket.send({
            type: 'chat_typing',
            conversation_id: deps.activeConversation.value.id,
            is_typing: isTyping,
        })
    }

    return {
        loadMessages,
        loadOlderMessages,
        markConversationRead,
        sendTextMessage,
        sendAttachmentMessage,
        retryMessage,
        revokeMessage,
        deleteMessage,
        restoreRevokedDraft,
        sendTyping,
        sendAttachmentMessageByReference,
    }
}