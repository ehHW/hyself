<template>
    <a-layout-header class="header">
        <span class="title">{{ title }}</span>
        <div class="search-area">
            <a-auto-complete
                v-model:value="searchQuery"
                :options="searchOptions"
                class="header-search"
                @select="onSearchSelect"
            >
                <a-input placeholder="搜索菜单..." allow-clear>
                    <template #prefix>
                        <SearchOutlined style="color: var(--text-secondary)" />
                    </template>
                </a-input>
            </a-auto-complete>
        </div>
        <div class="right">
            <div class="tool-area">
                <a-tooltip title="刷新系统与当前页面">
                    <a-button
                        type="text"
                        shape="circle"
                        class="tool-button"
                        :disabled="refreshing"
                        @click="refreshCurrentSession"
                    >
                        <ReloadOutlined
                            class="tool-button__icon"
                            :class="{
                                'tool-button__icon--spinning': refreshing,
                            }"
                        />
                    </a-button>
                </a-tooltip>
                <a-tooltip :title="themeTooltip">
                    <a-button
                        type="text"
                        shape="circle"
                        class="tool-button"
                        :loading="themeSwitching"
                        @click="toggleTheme"
                    >
                        <span class="tool-button__symbol">{{
                            themeSymbol
                        }}</span>
                    </a-button>
                </a-tooltip>
            </div>
            <a-dropdown :trigger="['hover']">
                <div class="user-trigger">
                    <a-avatar :size="30" :src="avatar || undefined">
                        {{ avatarText }}
                    </a-avatar>
                    <span class="name">{{ username }}</span>
                    <DownOutlined class="trigger-arrow" />
                </div>
                <template #overlay>
                    <a-menu @click="onMenuClick">
                        <a-menu-item key="profile">个人中心</a-menu-item>
                        <a-menu-item key="logout">退出登录</a-menu-item>
                    </a-menu>
                </template>
            </a-dropdown>
        </div>
    </a-layout-header>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
    DownOutlined,
    ReloadOutlined,
    SearchOutlined,
} from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import { useRouter } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { useUserStore } from "@/stores/user";
import { resolveMenuDisplayTitle } from "@/tools/accessLabels";
import { emitAppRefresh } from "@/utils/appRefresh";
import { getErrorMessage } from "@/utils/error";
import { routes } from "@/router/routes";

const router = useRouter();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const userStore = useUserStore();

const username = computed(
    () => userStore.user?.display_name || userStore.user?.username || "-",
);
const avatar = computed(() => userStore.user?.avatar || "");
const avatarText = computed(() =>
    (userStore.user?.display_name || userStore.user?.username || "?").slice(
        0,
        1,
    ),
);
const title = computed(() => settingsStore.systemTitle);
const refreshing = ref(false);
const themeSwitching = ref(false);
const MIN_REFRESH_SPIN_MS = 960;
const themeSymbol = computed(() =>
    settingsStore.themeMode === "dark" ? "☾" : "☀",
);
const themeTooltip = computed(() =>
    settingsStore.themeMode === "dark" ? "切换到浅色主题" : "切换到深色主题",
);

interface NavMeta {
    menu?: boolean;
    menuGroup?: boolean;
    menuKey?: string;
    menuTitle?: string;
    menuOrder?: number;
    permissionCode?: string;
    superuserOnly?: boolean;
}

function collectNavItems(
    routeList: RouteRecordRaw[],
    parentPath = "",
): Array<{ path: string; title: string }> {
    const result: Array<{ path: string; title: string }> = [];
    for (const route of routeList) {
        const isAbsolute = route.path.startsWith("/");
        const fullPath = isAbsolute
            ? route.path
            : parentPath
              ? `${parentPath}/${route.path}`.replace(/\/+/g, "/")
              : route.path;
        const meta = (route.meta || {}) as NavMeta;
        const descendants = route.children?.length
            ? collectNavItems(route.children, fullPath)
            : [];
        if (meta.menuGroup && descendants.length === 0) {
            continue;
        }
        if (meta.superuserOnly && !userStore.isSuperuser) {
            continue;
        }
        if (meta.menuKey && !userStore.hasMenuAccess(meta.menuKey)) {
            continue;
        }
        if (
            !meta.menuKey &&
            meta.permissionCode &&
            !authStore.hasPermission(meta.permissionCode)
        ) {
            continue;
        }
        if (meta.menu) {
            result.push({
                path: fullPath,
                title: resolveMenuDisplayTitle(
                    meta.menuKey,
                    meta.menuTitle || route.path,
                    userStore.hasPermission,
                ),
            });
        }
        if (descendants.length) {
            result.push(...descendants);
        }
    }
    return result;
}

