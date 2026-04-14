import type { ComputedRef, Ref } from 'vue'
import { getConversationDetailApi, getConversationMessagesApi, readConversationApi } from '@/api/chat'
import type { ChatConversationItem, ChatFriendshipItem, ChatMessageAssetPayload, ChatMessageCursor, ChatMessageItem } from '@/types/chat'
import { getDirectConversationRemovedFailure, getWebSocketDisconnectedFailure, getWebSocketUnavailableFailure } from '@/stores/chat/messageFailure'
import { globalWebSocket } from '@/utils/websocket'
import { mergeConversationMessages } from '@/stores/chat/message'

type MessageParams = { before_sequence?: number; after_sequence?: number; around_sequence?: number; limit?: number }

function isSelfDirectConversation(conversation: ChatConversationItem, currentUserId?: number) {
    if (conversation.type !== 'direct' || !currentUserId) {
        return false
    }
    if (conversation.direct_target?.id === currentUserId) {
        return true
    }
    return conversation.member_count === 1
}

export async function loadMessagesAction(options: {
    conversationId: number
    params?: MessageParams
    loadingMessages: Ref<boolean>
    messageMap: Record<number, ChatMessageItem[]>
    failedMessageMap: Ref<Record<number, ChatMessageItem[]>>
    cursorMap: Record<number, ChatMessageCursor>
    upsertConversation: (item: ChatConversationItem) => void
    loadMembers: (conversationId: number) => Promise<void>
}) {
    const { conversationId, params, loadingMessages, messageMap, failedMessageMap, cursorMap, upsertConversation, loadMembers } = options
    loadingMessages.value = true
    try {
        const { data } = await getConversationMessagesApi(conversationId, params)
        messageMap[conversationId] = mergeConversationMessages(
            messageMap[conversationId] || [],
            failedMessageMap.value[conversationId] || [],
            data.items,
        )
        cursorMap[conversationId] = data.cursor
        const detail = await getConversationDetailApi(conversationId)
        upsertConversation(detail.data)
        if (detail.data.type === 'group' && detail.data.access_mode === 'member') {
            await loadMembers(conversationId)
        }
    } finally {
        loadingMessages.value = false
    }
}

export async function loadOlderMessagesAction(options: {
    conversationId: number
    cursorMap: Record<number, ChatMessageCursor>
    loadMessages: (conversationId: number, params?: MessageParams) => Promise<void>
}) {
    const cursor = options.cursorMap[options.conversationId]
    if (!cursor?.has_more_before || !cursor.before_sequence) {
        return
    }
    await options.loadMessages(options.conversationId, { before_sequence: cursor.before_sequence, limit: 30 })
}

export async function markConversationReadAction(options: {
    conversationId: number
    lastReadSequence: number
    setConversationUnread: (conversationId: number, unreadCount: number, lastReadSequence?: number) => void
}) {
    const { conversationId, lastReadSequence, setConversationUnread } = options
    if (!lastReadSequence) {
        return
    }
    if (globalWebSocket.connected.value) {
        globalWebSocket.send({ type: 'chat_mark_read', conversation_id: conversationId, last_read_sequence: lastReadSequence })
        return
    }
    const { data } = await readConversationApi(conversationId, lastReadSequence)
    setConversationUnread(conversationId, data.unread_count, data.last_read_sequence)
}

