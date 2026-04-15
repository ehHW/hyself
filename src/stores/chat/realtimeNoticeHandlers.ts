import { message as antMessage } from 'ant-design-vue'
import type { ChatRealtimeEventHandler } from '@/stores/chat/realtimeShared'

export const handleSystemNoticeCreatedEvent: ChatRealtimeEventHandler = (payload, options) => {
    if (payload.category !== 'chat' || !payload.message) {
        return
    }
    const noticePayload = (payload.payload || {}) as Record<string, unknown>
    const noticeType = String(noticePayload.notice_type || '')
    if (noticeType.startsWith('friend_')) {
        options.appendFriendNotice({
            id: String(noticePayload.notice_id || `${Date.now()}_${Math.random().toString(16).slice(2)}`),
            title: String(payload.message),
            description: String(noticePayload.description || ''),
            created_at: typeof payload.occurred_at === 'string' ? payload.occurred_at : new Date().toISOString(),
            payload: noticePayload,
        })
        antMessage.info(String(payload.message))
        return
    }
    options.appendGroupNotice({
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        conversation_id: typeof noticePayload.conversation_id === 'number' ? noticePayload.conversation_id : null,
        message: String(payload.message),
        created_at: typeof payload.occurred_at === 'string' ? payload.occurred_at : new Date().toISOString(),
        payload: noticePayload,
    })
    antMessage.info(String(payload.message))
}

export const NOTICE_EVENT_HANDLERS: Record<string, ChatRealtimeEventHandler> = {
    'chat.system_notice.created': handleSystemNoticeCreatedEvent,
}

export function shouldRefreshSearchOrAuditForNoticeEvent(eventType: string) {
    return eventType === 'chat.system_notice.created'
}