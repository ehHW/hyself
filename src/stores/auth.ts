import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import router from '@/router'
import { loginApi, permissionContextApi, profileApi, refreshTokenApi } from '@/api/user'
import { useChatStore } from '@/stores/chat'
import { useSettingsStore } from '@/stores/settings'
import { useUserStore } from '@/stores/user'
import { globalWebSocket } from '@/utils/websocket'

const getEnvelopeMessage = (payload: { message?: unknown; payload?: unknown }, fallback: string) => {
    const nestedPayload = payload.payload
    if (nestedPayload && typeof nestedPayload === 'object' && 'message' in nestedPayload) {
        const nestedMessage = (nestedPayload as { message?: unknown }).message
        if (nestedMessage) {
            return String(nestedMessage)
        }
    }
    if (payload.message) {
        return String(payload.message)
    }
    return fallback
}

export const useAuthStore = defineStore(
    'auth',
    () => {
        const accessToken = ref<string>('')
        const refreshToken = ref<string>('')
        const userStore = useUserStore()
        const settingsStore = useSettingsStore()
        let wsUnsubscribe: (() => void) | null = null

        const isLogin = computed(() => Boolean(accessToken.value))

        const setTokens = (access: string, refresh: string) => {
            accessToken.value = access
            refreshToken.value = refresh
        }

        const clearAuth = () => {
            const chatStore = useChatStore()
            if (wsUnsubscribe) {
                wsUnsubscribe()
                wsUnsubscribe = null
            }
            globalWebSocket.disconnect()
            accessToken.value = ''
            refreshToken.value = ''
            userStore.clearUser()
            chatStore.lifecycle.reset()
        }

        const ensureGlobalWsListener = () => {
            if (wsUnsubscribe) {
                return
            }
            wsUnsubscribe = globalWebSocket.subscribe((payload) => {
                if (payload.type !== 'event') {
                    return
                }

                if (payload.event_type === 'user.permission.updated') {
                    void fetchProfile().catch(() => undefined)
                    return
                }

                if (payload.event_type !== 'system.force_logout') {
                    return
                }

                const forceLogoutMessage = getEnvelopeMessage(payload, '您的账号已被强制下线')
                clearAuth()
                if (router.currentRoute.value.path !== '/login') {
                    router.push('/login')
                }
                message.warning(forceLogoutMessage)
            })
        }

        const login = async (username: string, password: string) => {
            const { data } = await loginApi({ username, password })
            setTokens(data.access, data.refresh)
            userStore.setUser(data.user)
            await fetchPermissionContext()
            globalWebSocket.connect(data.access, true)
            ensureGlobalWsListener()
            void useChatStore().lifecycle.bootstrapSummaries()
            return data
        }

        const refreshAccessToken = async () => {
            if (!refreshToken.value) {
                throw new Error('refresh token 不存在')
            }
            const { data } = await refreshTokenApi(refreshToken.value)
            accessToken.value = data.access
            globalWebSocket.updateToken(data.access)
            if (data.refresh) {
                refreshToken.value = data.refresh
            }
            return data.access
        }

        const fetchPermissionContext = async () => {
            if (!accessToken.value) return null
            const { data } = await permissionContextApi()
            userStore.setAccessContext(data)
            return data
        }

        const fetchProfile = async () => {
            if (!accessToken.value) return null
            const { data } = await profileApi()
            userStore.setUser(data)
            await fetchPermissionContext()
            globalWebSocket.connect(accessToken.value)
            ensureGlobalWsListener()
            void useChatStore().lifecycle.bootstrapSummaries()
            return data
        }

        const refreshSessionContext = async () => {
            if (!accessToken.value) return null

            const [profile] = await Promise.all([
                fetchProfile(),
                settingsStore.loadChatPreferences().catch(() => null),
            ])
            return profile
        }

        const hasPermission = (code: string) => userStore.hasPermission(code)

        return {
            accessToken,
            refreshToken,
            isLogin,
            login,
            clearAuth,
            ensureGlobalWsListener,
            fetchProfile,
            fetchPermissionContext,
            refreshSessionContext,
            refreshAccessToken,
            hasPermission,
            setTokens,
        }
    },
    {
        persist: true,
    }
)
