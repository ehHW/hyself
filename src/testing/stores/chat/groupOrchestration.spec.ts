import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createGroupOrchestration } from '@/stores/chat/groupOrchestration'
import * as chatApi from '@/api/chat'

describe('group orchestration', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('skips global join request loading when current user lacks permission', async () => {
        const getGroupJoinRequestsApi = vi.spyOn(chatApi, 'getGroupJoinRequestsApi')
        const runtime = createGroupOrchestration({
            canLoadGlobalGroupJoinRequests: () => false,
            globalGroupJoinRequests: ref([{ id: 1 }] as any[]),
            conversations: ref([]),
            memberMap: {},
            joinRequestMap: {},
            loadConversations: async () => undefined,
            loadContactGroupConversations: async () => undefined,
        })

        await runtime.loadGlobalGroupJoinRequests()

        expect(getGroupJoinRequestsApi).not.toHaveBeenCalled()
    })
})