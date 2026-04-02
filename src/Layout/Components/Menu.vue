<template>
    <a-layout-sider
        v-model:collapsed="collapsed"
        collapsible
        :trigger="null"
        collapsed-width="50px"
        :style="siderStyle"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
    >
        <div class="logo">
            <img src="@/assets/img/miao.png" alt="" />
        </div>

        <a-menu :selectedKeys="displaySelectedKeys" v-model:openKeys="openKeys" :theme="menuTheme" mode="inline" @click="handleMenuClick">
            <template v-for="item in menuItems" :key="item.key">
                <template v-if="item.children?.length" :key="`submenu-${item.key}`">
                    <a-sub-menu :key="item.key">
                        <template #icon>
                            <component :is="item.icon" />
                        </template>
                        <template #title>{{ item.title }}</template>
                        <template v-for="child in item.children" :key="child.key">
                            <template v-if="child.children?.length" :key="`submenu-${child.key}`">
                                <a-sub-menu :key="child.key">
                                    <template #icon>
                                        <component :is="child.icon" />
                                    </template>
                                    <template #title>{{ child.title }}</template>
                                    <a-menu-item v-for="grandChild in child.children" :key="grandChild.key">
                                        <template #icon>
                                            <component :is="grandChild.icon" />
                                        </template>
                                        {{ grandChild.title }}
                                    </a-menu-item>
                                </a-sub-menu>
                            </template>
                            <template v-else :key="`item-${child.key}`">
                                <a-menu-item :key="child.key">
                                    <template #icon>
                                        <component :is="child.icon" />
                                    </template>
                                    {{ child.title }}
                                </a-menu-item>
                            </template>
                        </template>
                    </a-sub-menu>
                </template>
                <template v-else :key="`item-${item.key}`">
                    <a-menu-item :key="item.key">
                        <template #icon>
                            <component :is="item.icon" />
                        </template>
                        {{ item.title }}
                    </a-menu-item>
                </template>
            </template>
        </a-menu>
    </a-layout-sider>
</template>

<script setup lang="ts">
import {
    AppstoreOutlined,
    BellOutlined,
    CustomerServiceOutlined,
    FileOutlined,
    HomeOutlined,
    LockOutlined,
    MessageOutlined,
    SafetyCertificateOutlined,
    SettingOutlined,
    TeamOutlined,
    ToolOutlined,
    TrophyOutlined,
    UploadOutlined,
    UserOutlined,
} from '@ant-design/icons-vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { routes } from '@/router/routes'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'

interface MenuMeta {
    menu?: boolean
    menuTitle?: string
    menuIcon?: 'home' | 'setting' | 'lock' | 'tool' | 'file' | 'upload' | 'user' | 'team' | 'safety' | 'chat' | 'appstore' | 'trophy' | 'music'
    permissionCode?: string
    menuOrder?: number
}

const iconMap = {
    home: HomeOutlined,
    setting: SettingOutlined,
    lock: LockOutlined,
    tool: ToolOutlined,
    file: FileOutlined,
    upload: UploadOutlined,
    user: UserOutlined,
    team: TeamOutlined,
    safety: SafetyCertificateOutlined,
    chat: MessageOutlined,
    appstore: AppstoreOutlined,
    trophy: TrophyOutlined,
    music: CustomerServiceOutlined,
}

const collapsed = ref<boolean>(true)
const selectedKeys = ref<string[]>([])
const openKeys = ref<string[]>([])
const activeAncestorKeys = ref<string[]>([])
let expandTimer: ReturnType<typeof setTimeout> | null = null

const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const menuTheme = computed<'light' | 'dark'>(() => (settingsStore.themeMode === 'dark' ? 'dark' : 'light'))
const siderStyle = computed(() => ({
    backgroundColor: 'var(--surface-sidebar)',
}))

const route = useRoute()
const router = useRouter()

type MenuItem = {
    key: string
    title: string
    icon: (typeof iconMap)[keyof typeof iconMap]
    order: number
    children?: MenuItem[]
}

