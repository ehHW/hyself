import { createRouter, createWebHistory } from 'vue-router'
import { message } from 'ant-design-vue'
import { startProgress, closeProgress } from '@/utils/nprogress'
import { routes } from '@/router/routes'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
})

const shouldShowAccessDeniedMessage = (from: { matched: unknown[] }) => {
    return from.matched.length > 0
}

const resolveEntertainmentLanding = (userStore: ReturnType<typeof useUserStore>) => {
    if (userStore.hasMenuAccess('entertainment_game_2048')) {
        return { name: 'EntertainmentGame2048' }
    }
    if (userStore.hasMenuAccess('entertainment_music')) {
        return { name: 'EntertainmentMusic' }
    }
    if (userStore.hasMenuAccess('entertainment_video')) {
        return { name: 'EntertainmentVideo' }
    }
    return null
}

router.beforeEach(async (to, from) => {
    const disableProgress = to.matched.some((item) => item.meta?.disableProgress)
    if (!disableProgress) {
        startProgress()
    }
    const authStore = useAuthStore()
    const userStore = useUserStore()

    if (to.path === '/login' && authStore.isLogin) {
        return '/home'
    }

    if (to.meta.requiresAuth !== false && !authStore.isLogin) {
        return '/login'
    }

    const isInitialAuthenticatedNavigation = authStore.isLogin && from.matched.length === 0

    if (authStore.isLogin && (isInitialAuthenticatedNavigation || !userStore.user || !userStore.accessContextLoaded)) {
        try {
            await authStore.fetchProfile()
        } catch {
            authStore.clearAuth()
            return '/login'
        }
    }

    if (to.path === '/entertainment') {
        const target = resolveEntertainmentLanding(userStore)
        if (target) {
            return target
        }
        return '/home'
    }

    const permissionCode = typeof to.meta.permissionCode === 'string' ? to.meta.permissionCode : ''
    if (permissionCode && !authStore.hasPermission(permissionCode)) {
        if (shouldShowAccessDeniedMessage(from)) {
            message.warning('当前页面无访问权限，已返回首页')
        }
        return '/home'
    }

    const menuKey = typeof to.meta.menuKey === 'string' ? to.meta.menuKey : ''
    if (menuKey && !userStore.hasMenuAccess(menuKey)) {
        if (shouldShowAccessDeniedMessage(from)) {
            message.warning('当前页面无访问权限，已返回首页')
        }
        return '/home'
    }

    if (to.matched.some((item) => item.meta?.superuserOnly) && !userStore.isSuperuser) {
        if (shouldShowAccessDeniedMessage(from)) {
            message.warning('当前页面无访问权限，已返回首页')
        }
        return '/home'
    }
})

router.afterEach((to) => {
    if (!to.matched.some((item) => item.meta?.disableProgress)) {
        closeProgress()
    }
})

export default router
