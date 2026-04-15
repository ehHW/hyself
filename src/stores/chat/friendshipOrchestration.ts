import type { Ref } from 'vue'
import { loadFriendRequestsAction, loadFriendsAction, markSeenIdsAction, markStringSeenIdsAction } from '@/stores/chat/friendshipActions'
import { handleFriendRequestScene, removeFriendScene, submitFriendRequestScene, updateFriendRemarkScene } from '@/stores/chat/friendshipScenes'
import type { ChatConversationItem, ChatFriendNoticeItem, ChatFriendRequestItem, ChatFriendshipItem } from '@/types/chat'

function buildFriendRequestNotice(item: ChatFriendRequestItem, kind: 'received' | 'sent'): ChatFriendNoticeItem {
    const actorName = kind === 'received'
        ? (item.from_user.display_name || item.from_user.username)
        : (item.to_user.display_name || item.to_user.username)
    const actionLabel = item.status === 'accepted'
        ? '已通过'
        : item.status === 'rejected'
            ? '已拒绝'
            : item.status === 'canceled'
                ? '已撤销'
                : item.status === 'expired'
                    ? '已过期'
                    : '已处理'
    const title = kind === 'received'
        ? `${actorName} 的好友申请${actionLabel}`
        : `你发给 ${actorName} 的好友申请${actionLabel}`

    return {
        id: `friend-request-${kind}-${item.id}-${item.status}`,
        title,
        description: item.request_message || '无附言',
        created_at: item.handled_at || item.created_at,
        payload: {
            notice_type: `friend_request_${item.status}`,
            request_direction: kind,
            request_id: item.id,
            request: item,
        },
    }
}

export function createFriendshipOrchestration(deps: {
    friends: Ref<ChatFriendshipItem[]>
    receivedRequests: Ref<ChatFriendRequestItem[]>
    sentRequests: Ref<ChatFriendRequestItem[]>
    friendNoticeItems: Ref<ChatFriendNoticeItem[]>
    seenFriendNoticeIds: Ref<number[]>
    seenFriendSystemNoticeIds: Ref<string[]>
    seenPendingRequestIds: Ref<number[]>
    conversations: Ref<ChatConversationItem[]>
    syncFriendRemarkLocally: (friendUserId: number, remark: string) => void
    loadConversations: () => Promise<void>
    loadContactGroupConversations: () => Promise<void>
}) {
    const loadFriends = async () => {
        await loadFriendsAction(deps.friends)
    }

    const loadFriendRequests = async () => {
        const previousReceived = new Map(deps.receivedRequests.value.map((item) => [item.id, item.status]))
        const previousSent = new Map(deps.sentRequests.value.map((item) => [item.id, item.status]))
        const hasLoadedRequestsBefore = previousReceived.size > 0 || previousSent.size > 0
        await loadFriendRequestsAction({
            receivedRequests: deps.receivedRequests,
            sentRequests: deps.sentRequests,
            seenFriendNoticeIds: deps.seenFriendNoticeIds,
            seenPendingRequestIds: deps.seenPendingRequestIds,
        })
        if (!hasLoadedRequestsBefore) {
            return
        }
        for (const item of deps.receivedRequests.value) {
            const previousStatus = previousReceived.get(item.id)
            if (item.status !== 'pending' && previousStatus !== item.status) {
                appendFriendNotice(buildFriendRequestNotice(item, 'received'))
            }
        }
        for (const item of deps.sentRequests.value) {
            const previousStatus = previousSent.get(item.id)
            if (item.status !== 'pending' && previousStatus !== item.status) {
                appendFriendNotice(buildFriendRequestNotice(item, 'sent'))
            }
        }
    }

    const markPendingRequestsSeen = (requestIds: number[]) => {
        markSeenIdsAction(deps.seenPendingRequestIds, requestIds)
    }

    const markFriendNoticesSeen = (requestIds: number[]) => {
        markSeenIdsAction(deps.seenFriendNoticeIds, requestIds)
    }

    const appendFriendNotice = (notice: ChatFriendNoticeItem) => {
        deps.friendNoticeItems.value = [notice, ...deps.friendNoticeItems.value.filter((item) => item.id !== notice.id)].slice(0, 100)
    }

    const markFriendSystemNoticesSeen = (noticeIds: string[]) => {
        markStringSeenIdsAction(deps.seenFriendSystemNoticeIds, noticeIds)
    }

    const submitFriendRequest = async (toUserId: number, requestMessage?: string) => {
        await submitFriendRequestScene({ toUserId, requestMessage, loadFriendRequests })
    }

    const handleFriendRequest = async (requestId: number, action: 'accept' | 'reject' | 'cancel') => {
        await handleFriendRequestScene({ requestId, action, loadFriendRequests, loadFriends, loadConversations: deps.loadConversations, loadContactGroupConversations: deps.loadContactGroupConversations })
    }

    const removeFriend = async (friendUserId: number) => {
        await removeFriendScene({ friendUserId, loadFriends, loadConversations: deps.loadConversations })
    }

    const updateFriendRemark = async (friendUserId: number, remark: string) => {
        await updateFriendRemarkScene({ friendUserId, remark, friends: deps.friends, conversations: deps.conversations, syncFriendRemarkLocally: deps.syncFriendRemarkLocally })
    }

    return {
        loadFriends,
        loadFriendRequests,
        markPendingRequestsSeen,
        markFriendNoticesSeen,
        appendFriendNotice,
        markFriendSystemNoticesSeen,
        submitFriendRequest,
        handleFriendRequest,
        removeFriend,
        updateFriendRemark,
    }
}