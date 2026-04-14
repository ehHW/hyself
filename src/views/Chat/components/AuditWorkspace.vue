<template>
    <section class="chat-workspace">
        <header class="chat-workspace__header">
            <div>
                <div class="chat-workspace__title">巡检消息</div>
                <div class="chat-workspace__subtitle">
                    查看命中的会话消息，并快速跳转到对应聊天
                </div>
            </div>
        </header>

        <div class="drawer-list">
            <div
                v-for="messageItem in chatAudit.adminMessages"
                :key="`audit-message-${messageItem.id}`"
                class="drawer-list-item"
            >
                <div>
                    <div class="drawer-list-title">
                        会话 #{{ messageItem.conversation_id }}
                    </div>
                    <div class="drawer-list-desc">
                        {{ messageItem.content }}
                    </div>
                </div>
                <a-button
                    size="small"
                    @click="
                        openConversation(
                            messageItem.conversation_id,
                            messageItem.sequence,
                        )
                    "
                    >打开</a-button
                >
            </div>
            <a-empty
                v-if="!chatAudit.adminMessages.length"
                description="暂无消息"
            />
        </div>
    </section>
</template>

<script setup lang="ts">
import { useAuditScene } from "@/modules/chat-center/composables/useAuditScene";

const { chatAudit, openConversation } = useAuditScene();
</script>

<style scoped>
.chat-workspace {
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    padding: 18px 22px;
    background: var(--chat-panel-bg);
    border: 1px solid var(--chat-panel-border);
    border-radius: 14px;
    overflow: auto;
    box-shadow: var(--chat-panel-shadow);
}

.chat-workspace__header,
.drawer-list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.chat-workspace__header {
    margin-bottom: 18px;
}

.chat-workspace__title,
.drawer-list-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.chat-workspace__subtitle,
.drawer-list-desc {
    color: var(--chat-text-secondary);
}

.drawer-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.drawer-list-item {
    padding: 12px 14px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: var(--chat-panel-bg-strong);
}
</style>
