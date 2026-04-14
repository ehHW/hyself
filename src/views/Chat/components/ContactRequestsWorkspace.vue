<template>
    <section class="chat-workspace">
        <header class="chat-workspace__header">
            <div>
                <div class="chat-workspace__title">新朋友</div>
                <div class="chat-workspace__subtitle">
                    处理收到的好友申请，也可以查看自己发出的申请
                </div>
            </div>
        </header>

        <a-divider orientation="left">收到的申请</a-divider>
        <div class="drawer-list">
            <div
                v-for="request in chatFriendshipState.receivedRequests"
                :key="request.id"
                class="drawer-list-item request-item"
            >
                <div>
                    <div class="drawer-list-title">
                        {{
                            request.from_user.display_name ||
                            request.from_user.username
                        }}
                    </div>
                    <div class="drawer-list-desc">
                        {{ request.request_message || "对方没有填写附言" }}
                    </div>
                    <div class="drawer-list-meta">
                        {{ formatDateTime(request.created_at) }}
                    </div>
                </div>
                <a-space v-if="request.status === 'pending'">
                    <a-button
                        size="small"
                        type="primary"
                        @click="handleRequestAction(request.id, 'accept')"
                        >通过</a-button
                    >
                    <a-button
                        size="small"
                        @click="handleRequestAction(request.id, 'reject')"
                        >拒绝</a-button
                    >
                </a-space>
                <a-tag
                    v-else
                    :color="statusColorMap[request.status] || 'default'"
                    >{{
                        statusLabelMap[request.status] || request.status
                    }}</a-tag
                >
            </div>
            <a-empty
                v-if="!chatFriendshipState.receivedRequests.length"
                description="暂无收到的好友申请"
            />
        </div>

        <a-divider orientation="left">发出的申请</a-divider>
        <div class="drawer-list">
            <div
                v-for="request in chatFriendshipState.sentRequests"
                :key="request.id"
                class="drawer-list-item request-item"
            >
                <div>
                    <div class="drawer-list-title">
                        {{
                            request.to_user.display_name ||
                            request.to_user.username
                        }}
                    </div>
                    <div class="drawer-list-desc">
                        {{ request.request_message || "未填写附言" }}
                    </div>
                    <div class="drawer-list-meta">
                        {{ formatDateTime(request.created_at) }}
                    </div>
                </div>
                <a-space v-if="request.status === 'pending'">
                    <a-button
                        size="small"
                        danger
                        @click="handleRequestAction(request.id, 'cancel')"
                        >撤销</a-button
                    >
                </a-space>
                <a-tag
                    v-else
                    :color="statusColorMap[request.status] || 'default'"
                    >{{
                        statusLabelMap[request.status] || request.status
                    }}</a-tag
                >
            </div>
            <a-empty
                v-if="!chatFriendshipState.sentRequests.length"
                description="暂无发出的好友申请"
            />
        </div>
    </section>
</template>

<script setup lang="ts">
import { useContactRequestsScene } from "@/modules/chat-center/composables/useContactRequestsScene";

const {
    chatFriendshipState,
    formatDateTime,
    handleRequestAction,
    statusColorMap,
    statusLabelMap,
} = useContactRequestsScene();
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
    margin-bottom: 8px;
}

.chat-workspace__title,
.drawer-list-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.chat-workspace__subtitle,
.drawer-list-desc,
.drawer-list-meta {
    color: var(--chat-text-secondary);
}

.drawer-list-meta {
    margin-top: 4px;
    font-size: 12px;
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

.request-item {
    align-items: flex-start;
}
</style>
