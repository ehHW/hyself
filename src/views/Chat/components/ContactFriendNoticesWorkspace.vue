<template>
    <section class="chat-workspace">
        <header class="chat-workspace__header">
            <div>
                <div class="chat-workspace__title">好友通知</div>
                <div class="chat-workspace__subtitle">
                    把 websocket
                    通知流和申请历史拆开看，避免把提醒和记录混成一页
                </div>
            </div>
        </header>

        <section class="notice-block notice-block--cards">
            <div class="notice-block__header">
                <div>
                    <div class="notice-block__title">通知卡片</div>
                    <div class="notice-block__desc">
                        这里只保留即时提醒，点进页面就按通知流已读处理
                    </div>
                </div>
                <a-tag color="processing"
                    >{{ friendNoticeItems.length }} 条</a-tag
                >
            </div>

            <div v-if="friendNoticeItems.length" class="notice-card-grid">
                <article
                    v-for="item in friendNoticeItems"
                    :key="`${item.kind}-${item.id}`"
                    class="notice-card"
                >
                    <div class="notice-card__kind">
                        <a-tag
                            :color="
                                item.kind === 'received'
                                    ? 'blue'
                                    : item.kind === 'sent'
                                      ? 'purple'
                                      : 'default'
                            "
                        >
                            {{
                                item.kind === "received"
                                    ? "收到结果"
                                    : item.kind === "sent"
                                      ? "发出结果"
                                      : "系统提醒"
                            }}
                        </a-tag>
                    </div>
                    <div class="notice-item__title">{{ item.title }}</div>
                    <div class="notice-item__desc">{{ item.description }}</div>
                    <div class="notice-item__time">
                        {{ formatDateTime(item.created_at) }}
                    </div>
                </article>
            </div>
            <a-empty v-else description="当前没有新的好友通知卡片" />
        </section>

        <section class="notice-block notice-block--history">
            <div class="notice-block__header">
                <div>
                    <div class="notice-block__title">历史申请记录</div>
                    <div class="notice-block__desc">
                        这里保留完整申请流水，包含待处理、已通过、已拒绝和已撤销记录
                    </div>
                </div>
                <a-tag color="default">
                    {{ receivedHistory.length + sentHistory.length }} 条申请
                </a-tag>
            </div>

            <div class="history-grid">
                <section class="history-column">
                    <div class="history-column__header">
                        <span>收到的申请</span>
                        <a-tag color="blue">{{ receivedHistory.length }}</a-tag>
                    </div>
                    <div class="notice-list">
                        <div
                            v-for="request in receivedHistory"
                            :key="`received-${request.id}`"
                            class="notice-item notice-item--request"
                        >
                            <div class="notice-item__main">
                                <div class="notice-item__title">
                                    {{
                                        request.from_user.display_name ||
                                        request.from_user.username
                                    }}
                                </div>
                                <div class="notice-item__desc">
                                    {{
                                        request.request_message ||
                                        "对方没有填写附言"
                                    }}
                                </div>
                                <div class="notice-item__time">
                                    {{ formatDateTime(request.created_at) }}
                                </div>
                            </div>
                            <div class="notice-item__side">
                                <a-space v-if="request.status === 'pending'">
                                    <a-button
                                        size="small"
                                        type="primary"
                                        @click="
                                            handleRequestAction(
                                                request.id,
                                                'accept',
                                            )
                                        "
                                        >通过</a-button
                                    >
                                    <a-button
                                        size="small"
                                        @click="
                                            handleRequestAction(
                                                request.id,
                                                'reject',
                                            )
                                        "
                                        >拒绝</a-button
                                    >
                                </a-space>
                                <a-tag
                                    v-else
                                    :color="
                                        statusColorMap[request.status] ||
                                        'default'
                                    "
                                >
                                    {{
                                        statusLabelMap[request.status] ||
                                        request.status
                                    }}
                                </a-tag>
                            </div>
                        </div>
                        <a-empty
                            v-if="!receivedHistory.length"
                            description="暂无收到的好友申请"
                        />
                    </div>
                </section>

                <section class="history-column">
                    <div class="history-column__header">
                        <span>发出的申请</span>
                        <a-tag color="purple">{{ sentHistory.length }}</a-tag>
                    </div>
                    <div class="notice-list">
                        <div
                            v-for="request in sentHistory"
                            :key="`sent-${request.id}`"
                            class="notice-item notice-item--request"
                        >
                            <div class="notice-item__main">
                                <div class="notice-item__title">
                                    {{
                                        request.to_user.display_name ||
                                        request.to_user.username
                                    }}
                                </div>
                                <div class="notice-item__desc">
                                    {{
                                        request.request_message || "未填写附言"
                                    }}
                                </div>
                                <div class="notice-item__time">
                                    {{ formatDateTime(request.created_at) }}
                                </div>
                            </div>
                            <div class="notice-item__side">
                                <a-space v-if="request.status === 'pending'">
                                    <a-button
                                        size="small"
                                        danger
                                        @click="
                                            handleRequestAction(
                                                request.id,
                                                'cancel',
                                            )
                                        "
                                        >撤销</a-button
                                    >
                                </a-space>
                                <a-tag
                                    v-else
                                    :color="
                                        statusColorMap[request.status] ||
                                        'default'
                                    "
                                >
                                    {{
                                        statusLabelMap[request.status] ||
                                        request.status
                                    }}
                                </a-tag>
                            </div>
                        </div>
                        <a-empty
                            v-if="!sentHistory.length"
                            description="暂无发出的好友申请"
                        />
                    </div>
                </section>
            </div>
        </section>
    </section>
