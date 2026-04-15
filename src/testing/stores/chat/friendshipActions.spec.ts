import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { ChatFriendRequestItem } from '@/types/chat'

vi.mock('@/api/chat', () => ({
    getFriendRequestsApi: vi.fn(),
}))

import { getFriendRequestsApi } from '@/api/chat'
import { loadFriendRequestsAction } from '@/stores/chat/friendshipActions'

const buildFriendRequest = (overrides: Partial<ChatFriendRequestItem>): ChatFriendRequestItem => ({
    id: 1,
    status: 'pending',
    from_user: { id: 101, username: 'from_user', display_name: '发起人', avatar: '' },
    to_user: { id: 102, username: 'to_user', display_name: '接收人', avatar: '' },
    request_message: '',
    auto_accepted: false,
    handled_by: null,
    handled_at: null,
    created_at: '2026-04-15T00:00:00Z',
    ...overrides,
})

describe('loadFriendRequestsAction', () => {
    it('seeds historical handled requests as seen during initial bootstrap', async () => {
        vi.mocked(getFriendRequestsApi)
            .mockResolvedValueOnce({
                data: {
                    results: [
                        buildFriendRequest({ id: 11, status: 'accepted' }),
                        buildFriendRequest({ id: 12, status: 'pending' }),
                    ],
                },
            } as never)
            .mockResolvedValueOnce({
                data: {
                    results: [
                        buildFriendRequest({ id: 21, status: 'rejected' }),
                    ],
                },
            } as never)

        const receivedRequests = ref<ChatFriendRequestItem[]>([])
        const sentRequests = ref<ChatFriendRequestItem[]>([])
        const seenFriendNoticeIds = ref<number[]>([])
        const seenPendingRequestIds = ref<number[]>([])

        await loadFriendRequestsAction({
            receivedRequests,
            sentRequests,
            seenFriendNoticeIds,
            seenPendingRequestIds,
        })

        expect(seenFriendNoticeIds.value).toEqual([11, 21])
        expect(seenPendingRequestIds.value).toEqual([])
    })

    it('does not auto-mark newly refreshed handled requests after initial load', async () => {
        vi.mocked(getFriendRequestsApi)
            .mockResolvedValueOnce({
                data: {
                    results: [
                        buildFriendRequest({ id: 11, status: 'accepted' }),
                    ],
                },
            } as never)
            .mockResolvedValueOnce({
                data: {
                    results: [],
                },
            } as never)

        const receivedRequests = ref<ChatFriendRequestItem[]>([buildFriendRequest({ id: 5, status: 'pending' })])
        const sentRequests = ref<ChatFriendRequestItem[]>([])
        const seenFriendNoticeIds = ref<number[]>([])
        const seenPendingRequestIds = ref<number[]>([5])

        await loadFriendRequestsAction({
            receivedRequests,
            sentRequests,
            seenFriendNoticeIds,
            seenPendingRequestIds,
        })

        expect(seenFriendNoticeIds.value).toEqual([])
        expect(seenPendingRequestIds.value).toEqual([])
    })
})