import { message } from 'ant-design-vue'
import router from '@/router'
import { getEnvelopeMessage } from '@/realtime/envelope'
import { subscribeToRealtimeEvent } from '@/realtime/dispatcher'

export function createAuthRealtimeRuntime(options: {
    refreshProfile: () => Promise<void>
    forceLogout: () => void
}) {
    let unsubscribe: (() => void) | null = null

    const ensureSubscription = () => {
        if (unsubscribe) {
            return
        }
        const stops = [
            subscribeToRealtimeEvent('user.permission.updated', () => {
                void options.refreshProfile().catch(() => undefined)
            }),
            subscribeToRealtimeEvent('system.force_logout', ({ raw }) => {
                const forceLogoutMessage = getEnvelopeMessage(raw, '您的账号已被强制下线')
                options.forceLogout()
                if (router.currentRoute.value.path !== '/login') {
                    router.push('/login')
                }
                message.warning(forceLogoutMessage)
            }),
        ]
        unsubscribe = () => {
            stops.forEach((stop) => stop())
            unsubscribe = null
        }
    }

    const dispose = () => {
        unsubscribe?.()
        unsubscribe = null
    }

    return {
        ensureSubscription,
        dispose,
    }
}