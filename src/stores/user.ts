import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { PermissionContext, UserItem } from '@/types/user'

export const useUserStore = defineStore(
    'user',
    () => {
        const user = ref<UserItem | null>(null)
        const permissionCodes = ref<string[]>([])
        const visibleMenuKeys = ref<string[]>([])
        const accessContextLoaded = ref(false)

        const isSuperuser = computed(() => Boolean(user.value?.is_superuser))

        const setUser = (nextUser: UserItem | null) => {
            user.value = nextUser
        }

        const setAccessContext = (context: PermissionContext | null) => {
            permissionCodes.value = context?.permission_codes || []
            visibleMenuKeys.value = context?.visible_menu_keys || []
            accessContextLoaded.value = Boolean(context)
        }

        const clearUser = () => {
            user.value = null
            permissionCodes.value = []
            visibleMenuKeys.value = []
            accessContextLoaded.value = false
        }

        const hasPermission = (code: string) => {
            if (!user.value) return false
            if (user.value.is_superuser) return true
            if (!code) return true
            return permissionCodes.value.includes(code)
        }

        const hasMenuAccess = (menuKey: string) => {
            if (!user.value) return false
            if (user.value.is_superuser) return true
            if (!menuKey) return true
            return visibleMenuKeys.value.includes(menuKey)
        }

        return {
            user,
            permissionCodes,
            visibleMenuKeys,
            accessContextLoaded,
            isSuperuser,
            setUser,
            setAccessContext,
            clearUser,
            hasPermission,
            hasMenuAccess,
        }
    },
    {
        persist: true,
    },
)
