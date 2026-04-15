import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@/modules/chat-center/composables/useContactFriendNoticesScene', () => ({
    useContactFriendNoticesScene: () => ({
        formatDateTime: (value: string) => `fmt:${value}`,
        friendNoticeItems: ref([
            {
                id: 'notice-1',
                kind: 'received',
                title: '好友申请已通过',
                description: '管理员甲已通过你的好友申请',
                created_at: '2026-04-15T09:00:00Z',
            },
        ]),
        receivedHistory: ref([
            {
                id: 11,
                status: 'pending',
                created_at: '2026-04-15T08:00:00Z',
                request_message: '一起处理工单',
                from_user: {
                    username: 'ops_a',
                    display_name: '运维甲',
                },
            },
        ]),
        sentHistory: ref([
            {
                id: 12,
                status: 'accepted',
                created_at: '2026-04-15T07:00:00Z',
                request_message: '请加我',
                to_user: {
                    username: 'ops_b',
                    display_name: '运维乙',
                },
            },
        ]),
        handleRequestAction: vi.fn(),
        statusColorMap: {
            accepted: 'success',
            rejected: 'error',
            canceled: 'default',
            expired: 'warning',
        },
        statusLabelMap: {
            pending: '待处理',
            accepted: '已通过',
            rejected: '已拒绝',
            canceled: '已撤销',
            expired: '已过期',
        },
    }),
}))

import ContactFriendNoticesWorkspace from '@/views/Chat/components/ContactFriendNoticesWorkspace.vue'

describe('ContactFriendNoticesWorkspace', () => {
    it('renders separated notice cards and history sections', () => {
        const wrapper = shallowMount(ContactFriendNoticesWorkspace)

        const blockTitles = wrapper.findAll('.notice-block__title').map((item) => item.text())
        expect(blockTitles).toEqual(['通知卡片', '历史申请记录'])

        expect(wrapper.text()).toContain('好友申请已通过')
        expect(wrapper.text()).toContain('管理员甲已通过你的好友申请')
        expect(wrapper.text()).toContain('收到的申请')
        expect(wrapper.text()).toContain('发出的申请')
        expect(wrapper.text()).toContain('运维甲')
        expect(wrapper.text()).toContain('运维乙')
        expect(wrapper.findAll('.notice-card')).toHaveLength(1)
        expect(wrapper.findAll('.history-column')).toHaveLength(2)
    })
})