</template>

<script setup lang="ts">
import { useContactFriendNoticesScene } from "@/modules/chat-center/composables/useContactFriendNoticesScene";

const {
    formatDateTime,
    friendNoticeItems,
    handleRequestAction,
    receivedHistory,
    sentHistory,
    statusColorMap,
    statusLabelMap,
} = useContactFriendNoticesScene();
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
.notice-item--request,
.notice-block__header,
.history-column__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.chat-workspace__header {
    margin-bottom: 8px;
}

.chat-workspace__title {
    font-size: 20px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.chat-workspace__subtitle {
    color: var(--chat-text-secondary);
}

.notice-block {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 16px;
}

.notice-block--cards {
    background: linear-gradient(
        135deg,
        rgba(36, 99, 235, 0.06),
        rgba(15, 23, 42, 0.02)
    );
}

.notice-block--history {
    margin-top: 16px;
    background: var(--chat-panel-bg-strong);
}

.notice-block__title,
.history-column__header {
    font-size: 16px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.notice-block__desc {
    margin-top: 4px;
    color: var(--chat-text-secondary);
}

.notice-card-grid,
.history-grid {
    display: grid;
    gap: 12px;
}

.notice-card-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.history-grid {
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.notice-card,
.history-column {
    border: 1px solid var(--chat-panel-border);
    border-radius: 14px;
    background: var(--chat-panel-bg);
}

.notice-card {
    padding: 14px;
}

.notice-card__kind {
    margin-bottom: 10px;
}

.history-column {
    padding: 14px;
}

.notice-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.notice-item {
    padding: 12px 14px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: var(--chat-panel-bg-strong);
}

.notice-item__main {
    min-width: 0;
}

.notice-item__side {
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
}

.notice-item__title {
    font-weight: 700;
    color: var(--chat-text-primary);
}

.notice-item__desc,
.notice-item__time {
    color: var(--chat-text-secondary);
}

.notice-item--request {
    align-items: flex-start;
}

.notice-item__time {
    margin-top: 4px;
    font-size: 12px;
}

@media (max-width: 960px) {
    .history-grid {
        grid-template-columns: 1fr;
    }

    .notice-item--request {
        flex-direction: column;
    }

    .notice-item__side {
        width: 100%;
        justify-content: flex-start;
    }
}
</style>
