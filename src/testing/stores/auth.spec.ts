import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'

const mocks = vi.hoisted(() => ({
    loginApi: vi.fn(),
    permissionContextApi: vi.fn(),
    profileApi: vi.fn(),
    refreshTokenApi: vi.fn(),
    subscribe: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    updateToken: vi.fn(),
    warning: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    bootstrapSummaries: vi.fn(),
    resetLifecycle: vi.fn(),
    loadChatPreferences: vi.fn(),
}))

vi.mock('ant-design-vue', () => ({
    message: {
        warning: mocks.warning,
    },
}))

vi.mock('@/api/user', () => ({
    loginApi: mocks.loginApi,
    permissionContextApi: mocks.permissionContextApi,
    profileApi: mocks.profileApi,
    refreshTokenApi: mocks.refreshTokenApi,
}))

vi.mock('@/router', () => ({
    default: {
        currentRoute: {
            value: {
                path: '/chat',
            },
        },
        push: mocks.push,
        replace: mocks.replace,
    },
}))

vi.mock('@/stores/chat', () => ({
    useChatStore: () => ({
        lifecycle: {
            bootstrapSummaries: mocks.bootstrapSummaries,
            reset: mocks.resetLifecycle,
        },
    }),
}))

vi.mock('@/stores/settings', () => ({
    useSettingsStore: () => ({
        loadChatPreferences: mocks.loadChatPreferences,
    }),
}))

let wsListener: ((payload: Record<string, unknown>) => void) | null = null

vi.mock('@/utils/websocket', () => ({
    globalWebSocket: {
        subscribe: (listener: (payload: Record<string, unknown>) => void) => {
            mocks.subscribe(listener)
            wsListener = listener
            return vi.fn()
        },
        connect: mocks.connect,
        disconnect: mocks.disconnect,
        updateToken: mocks.updateToken,
    },
}))

const buildUser = () => ({
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    display_name: 'Alice',
    avatar: '',
    phone_number: '',
    is_active: true,
    is_staff: false,
    is_superuser: false,
    roles: [],
    created_at: '',
    updated_at: '',
    deleted_at: null,
})

const flushPromises = async () => {
    await Promise.resolve()
    await nextTick()
}

describe('useAuthStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        wsListener = null
        vi.clearAllMocks()
        mocks.permissionContextApi.mockResolvedValue({
            data: {
                permission_codes: ['file.view_resource'],
                visible_menu_keys: ['resource-center'],
            },
        })
        mocks.profileApi.mockResolvedValue({
            data: buildUser(),
        })
        mocks.loadChatPreferences.mockResolvedValue(null)
    })

    it('refreshes profile and permission context on user.permission.updated', async () => {
        const authStore = useAuthStore()
        const userStore = useUserStore()

        authStore.setTokens('access-token', 'refresh-token')
        authStore.ensureGlobalWsListener()

        wsListener?.({
            type: 'event',
            event_type: 'user.permission.updated',
            payload: {},
        })
        await flushPromises()

        expect(mocks.profileApi).toHaveBeenCalledTimes(1)
        expect(mocks.permissionContextApi).toHaveBeenCalledTimes(1)
        expect(mocks.connect).toHaveBeenCalledWith('access-token')
        expect(mocks.bootstrapSummaries).toHaveBeenCalledTimes(1)
        expect(userStore.permissionCodes).toEqual(['file.view_resource'])
        expect(userStore.visibleMenuKeys).toEqual(['resource-center'])
    })

    it('clears auth state on system.force_logout envelope', async () => {
        const authStore = useAuthStore()
        const userStore = useUserStore()

        authStore.setTokens('access-token', 'refresh-token')
        userStore.setUser(buildUser())
        authStore.ensureGlobalWsListener()

        wsListener?.({
            type: 'event',
            event_type: 'system.force_logout',
            payload: {
                message: '管理员已强制下线',
            },
        })
        await flushPromises()

        expect(authStore.accessToken).toBe('')
        expect(authStore.refreshToken).toBe('')
        expect(userStore.user).toBeNull()
        expect(mocks.disconnect).toHaveBeenCalledTimes(1)
        expect(mocks.resetLifecycle).toHaveBeenCalledTimes(1)
        expect(mocks.push).toHaveBeenCalledWith('/login')
        expect(mocks.warning).toHaveBeenCalledWith('管理员已强制下线')
    })
})