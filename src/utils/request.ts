import axios from 'axios'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'

axios.defaults.withCredentials = true

const instance = axios.create({
    baseURL: '/api/',
    timeout: 5000,
    withCredentials: true,
})

// export const instance2 = axios.create({
//     baseURL: 'http://127.0.0.1:8000',
//     timeout: 5000,
// })

// 请求拦截器
instance.interceptors.request.use((config) => {
    const authStore = useAuthStore()
    if (authStore.accessToken) {
        config.headers.Authorization = `Bearer ${authStore.accessToken}`
    }
    return config
})

// 响应拦截器
instance.interceptors.response.use(
    (res) => {
        return res
    },
    async (error) => {
        const authStore = useAuthStore()
        const originalRequest = error.config

        if (
            error.response?.status === 403 &&
            error.response?.data?.error_code === 'permission_denied' &&
            !originalRequest?._permissionContextRetried
        ) {
            originalRequest._permissionContextRetried = true
            try {
                await authStore.fetchPermissionContext()
            } catch {
                // Keep original permission denied error if context refresh fails.
            }
        }

        if (
            error.response?.status === 401 &&
            !originalRequest?._retry &&
            originalRequest?.url !== 'auth/refresh/'
        ) {
            originalRequest._retry = true
            try {
                const newAccess = await authStore.refreshAccessToken()
                originalRequest.headers.Authorization = `Bearer ${newAccess}`
                return instance(originalRequest)
            } catch (_refreshError) {
                authStore.clearAuth()
                router.push('/login')
            }
        }

        return Promise.reject(error)
    },
)

export default instance
