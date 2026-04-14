<template>
    <section class="chat-panel">
        <header class="chat-panel__header">
            <div>
                <div class="chat-panel__title">聊天巡检</div>
                <div class="chat-panel__subtitle">管理员消息审查视图</div>
            </div>
        </header>

        <a-input
            v-model:value="auditKeyword"
            allow-clear
            placeholder="搜索会话名或消息内容"
            @press-enter="handleLoadAudit"
        />

        <div class="chat-panel__list">
            <div
                v-for="conversation in chatAudit.adminConversations"
                :key="`audit-conversation-${conversation.id}`"
                class="drawer-list-item"
            >
                <div>
                    <div class="drawer-list-title">{{ conversation.name }}</div>
                    <div class="drawer-list-desc">
                        {{ conversation.type === "group" ? "群聊" : "单聊" }} ·
                        {{ conversation.last_message_preview || "暂无消息" }}
                    </div>
                </div>
                <a-button
                    size="small"
                    @click="openConversation(conversation.id)"
                    >查看</a-button
                >
            </div>
            <a-empty
                v-if="!chatAudit.adminConversations.length"
                description="暂无会话"
            />
        </div>
    </section>
</template>

<script setup lang="ts">
import { useAuditScene } from "@/modules/chat-center/composables/useAuditScene";

const { auditKeyword, chatAudit, handleLoadAudit, openConversation } =
    useAuditScene({ autoLoad: true });
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
    border-radius: 14px;
    box-shadow: var(--chat-panel-shadow);
}

.chat-panel__header,
.drawer-list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.chat-panel__title,
.drawer-list-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.chat-panel__subtitle,
.drawer-list-desc {
    color: var(--chat-text-secondary);
}

.chat-panel__list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
    overflow: auto;
}

.drawer-list-item {
    padding: 12px 14px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: var(--chat-panel-bg-strong);
}
</style>
