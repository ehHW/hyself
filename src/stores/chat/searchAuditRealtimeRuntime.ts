import { subscribeToRealtimeEvent } from '@/realtime/dispatcher'
import { createRealtimeRefreshScheduler } from '@/realtime/refreshScheduler'
import { shouldRefreshSearchOrAuditForFriendshipEvent } from '@/stores/chat/realtimeFriendshipHandlers'
import { shouldRefreshSearchOrAuditForMessageEvent } from '@/stores/chat/realtimeMessageHandlers'
import { shouldRefreshSearchOrAuditForNoticeEvent } from '@/stores/chat/realtimeNoticeHandlers'

const SEARCH_REFRESH_EVENTS = [
    'chat.message.ack',
    'chat.message.created',
    'chat.message.updated',
    'chat.conversation.updated',
    'chat.unread.updated',
    'chat.friend_request.updated',
    'chat.friendship.updated',
    'chat.group_join_request.updated',
    'chat.system_notice.created',
] as const

export function createChatSearchAuditRealtimeRuntime(options: {
    hasActiveSearch: () => boolean
    refreshSearch: () => Promise<void>
    hasActiveAudit: () => boolean
    refreshAudit: () => Promise<void>
    delayMs?: number
}) {
    let unsubscribes: Array<() => void> = []
    const delayMs = options.delayMs ?? 300
    const searchScheduler = createRealtimeRefreshScheduler({
        delayMs,
        shouldRun: options.hasActiveSearch,
        run: options.refreshSearch,
    })
    const auditScheduler = createRealtimeRefreshScheduler({
        delayMs,
        shouldRun: options.hasActiveAudit,
        run: options.refreshAudit,
    })

    const handleEvent = (eventType: string) => {
        if (
            shouldRefreshSearchOrAuditForMessageEvent(eventType)
            || shouldRefreshSearchOrAuditForFriendshipEvent(eventType)
            || shouldRefreshSearchOrAuditForNoticeEvent(eventType)
        ) {
            searchScheduler.schedule()
            auditScheduler.schedule()
        }
    }

    const ensureSubscription = () => {
        if (unsubscribes.length) {
            return
        }
        unsubscribes = SEARCH_REFRESH_EVENTS.map((eventType) => subscribeToRealtimeEvent(eventType, () => {
            handleEvent(eventType)
        }))
    }

    const dispose = () => {
        unsubscribes.forEach((unsubscribe) => unsubscribe())
        unsubscribes = []
        searchScheduler.dispose()
        auditScheduler.dispose()
    }

    return {
        ensureSubscription,
        dispose,
    }
}