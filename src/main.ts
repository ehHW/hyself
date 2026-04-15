import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { watch } from 'vue'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

import App from './App.vue'
import router from './router'

import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'

import '@/assets/css/base.css'
import '@/assets/css/icon-theme.css'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(pinia)
app.use(router)
app.use(Antd)

app.mount('#app')

const settingsStore = useSettingsStore(pinia)

const disableDefaultContextMenu = (event: MouseEvent) => {
    event.preventDefault()
}

document.addEventListener('contextmenu', disableDefaultContextMenu)

watch(
    () => settingsStore.themeMode,
    (mode) => {
        document.documentElement.setAttribute('data-theme', mode)
    },
    { immediate: true },
)

const bootstrapAuth = async () => {
    const authStore = useAuthStore(pinia)
    if (!authStore.accessToken) {
        return
    }

    try {
        await authStore.refreshSessionContext()
    } catch {
        authStore.clearAuth()
    }
}

void bootstrapAuth()
