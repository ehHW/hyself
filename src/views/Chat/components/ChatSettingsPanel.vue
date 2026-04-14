<template>
    <section class="chat-panel">
        <div class="chat-panel__list">
            <button
                type="button"
                class="setting-item"
                :class="{ active: route.name === 'ChatSettingsShortcuts' }"
                @click="router.push({ name: 'ChatSettingsShortcuts' })"
            >
                <div class="drawer-list-title">快捷键</div>
            </button>
            <button
                v-if="canReviewAllMessages"
                type="button"
                class="setting-item"
                :class="{ active: route.name === 'ChatSettingsInspect' }"
                @click="router.push({ name: 'ChatSettingsInspect' })"
            >
                <div class="drawer-list-title">巡检模式</div>
            </button>
        </div>
    </section>
</template>

<script setup lang="ts">
import { useChatSettingsScene } from "@/modules/chat-center/composables/useChatSettingsScene";

const { canReviewAllMessages, route, router } = useChatSettingsScene();
</script>

<style scoped>
.chat-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    height: 100%;
    padding: 18px;
    background: var(--chat-panel-bg);
    border: 1px solid var(--chat-panel-border);
    border-radius: 14px 0 0 14px;
    box-shadow: var(--chat-panel-shadow);
}

.chat-panel__title,
.drawer-list-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.chat-panel__list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
}

.setting-item {
    width: 100%;
    padding: 14px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: var(--chat-panel-bg-strong);
    text-align: left;
    cursor: pointer;
}

.setting-item.active,
.setting-item:hover {
    border-color: color-mix(in srgb, var(--chat-accent) 28%, transparent);
    background: var(--chat-accent-soft);
}
</style>
