<template>
    <a-layout-sider
        v-model:collapsed="collapsed"
        collapsible
        collapsed-width="50px"
        :style="siderStyle"
    >
        <div class="logo">
            <img src="@/assets/img/miao.png" alt="" />
        </div>

        <a-menu
            :selectedKeys="displaySelectedKeys"
            v-model:openKeys="openKeys"
            :theme="menuTheme"
            mode="inline"
            @click="handleMenuClick"
        >
            <template v-for="item in menuItems" :key="item.key">
                <template
                    v-if="item.children?.length"
                    :key="`submenu-${item.key}`"
                >
                    <a-sub-menu :key="item.key">
                        <template #icon>
                            <a-badge
                                v-if="showCollapsedMenuBadge(item.key)"
                                :count="menuBadgeCount(item.key)"
                                :overflow-count="99"
                                class="menu-icon-badge"
                            >
                                <component :is="item.icon" />
                            </a-badge>
                            <component v-else :is="item.icon" />
                        </template>
                        <template #title>
                            <span class="menu-title-with-badge">
                                <span>{{ item.title }}</span>
                                <a-badge
                                    v-if="showExpandedMenuBadge(item.key)"
                                    :count="menuBadgeCount(item.key)"
                                    :overflow-count="99"
                                />
                            </span>
                        </template>
                        <template
                            v-for="child in item.children"
                            :key="child.key"
                        >
                            <template
                                v-if="child.children?.length"
                                :key="`submenu-${child.key}`"
                            >
                                <a-sub-menu :key="child.key">
                                    <template #icon>
                                        <component :is="child.icon" />
                                    </template>
                                    <template #title>{{
                                        child.title
                                    }}</template>
                                    <a-menu-item
                                        v-for="grandChild in child.children"
                                        :key="grandChild.key"
                                    >
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
                                    <span class="menu-title-with-badge">
                                        <span>{{ child.title }}</span>
                                        <a-badge
                                            v-if="showChildMenuBadge(child.key)"
                                            :count="menuBadgeCount(child.key)"
                                            :overflow-count="99"
                                        />
                                    </span>
                                </a-menu-item>
                            </template>
                        </template>
                    </a-sub-menu>
                </template>
                <template v-else :key="`item-${item.key}`">
                    <a-menu-item :key="item.key">
                        <template #icon>
                            <a-badge
                                v-if="showCollapsedMenuBadge(item.key)"
                                :count="menuBadgeCount(item.key)"
                                :overflow-count="99"
                                class="menu-icon-badge"
                            >
                                <component :is="item.icon" />
                            </a-badge>
                            <component v-else :is="item.icon" />
                        </template>
                        <span class="menu-title-with-badge">
                            <span>{{ item.title }}</span>
                            <a-badge
                                v-if="showExpandedMenuBadge(item.key)"
                                :count="menuBadgeCount(item.key)"
                                :overflow-count="99"
                            />
                        </span>
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
    VideoCameraOutlined,
} from "@ant-design/icons-vue";
import { computed, ref, unref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import { routes } from "@/router/routes";
import { useAuthStore } from "@/stores/auth";
import { useChatStore } from "@/stores/chat";
import { useSettingsStore } from "@/stores/settings";
import { useUserStore } from "@/stores/user";
import { resolveMenuDisplayTitle } from "@/tools/accessLabels";

interface MenuMeta {
    menu?: boolean;
    menuGroup?: boolean;
    menuKey?: string;
    menuTitle?: string;
    menuIcon?:
        | "home"
        | "setting"
        | "lock"
        | "tool"
        | "file"
        | "upload"
        | "user"
        | "team"
        | "safety"
        | "chat"
        | "appstore"
        | "trophy"
        | "music"
        | "video";
    permissionCode?: string;
    menuOrder?: number;
    superuserOnly?: boolean;
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
    video: VideoCameraOutlined,
};

const collapsed = ref<boolean>(true);
const selectedKeys = ref<string[]>([]);
const openKeys = ref<string[]>([]);
const activeAncestorKeys = ref<string[]>([]);

const settingsStore = useSettingsStore();
const authStore = useAuthStore();
const chatStore = useChatStore();
const userStore = useUserStore();
const menuTheme = computed<"light" | "dark">(() =>
    settingsStore.themeMode === "dark" ? "dark" : "light",
);
const siderStyle = computed(() => ({
    backgroundColor: "var(--surface-sidebar)",
}));
const CHAT_CENTER_KEY = "/chat-center";
const chatMessageUnreadCount = computed(() =>
    Number(unref(chatStore.state.conversationState.totalUnreadCount) || 0),
);
const chatContactUnreadCount = computed(
    () =>
        Number(
            unref(
                chatStore.state.friendshipState.unreadPendingFriendRequestCount,
            ) || 0,
        ) +
        Number(
            unref(chatStore.state.friendshipState.unreadFriendNoticeCount) || 0,
        ) +
        Number(
            unref(chatStore.state.groupState.globalGroupJoinRequests).length ||
                0,
        ) +
        Number(unref(chatStore.state.groupState.unreadGroupNoticeCount) || 0),
);
const chatMenuUnreadCount = computed(
    () => chatMessageUnreadCount.value + chatContactUnreadCount.value,
);

const route = useRoute();
const router = useRouter();

type MenuItem = {
    key: string;
    title: string;
    icon: (typeof iconMap)[keyof typeof iconMap];
    order: number;
    children?: MenuItem[];
};

const menuItems = computed(() => {
    const layoutRoute = routes.find((item) => item.name === "Layout");
    const children = layoutRoute?.children || [];

    function resolveFullPath(routePath: string, parentPath: string): string {
        if (routePath.startsWith("/")) return routePath;
        return parentPath
            ? `${parentPath}/${routePath}`.replace(/\/+/g, "/")
            : routePath;
    }

    function collectChildren(
        routeList: RouteRecordRaw[],
        parentPath: string,
    ): MenuItem[] {
        const result: MenuItem[] = [];
        for (const route of routeList) {
            const meta = (route.meta || {}) as MenuMeta;
            const fullPath = resolveFullPath(route.path, parentPath);
            const descendants = route.children?.length
                ? collectChildren(route.children, fullPath)
                : [];
            if (meta.menuGroup && descendants.length === 0) {
                continue;
            }
            if (meta.menu) {
                if (meta.superuserOnly && !userStore.isSuperuser) continue;
                if (meta.menuKey && !userStore.hasMenuAccess(meta.menuKey))
                    continue;
                if (
                    !meta.menuKey &&
                    meta.permissionCode &&
                    !authStore.hasPermission(meta.permissionCode)
                )
                    continue;
                result.push({
                    key: fullPath,
                    title: resolveMenuDisplayTitle(
                        meta.menuKey,
                        meta.menuTitle || fullPath,
                        userStore.hasPermission,
                    ),
                    icon: iconMap[meta.menuIcon || "setting"],
                    order: meta.menuOrder ?? 99,
                    children: descendants.length ? descendants : undefined,
                });
                continue;
            }
            if (descendants.length) {
                result.push(...descendants);
            }
        }
        return result.sort((a, b) => a.order - b.order);
    }

    const result: MenuItem[] = [];
    for (const route of children) {
        const meta = (route.meta || {}) as MenuMeta;
        if (!meta.menu) continue;
        const fullPath = resolveFullPath(route.path, "");
        if (meta.superuserOnly && !userStore.isSuperuser) continue;
        if (meta.menuKey && !userStore.hasMenuAccess(meta.menuKey)) continue;
        if (
            !meta.menuKey &&
            meta.permissionCode &&
            !authStore.hasPermission(meta.permissionCode)
        )
            continue;

        const subItems = route.children?.length
            ? collectChildren(route.children, fullPath)
            : [];
        if (meta.menuGroup && subItems.length === 0) continue;
        result.push({
            key: fullPath,
            title: resolveMenuDisplayTitle(
                meta.menuKey,
                meta.menuTitle || fullPath,
                userStore.hasPermission,
            ),
            icon: iconMap[meta.menuIcon || "setting"],
            order: meta.menuOrder ?? 99,
            children: subItems.length ? subItems : undefined,
        });
    }
    return result.sort((a, b) => a.order - b.order);
});

const displaySelectedKeys = computed(() => {
    const current = selectedKeys.value[0];
    if (!current) return [];
    return [...new Set([...activeAncestorKeys.value, current])];
});

watch(
    () => route.path,
    (path) => {
        selectedKeys.value = [path];
        const collectAncestorKeys = (
            items: MenuItem[],
            ancestors: string[] = [],
        ): string[] | null => {
            for (const item of items) {
                const nextAncestors = item.children?.length
                    ? [...ancestors, item.key]
                    : ancestors;
                if (item.children?.length) {
                    const childMatched = collectAncestorKeys(
                        item.children,
                        nextAncestors,
                    );
                    if (childMatched) {
                        return childMatched;
                    }
                }
                if (item.key === path) {
                    return ancestors;
                }
                if (!item.children?.length && path.startsWith(`${item.key}/`)) {
                    return ancestors;
                }
            }
            return null;
        };

        const ancestors = collectAncestorKeys(menuItems.value) || [];
        activeAncestorKeys.value = ancestors;
        if (!collapsed.value) {
            openKeys.value = [...new Set(ancestors)];
        }
    },
    { immediate: true },
);

const handleMenuClick = ({ key }: { key: string }) => {
    router.push(key);
};

const showExpandedMenuBadge = (key: string) =>
    !collapsed.value && menuBadgeCount(key) > 0;

const showCollapsedMenuBadge = (key: string) =>
    collapsed.value && menuBadgeCount(key) > 0;

const showChildMenuBadge = (key: string) => menuBadgeCount(key) > 0;

const menuBadgeCount = (key: string) => {
    if (key === `${CHAT_CENTER_KEY}/messages`) {
        return chatMessageUnreadCount.value;
    }
    if (key === `${CHAT_CENTER_KEY}/contacts/friend-notices`) {
        return chatContactUnreadCount.value;
    }
    if (key !== CHAT_CENTER_KEY) {
        return 0;
    }
    return chatMenuUnreadCount.value;
};
</script>

<style scoped>
.menu-title-with-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.menu-icon-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
}