export async function sendTextMessageAction(options: {
    content: string
    quotedMessageId?: number
    activeConversation: ComputedRef<ChatConversationItem | null>
    friends: Ref<ChatFriendshipItem[]>
    currentUserId?: number
    insertLocalMessage: (conversationId: number, content: string, clientMessageId: string, status: 'sending' | 'failed', error?: string) => void
    updateLocalMessageStatus: (conversationId: number, clientMessageId: string, status: 'sending' | 'failed', error?: string) => void
    clearSendingState: () => void
    setSending: (value: boolean) => void
    scheduleFallback: (conversationId: number, clientMessageId: string) => void
    scheduleSync: (conversationId: number, clientMessageId: string) => void
}) {
    const conversation = options.activeConversation.value
    if (!conversation) {
        throw new Error('请先选择会话')
    }
    const text = options.content.trim()
    if (!text) {
        throw new Error('消息不能为空')
    }
    if (!globalWebSocket.connected.value) {
        throw new Error(getWebSocketDisconnectedFailure('message'))
    }
    const clientMessageId = `chat_${Date.now()}_${Math.random().toString(16).slice(2)}`
    const directConversationDeletedFriend =
        conversation.type === 'direct' && !isSelfDirectConversation(conversation, options.currentUserId) && !options.friends.value.some((item) => item.direct_conversation?.id === conversation.id)
    if (directConversationDeletedFriend) {
        const errorMessage = getDirectConversationRemovedFailure('message')
        options.insertLocalMessage(conversation.id, text, clientMessageId, 'failed', errorMessage)
        throw new Error(errorMessage)
    }
    options.insertLocalMessage(conversation.id, text, clientMessageId, 'sending')
    options.setSending(true)
    options.scheduleFallback(conversation.id, clientMessageId)
    const sent = globalWebSocket.send({
        type: 'chat_send_message',
        conversation_id: conversation.id,
        content: text,
        client_message_id: clientMessageId,
        quoted_message_id: options.quotedMessageId,
    })
    if (!sent) {
        const errorMessage = getWebSocketUnavailableFailure('message')
        options.updateLocalMessageStatus(conversation.id, clientMessageId, 'failed', errorMessage)
        options.clearSendingState()
        throw new Error(errorMessage)
    }
    options.scheduleSync(conversation.id, clientMessageId)
}

export async function retryMessageAction(options: {
    messageItem: ChatMessageItem
    activeConversation: ComputedRef<ChatConversationItem | null>
    friends: Ref<ChatFriendshipItem[]>
    currentUserId?: number
    updateLocalMessageStatus: (conversationId: number, clientMessageId: string, status: 'sending' | 'failed', error?: string) => void
}) {
    const conversation = options.activeConversation.value
    const retryContent = options.messageItem.content.trim()
    const clientMessageId = String(options.messageItem.payload?.client_message_id || '')
    if (!conversation || !clientMessageId || !retryContent) {
        return
    }
    options.updateLocalMessageStatus(conversation.id, clientMessageId, 'sending')
    const directConversationDeletedFriend =
        conversation.type === 'direct' && !isSelfDirectConversation(conversation, options.currentUserId) && !options.friends.value.some((item) => item.direct_conversation?.id === conversation.id)
    if (directConversationDeletedFriend) {
        const errorMessage = getDirectConversationRemovedFailure('message')
        options.updateLocalMessageStatus(conversation.id, clientMessageId, 'failed', errorMessage)
        throw new Error(errorMessage)
    }
    const sent = globalWebSocket.send({
        type: 'chat_send_message',
        conversation_id: conversation.id,
        content: retryContent,
        client_message_id: clientMessageId,
    })
    if (!sent) {
        const errorMessage = getWebSocketUnavailableFailure('message')
        options.updateLocalMessageStatus(conversation.id, clientMessageId, 'failed', errorMessage)
        throw new Error(errorMessage)
    }
}

