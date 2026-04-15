import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('ant-design-vue', () => ({
    message: {
        error: vi.fn(),
    },
}))

function flushPromises() {
    return Promise.resolve()
}

async function mountChatShell(options: {
    bootstrap?: boolean
    routeName?: string
    initializeImpl?: () => Promise<void>
}) {
    vi.resetModules()

    const chatStore = {
        state: {
            conversationState: reactive({
                activeConversationId: 12,
                activeConversation: {
                    id: 12,
                    member_role: 'admin',
                },
            }),
            messageState: reactive({
                activeMessages: [{ id: 1, sequence: 3, sender: { id: 7 }, is_system: false }],
                typingUsers: [{ id: 8, display_name: '李雷', username: 'lilei' }],
            }),
        },
        lifecycle: {
            initialized: false,
            initialize: vi.fn(options.initializeImpl || (async () => undefined)),
        },
        audit: {
            isAuditAvailable: true,
        },
        conversation: {
            loadConversations: vi.fn(async () => undefined),
        },
        message: {
            sendTyping: vi.fn(),
        },
    }
    const settingsStore = reactive({
        chatListSortMode: 'recent' as 'recent' | 'unread',
        loadSessionSettings: vi.fn(async () => undefined),
    })
    const userStore = {
        user: {
            id: 7,
            username: 'tester',
            display_name: '测试用户',
            avatar: '',
        },
    }
    const replace = vi.fn(async () => undefined)

    vi.doMock('@/stores/chat', () => ({
        useChatStore: () => chatStore,
    }))
    vi.doMock('@/stores/settings', () => ({
        useSettingsStore: () => settingsStore,
    }))
    vi.doMock('@/stores/user', () => ({
        useUserStore: () => userStore,
    }))
    vi.doMock('vue-router', () => ({
        useRouter: () => ({ replace }),
        useRoute: () => ({ name: options.routeName || 'ChatMessages' }),
    }))

    const { useChatShellScene } = await import('@/modules/chat-center/composables/useChatShellScene')

    let exposed: any
    const wrapper = mount(defineComponent({
        setup() {
            exposed = useChatShellScene({ bootstrap: options.bootstrap })
            return () => null
        },
    }))

    await nextTick()
    await flushPromises()

    return {
        wrapper,
        exposed,
        chatStore,
        settingsStore,
        replace,
    }
}

describe('useChatShellScene', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('derives chat shell helpers from current state without bootstrap side effects', async () => {
        const { exposed } = await mountChatShell({ bootstrap: false })

        expect(exposed.avatarText('alice')).toBe('A')
        expect(exposed.avatarStyle('group')).toEqual({ backgroundColor: '#154c79' })
        expect(exposed.isSelfMessage({ sender: { id: 7 } })).toBe(true)
        expect(exposed.messageRowClass({ sender: { id: 7 }, is_system: false })).toEqual({ self: true, system: false })
        expect(exposed.canManageMembers.value).toBe(true)
        expect(exposed.canEditRoles.value).toBe(false)
        expect(exposed.canLoadOlderMessages.value).toBe(true)
        expect(exposed.typingText.value).toBe('李雷 正在输入...')
        expect(exposed.isStealthAuditEnabled.value).toBe(true)
    })

    it('bootstraps lifecycle, reacts to sort changes, and stops typing on unmount', async () => {
        const { wrapper, chatStore, settingsStore, replace } = await mountChatShell({
            bootstrap: true,
            routeName: 'ChatCenter',
        })

        expect(settingsStore.loadSessionSettings).toHaveBeenCalledOnce()
        expect(chatStore.lifecycle.initialize).toHaveBeenCalledWith('recent')
        expect(replace).toHaveBeenCalledWith({ name: 'ChatMessages' })

        settingsStore.chatListSortMode = 'unread'
        await nextTick()

        expect(chatStore.conversation.loadConversations).toHaveBeenCalledWith('unread')

        wrapper.unmount()

        expect(chatStore.message.sendTyping).toHaveBeenCalledWith(false)
    })

    it('surfaces bootstrap initialization errors through toast', async () => {
        const { message } = await import('ant-design-vue')

        await mountChatShell({
            bootstrap: true,
            initializeImpl: async () => {
                throw new Error('boom')
            },
        })

        expect(message.error).toHaveBeenCalledWith('boom')
    })
})