.menu-icon-badge :deep(.ant-scroll-number) {
    box-shadow: none;
}

.menu-icon-badge :deep(.ant-badge-count) {
    min-width: 14px;
    height: 14px;
    padding-inline: 3px;
    font-size: 9px;
    line-height: 14px;
    transform: translate(47%, 13%);
    transform-origin: top right;
}

:deep(.ant-layout-sider-collapsed .ant-menu-item .menu-icon-badge),
:deep(.ant-layout-sider-collapsed .ant-menu-submenu-title .menu-icon-badge) {
    margin-inline-end: 0;
}

:deep(
    .ant-layout-sider-collapsed .ant-menu-item .menu-icon-badge .ant-badge-count
),
:deep(
    .ant-layout-sider-collapsed
        .ant-menu-submenu-title
        .menu-icon-badge
        .ant-badge-count
) {
    inset-inline-end: 0;
}

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

:deep(.ant-layout-sider-trigger) {
    background: color-mix(in srgb, var(--surface-sidebar) 92%, transparent);
    color: var(--text-secondary);
    border-top: 1px solid
        color-mix(in srgb, var(--text-secondary) 16%, transparent);
    transition:
        color 0.18s ease,
        background-color 0.18s ease;
}

:deep(.ant-layout-sider-trigger:hover) {
    color: var(--text-primary);
    background: color-mix(
        in srgb,
        var(--surface-sidebar) 78%,
        var(--surface-header) 22%
    );
}
</style>