export async function sendAssetMessageAction(options: {
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
    activeConversation: ComputedRef<ChatConversationItem | null>
    friends: Ref<ChatFriendshipItem[]>
    currentUserId?: number
    insertLocalAttachmentMessage: (
        conversationId: number,
        options: {
            clientMessageId: string
            displayName: string
            messageType: 'image' | 'file'
            payload: ChatMessageAssetPayload & { client_message_id: string }
            status: 'sending' | 'failed'
            error?: string
        },
    ) => void
    updateLocalMessageStatus: (conversationId: number, clientMessageId: string, status: 'sending' | 'failed', error?: string) => void
    updateLocalAttachmentPayload: (conversationId: number, clientMessageId: string, payloadPatch: Partial<ChatMessageAssetPayload>) => void
    clearSendingState: () => void
    setSending: (value: boolean) => void
    scheduleFallback: (conversationId: number, clientMessageId: string) => void
    scheduleSync: (conversationId: number, clientMessageId: string) => void
}) {
    const conversation = options.activeConversation.value
    if (!conversation) {
        throw new Error('请先选择会话')
    }
    if (!globalWebSocket.connected.value) {
        throw new Error(getWebSocketDisconnectedFailure('asset'))
    }

    const normalizedDisplayName = String(options.displayName || '').trim() || '附件'
    const normalizedMessageType: 'image' | 'file' = options.mediaType === 'image' || options.mediaType === 'avatar' ? 'image' : 'file'
    const directConversationDeletedFriend =
        conversation.type === 'direct' && !isSelfDirectConversation(conversation, options.currentUserId) && !options.friends.value.some((item) => item.direct_conversation?.id === conversation.id)
    const clientMessageId = options.existingClientMessageId || `chat_asset_${Date.now()}_${Math.random().toString(16).slice(2)}`
    const payload: ChatMessageAssetPayload & { client_message_id: string } = {
        client_message_id: clientMessageId,
        asset_reference_id: options.sourceAssetReferenceId || 0,
        source_asset_reference_id: options.sourceAssetReferenceId || 0,
        display_name: normalizedDisplayName,
        media_type: options.mediaType,
        mime_type: options.mimeType || '',
        file_size: options.fileSize,
        url: options.url,
        stream_url: options.streamUrl,
        thumbnail_url: options.thumbnailUrl,
        processing_status: options.processingStatus,
        upload_progress: options.uploadBeforeSend ? 0 : 100,
        upload_phase: options.uploadBeforeSend ? 'uploading' : 'sending',
    }

    if (directConversationDeletedFriend) {
        const errorMessage = getDirectConversationRemovedFailure('asset')
        if (options.existingClientMessageId) {
            options.updateLocalMessageStatus(conversation.id, clientMessageId, 'failed', errorMessage)
        } else {
            options.insertLocalAttachmentMessage(conversation.id, {
                clientMessageId,
                displayName: normalizedDisplayName,
                messageType: normalizedMessageType,
                payload,
                status: 'failed',
                error: errorMessage,
            })
        }
        throw new Error(errorMessage)
    }

    if (options.existingClientMessageId) {
        options.updateLocalMessageStatus(conversation.id, clientMessageId, 'sending')
    } else {
        options.insertLocalAttachmentMessage(conversation.id, {
            clientMessageId,
            displayName: normalizedDisplayName,
            messageType: normalizedMessageType,
            payload,
            status: 'sending',
        })
    }

    let sourceAssetReferenceId = options.sourceAssetReferenceId || 0
    if (!sourceAssetReferenceId && options.uploadBeforeSend) {
        try {
            const uploadPayload = await options.uploadBeforeSend((payloadPatch) => {
                options.updateLocalAttachmentPayload(conversation.id, clientMessageId, payloadPatch)
            })
            sourceAssetReferenceId = uploadPayload.sourceAssetReferenceId
            options.updateLocalAttachmentPayload(conversation.id, clientMessageId, {
                asset_reference_id: sourceAssetReferenceId,
                source_asset_reference_id: sourceAssetReferenceId,
                display_name: uploadPayload.displayName || normalizedDisplayName,
                media_type: uploadPayload.mediaType || options.mediaType,
                mime_type: uploadPayload.mimeType || options.mimeType || '',
                file_size: uploadPayload.fileSize || options.fileSize,
                url: uploadPayload.url || options.url,
                stream_url: uploadPayload.streamUrl || '',
                thumbnail_url: uploadPayload.thumbnailUrl || '',
                processing_status: uploadPayload.processingStatus || '',
                upload_progress: 100,
                upload_phase: 'sending',
            })
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '上传附件失败'
            options.updateLocalMessageStatus(conversation.id, clientMessageId, 'failed', errorMessage)
            options.clearSendingState()
            throw error instanceof Error ? error : new Error(errorMessage)
        }
    }
    if (!sourceAssetReferenceId) {
        const errorMessage = '上传完成但未返回资产引用，无法发送附件'
        options.updateLocalMessageStatus(conversation.id, clientMessageId, 'failed', errorMessage)
        throw new Error(errorMessage)
    }

    options.setSending(true)
    options.scheduleFallback(conversation.id, clientMessageId)
    const sent = globalWebSocket.send({
        type: 'chat_send_asset_message',
        conversation_id: conversation.id,
        asset_reference_id: sourceAssetReferenceId,
        client_message_id: clientMessageId,
        quoted_message_id: options.quotedMessageId,
    })
    if (!sent) {
        const errorMessage = getWebSocketUnavailableFailure('asset')
        options.updateLocalMessageStatus(conversation.id, clientMessageId, 'failed', errorMessage)
        options.clearSendingState()
        throw new Error(errorMessage)
    }
    options.scheduleSync(conversation.id, clientMessageId)
}