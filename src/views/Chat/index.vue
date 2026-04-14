<template>
    <div class="chat-page">
        <section ref="chatShellRef" class="chat-shell" :style="chatShellStyle">
            <div
                class="chat-shell__panel chat-shell__panel--list"
                :style="listPanelStyle"
            >
                <RouterView :key="listRouteKey" name="list" />
            </div>
            <button
                type="button"
                class="chat-shell__gutter"
                aria-label="调整会话列表宽度"
                @mousedown="startDrag('list', $event)"
            ></button>
            <div class="chat-shell__panel chat-shell__panel--workspace">
                <RouterView :key="workspaceRouteKey" />
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { RouterView, useRoute } from "vue-router";
import { useSettingsStore } from "@/stores/settings";
import { useChatShell } from "@/views/Chat/useChatShell";

useChatShell({ bootstrap: true });

type DragTarget = "list";

const GUTTER_WIDTH = 1;
const LIST_MIN_WIDTH = 260;
const LIST_MAX_WIDTH = 480;
const WORKSPACE_MIN_WIDTH = 520;

const route = useRoute();
const settingsStore = useSettingsStore();
const chatShellRef = ref<HTMLElement | null>(null);
const dragState = ref<{
    target: DragTarget;
    startX: number;
    listWidth: number;
} | null>(null);

const listPanelStyle = computed(() => ({
    width: `${settingsStore.chatLayout.listWidth}px`,
}));
const chatShellStyle = computed(() => ({
    "--chat-list-width": `${settingsStore.chatLayout.listWidth}px`,
}));
const listRouteKey = computed(
    () => `list:${String(route.name || route.fullPath)}`,
);
const workspaceRouteKey = computed(
    () => `workspace:${String(route.name || route.fullPath)}`,
);

const persistLayout = () => {
    void settingsStore.saveChatPreferences({
        chatLayout: settingsStore.chatLayout,
    });
};

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

const saveLayout = (next: { menuWidth?: number; listWidth?: number }) => {
    settingsStore.save({
        chatLayout: {
            ...settingsStore.chatLayout,
            ...next,
        },
    });
};

const handleDragMove = (event: MouseEvent) => {
    if (!dragState.value || !chatShellRef.value || window.innerWidth <= 960) {
        return;
    }
    const shellWidth = chatShellRef.value.clientWidth;
    const deltaX = event.clientX - dragState.value.startX;

    const maxListWidth = Math.min(
        LIST_MAX_WIDTH,
        shellWidth - GUTTER_WIDTH - WORKSPACE_MIN_WIDTH,
    );
    saveLayout({
        listWidth: clamp(
            dragState.value.listWidth + deltaX,
            LIST_MIN_WIDTH,
            Math.max(LIST_MIN_WIDTH, maxListWidth),
        ),
    });
};

const stopDrag = () => {
    if (!dragState.value) {
        return;
    }
    dragState.value = null;
    window.removeEventListener("mousemove", handleDragMove);
    window.removeEventListener("mouseup", stopDrag);
    persistLayout();
};

const startDrag = (target: DragTarget, event: MouseEvent) => {
    if (window.innerWidth <= 960) {
        return;
    }
    event.preventDefault();
    dragState.value = {
        target,
        startX: event.clientX,
        listWidth: settingsStore.chatLayout.listWidth,
    };
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", stopDrag);
};

onBeforeUnmount(() => {
    stopDrag();
});
</script>

<style>
.chat-page {
    --chat-page-bg: linear-gradient(180deg, #f5f7fb 0%, #eef3f9 100%);
    --chat-panel-bg: rgba(255, 255, 255, 0.92);
    --chat-panel-bg-strong: #ffffff;
    --chat-panel-border: rgba(15, 23, 42, 0.08);
    --chat-panel-shadow: 0 12px 34px rgba(15, 23, 42, 0.08);
    --chat-text-primary: #1f2937;
    --chat-text-secondary: rgba(31, 41, 55, 0.62);
    --chat-accent: #1677ff;
    --chat-accent-soft: rgba(22, 119, 255, 0.12);
    --chat-subtle-bg: rgba(148, 163, 184, 0.12);
    --chat-message-bg: #ffffff;
    --chat-message-self-bg: linear-gradient(135deg, #1677ff, #0f5ad1);
    --chat-message-self-text: #f8fbff;
    --chat-system-bg: rgba(15, 23, 42, 0.08);
    height: 100%;
    min-width: 0;
    padding: 0;
    background: var(--chat-page-bg);
}

html[data-theme="dark"] .chat-page {
    --chat-page-bg: linear-gradient(180deg, #0f172a 0%, #111827 100%);
    --chat-panel-bg: rgba(17, 24, 39, 0.9);
    --chat-panel-bg-strong: rgba(15, 23, 42, 0.96);
    --chat-panel-border: rgba(148, 163, 184, 0.18);
    --chat-panel-shadow: 0 16px 42px rgba(2, 6, 23, 0.42);
    --chat-text-primary: #e5eefc;
    --chat-text-secondary: rgba(226, 232, 240, 0.66);
    --chat-accent: #60a5fa;
    --chat-accent-soft: rgba(96, 165, 250, 0.16);
    --chat-subtle-bg: rgba(148, 163, 184, 0.1);
    --chat-message-bg: rgba(30, 41, 59, 0.94);
    --chat-message-self-bg: linear-gradient(135deg, #2563eb, #1d4ed8);
    --chat-message-self-text: #eff6ff;
    --chat-system-bg: rgba(148, 163, 184, 0.16);
}

.chat-shell {
    display: flex;
    align-items: stretch;
    width: 100%;
    height: 100%;
}

.chat-shell__panel {
    flex: 0 0 auto;
    min-width: 0;
    display: flex;
    height: 100%;
}

.chat-shell__panel > * {
    flex: 1 1 auto;
    min-width: 0;
}

.chat-shell__panel--list {
    flex: 0 0 var(--chat-list-width);
}

.chat-shell__panel--workspace {
    flex: 1 1 auto;
    min-width: 0;
}

.chat-shell__gutter {
    position: relative;
    flex: 0 0 1px;
    padding: 0;
    border: 0;
    background: color-mix(in srgb, var(--chat-panel-border) 88%, transparent);
    cursor: col-resize;
}

.chat-shell__gutter::before {
    content: none;
}

.chat-shell__gutter:hover {
    background: color-mix(
        in srgb,
        var(--chat-accent) 72%,
        var(--chat-panel-border)
    );
}

@media (max-width: 960px) {
    .chat-page {
        height: auto;
    }

    .chat-shell {
        flex-direction: column;
        height: auto;
    }

    .chat-shell__panel--list,
    .chat-shell__panel--workspace {
        flex: 1 1 auto;
        width: 100% !important;
        min-width: 0;
        max-width: none;
    }

    .chat-shell__gutter {
        display: none;
    }
}
</style>