const menuItems = computed(() => {
    const layoutRoute = routes.find((item) => item.name === 'Layout')
    const children = layoutRoute?.children || []

    function resolveFullPath(routePath: string, parentPath: string): string {
        if (routePath.startsWith('/')) return routePath
        return parentPath ? `${parentPath}/${routePath}`.replace(/\/+/g, '/') : routePath
    }

    function collectChildren(routeList: RouteRecordRaw[], parentPath: string): MenuItem[] {
        const result: MenuItem[] = []
        for (const route of routeList) {
            const meta = (route.meta || {}) as MenuMeta
            const fullPath = resolveFullPath(route.path, parentPath)
            const descendants = route.children?.length ? collectChildren(route.children, fullPath) : []
            if (meta.menu) {
                if (meta.permissionCode && !authStore.hasPermission(meta.permissionCode)) continue
                result.push({
                    key: fullPath,
                    title: meta.menuTitle || fullPath,
                    icon: iconMap[meta.menuIcon || 'setting'],
                    order: meta.menuOrder ?? 99,
                    children: descendants.length ? descendants : undefined,
                })
                continue
            }
            if (descendants.length) {
                result.push(...descendants)
            }
        }
        return result.sort((a, b) => a.order - b.order)
    }

    const result: MenuItem[] = []
    for (const route of children) {
        const meta = (route.meta || {}) as MenuMeta
        if (!meta.menu) continue
        const fullPath = resolveFullPath(route.path, '')
        if (meta.permissionCode && !authStore.hasPermission(meta.permissionCode)) continue

        const subItems = route.children?.length ? collectChildren(route.children, fullPath) : []
        result.push({
            key: fullPath,
            title: meta.menuTitle || fullPath,
            icon: iconMap[meta.menuIcon || 'setting'],
            order: meta.menuOrder ?? 99,
            children: subItems.length ? subItems : undefined,
        })
    }
    return result.sort((a, b) => a.order - b.order)
})

const displaySelectedKeys = computed(() => {
    const current = selectedKeys.value[0]
    if (!current) return []
    return [...new Set([...activeAncestorKeys.value, current])]
})

watch(
    () => route.path,
    (path) => {
        selectedKeys.value = [path]
        const collectAncestorKeys = (items: MenuItem[], ancestors: string[] = []): string[] | null => {
            for (const item of items) {
                const nextAncestors = item.children?.length ? [...ancestors, item.key] : ancestors
                if (item.children?.length) {
                    const childMatched = collectAncestorKeys(item.children, nextAncestors)
                    if (childMatched) {
                        return childMatched
                    }
                }
                if (item.key === path) {
                    return ancestors
                }
                if (!item.children?.length && path.startsWith(`${item.key}/`)) {
                    return ancestors
                }
            }
            return null
        }

        const ancestors = collectAncestorKeys(menuItems.value) || []
        activeAncestorKeys.value = ancestors
        if (!collapsed.value) {
            openKeys.value = [...new Set(ancestors)]
        }
    },
    { immediate: true },
)

const handleMenuClick = ({ key }: { key: string }) => {
    router.push(key)
}

const handleMouseEnter = () => {
    if (expandTimer) {
        clearTimeout(expandTimer)
    }
    expandTimer = setTimeout(() => {
        collapsed.value = false
        expandTimer = null
    }, settingsStore.menuHoverExpandDelayMs)
}

const handleMouseLeave = () => {
    if (expandTimer) {
        clearTimeout(expandTimer)
        expandTimer = null
    }
    collapsed.value = true
    openKeys.value = []
}

onBeforeUnmount(() => {
    if (expandTimer) {
        clearTimeout(expandTimer)
        expandTimer = null
    }
})
</script>

<style scoped>
.logo {
    margin-inline: 5px;
    margin-block: 5px;
    width: calc(100% - 10px);
    height: 40px;
    display: flex;
    justify-content: center;
    align-items: center;

    > img {
        width: 30px;
        height: 30px;
        border-radius: 50%;
    }
}

:deep(.ant-menu-item) {
    margin-inline: 4px;
    margin-block: 5px;
}
</style>
