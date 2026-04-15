import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { loginApi, permissionContextApi, profileApi, refreshTokenApi } from '@/api/user'
import { createAuthRealtimeRuntime } from '@/stores/authRealtimeRuntime'
import { useChatStore } from '@/stores/chat'
import { useSettingsStore } from '@/stores/settings'
import { useUserStore } from '@/stores/user'
import { globalWebSocket } from '@/utils/websocket'

export const useAuthStore = defineStore(
    'auth',
    () => {
        const accessToken = ref<string>('')
        const refreshToken = ref<string>('')
        const userStore = useUserStore()
        const settingsStore = useSettingsStore()
        let wsUnsubscribe: (() => void) | null = null
        const authRealtimeRuntime = createAuthRealtimeRuntime({
            refreshProfile: async () => {
                await fetchProfile()
            },
            forceLogout: () => {
                clearAuth()
            },
        })

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
            authRealtimeRuntime.dispose()
            globalWebSocket.disconnect()
            settingsStore.markSessionSettingsStale()
            accessToken.value = ''
            refreshToken.value = ''
            userStore.clearUser()
            chatStore.lifecycle.reset()
        }

        const ensureGlobalWsListener = () => {
            if (wsUnsubscribe) {
                return
            }
            authRealtimeRuntime.ensureSubscription()
            wsUnsubscribe = () => {
                authRealtimeRuntime.dispose()
                wsUnsubscribe = null
            }
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
            settingsStore.applySessionContext(data)
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
            return fetchProfile()
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