const allNavItems = computed(() => {
    const layoutRoute = routes.find((r) => r.name === "Layout");
    return collectNavItems(layoutRoute?.children || []);
});

const searchQuery = ref("");

const searchOptions = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return [];
    return allNavItems.value
        .filter((item) => item.title.toLowerCase().includes(q))
        .map((item) => ({ value: item.path, label: item.title }));
});

function onSearchSelect(value: string) {
    router.push(value);
    searchQuery.value = "";
}

const toggleTheme = async () => {
    if (themeSwitching.value) {
        return;
    }

    const previousMode = settingsStore.themeMode;
    const nextMode = previousMode === "dark" ? "light" : "dark";

    themeSwitching.value = true;
    settingsStore.save({ themeMode: nextMode });
    try {
        await settingsStore.saveChatPreferences({ themeMode: nextMode });
    } catch (error: unknown) {
        settingsStore.save({ themeMode: previousMode });
        message.error(getErrorMessage(error, "主题切换失败"));
    } finally {
        themeSwitching.value = false;
    }
};

const goProfile = () => {
    router.push("/profile-center");
};

const logout = () => {
    authStore.clearAuth();
    router.push("/login");
};

const onMenuClick = ({ key }: { key: string }) => {
    if (key === "profile") {
        goProfile();
        return;
    }
    if (key === "logout") {
        logout();
    }
};

const refreshCurrentSession = async () => {
    if (refreshing.value) {
        return;
    }

    refreshing.value = true;
    const refreshStartedAt = Date.now();
    try {
        await authStore.refreshSessionContext();
        await emitAppRefresh({
            source: "header",
            routePath: router.currentRoute.value.path,
        });
        const elapsed = Date.now() - refreshStartedAt;
        if (elapsed < MIN_REFRESH_SPIN_MS) {
            await new Promise((resolve) => {
                window.setTimeout(resolve, MIN_REFRESH_SPIN_MS - elapsed);
            });
        }
    } catch (error: unknown) {
        const elapsed = Date.now() - refreshStartedAt;
        if (elapsed < MIN_REFRESH_SPIN_MS) {
            await new Promise((resolve) => {
                window.setTimeout(resolve, MIN_REFRESH_SPIN_MS - elapsed);
            });
        }
        message.error(getErrorMessage(error, "系统刷新失败"));
    } finally {
        refreshing.value = false;
    }
};
</script>

<style scoped>
.header {
    background: var(--surface-header);
    padding: 0 12px;
    height: var(--app-header-height);
    line-height: var(--app-header-height);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    flex-shrink: 0;
    min-width: 120px;
}

.search-area {
    flex: 1;
    display: flex;
    justify-content: center;
    padding-inline: 16px;
}

.header-search {
    width: 280px;
}

.right {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-shrink: 0;
    min-width: 120px;
    justify-content: flex-end;
}

.tool-area {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-inline-end: 10px;
}

.tool-button {
    width: 30px;
    height: 30px;
    border-radius: 999px;
    color: var(--text-secondary);
    background: color-mix(
        in srgb,
        var(--surface-header) 82%,
        var(--surface-sidebar) 18%
    );
    border: 1px solid color-mix(in srgb, var(--text-secondary) 14%, transparent);
}

.tool-button:hover {
    color: var(--text-primary);
    background: color-mix(
        in srgb,
        var(--surface-header) 64%,
        var(--surface-sidebar) 36%
    );
}

.tool-button__symbol {
    font-size: 14px;
    line-height: 1;
}

.tool-button__icon {
    display: inline-flex;
    font-size: 14px;
    line-height: 1;
}

.tool-button__icon--spinning {
    animation: tool-button-spin 0.8s linear infinite;
}

@keyframes tool-button-spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

.user-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}

:deep(.ant-avatar-string) {
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) !important;
}

.name {
    color: var(--text-secondary);
}

.trigger-arrow {
    color: var(--text-secondary);
    font-size: 12px;
}
</style>
