<template>
    <section class="chat-panel">
        <div class="toolbar-row">
            <a-input
                v-model:value="contactKeyword"
                allow-clear
                :placeholder="
                    activeContactTab === 'friends' ? '搜索好友' : '搜索群组'
                "
            />
            <a-button
                v-if="canAddFriend"
                type="primary"
                class="chat-action-trigger"
                @click="addFriendModalOpen = true"
                >+</a-button
            >
        </div>

        <div class="contact-shortcuts">
            <button
                type="button"
                class="contact-shortcut"
                :class="{ active: route.name === 'ChatContactsFriendNotices' }"
                @click="router.push({ name: 'ChatContactsFriendNotices' })"
            >
                <span>好友通知</span>
                <a-badge
                    :count="friendNoticeShortcutCount"
                    :overflow-count="99"
                />
            </button>
            <button
                type="button"
                class="contact-shortcut"
                :class="{ active: route.name === 'ChatContactsNotices' }"
                @click="router.push({ name: 'ChatContactsNotices' })"
            >
                <span>群通知</span>
                <a-badge :count="groupNoticeCount" :overflow-count="99" />
            </button>
        </div>

        <a-tabs v-model:activeKey="activeContactTab" class="contact-tabs">
            <a-tab-pane key="friends" tab="好友">
                <div class="friend-meta">
                    <span>{{ chatFriendshipState.friends.length }} 位好友</span>
                </div>

                <div class="chat-panel__list">
                    <div
                        v-for="friend in filteredFriends"
                        :key="friend.friendship_id"
                        class="drawer-list-item friend-row"
                    >
                        <button
                            type="button"
                            class="friend-row__main"
                            @dblclick="
                                handleOpenFriendChat(
                                    friend.friend_user.id,
                                    friend.direct_conversation?.id || null,
                                )
                            "
                        >
                            <div class="friend-row__info">
                                <a-avatar
                                    :src="
                                        friend.friend_user.avatar || undefined
                                    "
                                    :size="34"
                                >
                                    {{
                                        (
                                            friend.friend_user.display_name ||
                                            friend.friend_user.username ||
                                            "?"
                                        ).slice(0, 1)
                                    }}
                                </a-avatar>
                                <div class="friend-row__text">
                                    <div
                                        class="drawer-list-title friend-row__title"
                                    >
                                        {{
                                            friend.remark ||
                                            friend.friend_user.display_name ||
                                            friend.friend_user.username
                                        }}
                                    </div>
                                    <div
                                        class="drawer-list-desc friend-row__desc"
                                    >
                                        {{
                                            friend.remark
                                                ? friend.friend_user
                                                      .display_name ||
                                                  friend.friend_user.username
                                                : friend.friend_user.username
                                        }}
                                    </div>
                                </div>
                            </div>
                            <a-tag
                                v-if="
                                    friend.direct_conversation &&
                                    !friend.direct_conversation.show_in_list
                                "
                                color="default"
                                >已隐藏</a-tag
                            >
                        </button>
                    </div>
                    <a-empty
                        v-if="!filteredFriends.length"
                        description="暂无好友"
                    />
                </div>
            </a-tab-pane>
            <a-tab-pane key="groups" tab="群组">
                <div class="friend-meta">
                    <span
                        >{{
                            chatConversationState.contactGroupConversations
                                .length
                        }}
                        个群组</span
                    >
                </div>

                <div class="chat-panel__list">
                    <button
                        v-for="group in filteredGroups"
                        :key="group.id"
                        type="button"
                        class="drawer-list-item group-row"
                        @dblclick="handleOpenGroup(group.id)"
                    >
                        <div class="group-row__info">
                            <a-avatar
                                :src="group.avatar || undefined"
                                :size="34"
                            >
                                {{ (group.name || "?").slice(0, 1) }}
                            </a-avatar>
                            <div class="group-row__text">
                                <div class="drawer-list-title group-row__title">
                                    {{ group.name }}
                                </div>
                                <div class="drawer-list-desc group-row__desc">
                                    {{ group.member_count }} 人
                                </div>
                            </div>
                        </div>
                        <a-tag v-if="!group.show_in_list" color="default"
                            >已隐藏</a-tag
                        >
                    </button>
                    <a-empty
                        v-if="!filteredGroups.length"
                        description="暂无群组"
                    />
                </div>
            </a-tab-pane>
        </a-tabs>

        <a-modal
            v-model:open="addFriendModalOpen"
            title="添加好友"
            :footer="null"
            :width="CHAT_MODAL_WIDTH_SM"
            :body-style="tallModalBodyStyle"
        >
            <div class="drawer-toolbar">
                <a-input
                    v-model:value="discoverKeyword"
                    allow-clear
                    placeholder="输入用户名或昵称搜索"
                />
            </div>
            <a-textarea
                v-model:value="friendRequestMessage"
                :auto-size="{ minRows: 2, maxRows: 4 }"
                placeholder="好友申请附言（可选）"
            />
            <div class="chat-panel__list modal-list">
                <div
                    v-for="user in chatAudit.searchResult?.users || []"
                    :key="user.id"
                    class="drawer-list-item"
                >
                    <div>
                        <div class="drawer-list-title">
                            {{ user.display_name || user.username }}
                        </div>
                        <div class="drawer-list-desc">{{ user.username }}</div>
                    </div>
                    <a-space>
                        <a-button
                            size="small"
                            @click="
                                handleOpenFriendChat(
                                    user.id,
                                    user.direct_conversation?.id || null,
                                )
                            "
                            :disabled="!user.can_open_direct"
                            >私聊</a-button
                        >
                        <a-button
                            v-if="shouldShowAddFriendAction(user)"
                            size="small"
                            type="primary"
                            @click="handleSendFriendRequest(user.id)"
                            >加好友</a-button
                        >
                    </a-space>
                </div>
                <a-empty
                    v-if="
                        !(chatAudit.searchResult?.users || []).length &&
                        discoverKeyword.trim()
                    "
                    description="暂无匹配用户"
                />
            </div>
        </a-modal>
    </section>
</template>

<script setup lang="ts">
import { useContactScene } from "@/modules/chat-center/composables/useContactScene";

const {
    CHAT_MODAL_WIDTH_SM,
    activeContactTab,
    addFriendModalOpen,
    canAddFriend,
    chatAudit,
    chatConversationState,
    chatFriendshipState,
    contactKeyword,
    discoverKeyword,
    filteredFriends,
    filteredGroups,
    friendNoticeShortcutCount,
    friendRequestMessage,
    groupNoticeCount,
    handleOpenFriendChat,
    handleOpenGroup,
    handleSendFriendRequest,
    route,
    router,
    shouldShowAddFriendAction,
    tallModalBodyStyle,
} = useContactScene();
</script>

<style scoped>
.chat-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    height: 100%;
    padding: 16px;
    background: var(--chat-panel-bg);
    border: 1px solid var(--chat-panel-border);
    border-radius: 16px 0 0 16px;
    box-shadow: var(--chat-panel-shadow);
}

.toolbar-row,
.drawer-list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.chat-action-trigger {
    width: 28px;
    min-width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 10px;
    font-size: 16px;
    line-height: 1;
}

.chat-action-trigger :deep(.ant-btn-icon),
.chat-action-trigger :deep(.anticon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.contact-shortcuts,
.chat-panel__list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
    overflow: auto;
}

.contact-shortcut {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: var(--chat-subtle-bg);
    color: var(--chat-text-primary);
    cursor: pointer;
}

.contact-shortcut.active {
    color: var(--chat-accent);
    background: var(--chat-accent-soft);
    border-color: color-mix(in srgb, var(--chat-accent) 28%, transparent);
}

.friend-meta {
    display: flex;
    justify-content: flex-end;
    font-size: 12px;
    color: var(--chat-text-secondary);
    margin-bottom: 8px;
}

.drawer-list-item {
    padding: 12px 14px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: var(--chat-panel-bg-strong);
}

.drawer-list-title {
    font-weight: 700;
    color: var(--chat-text-primary);
}

.drawer-list-desc {
    color: var(--chat-text-secondary);
}

.friend-row {
    align-items: stretch;
}

.friend-row__main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 0;
    background: transparent;
    padding: 0;
    text-align: left;
    cursor: pointer;
}

.friend-row__info {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.friend-row__text {
    min-width: 0;
}

.friend-row__title,
.friend-row__desc {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.friend-row__title {
    font-size: 14px;
}

.friend-row__desc {
    font-size: 12px;
}

.group-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    text-align: left;
    cursor: pointer;
}

.group-row__info {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.group-row__text {
    min-width: 0;
}

.group-row__title,
.group-row__desc {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.group-row__title {
    font-size: 14px;
}

.group-row__desc {
    font-size: 12px;
}

.drawer-toolbar {
    margin-bottom: 12px;
}

.modal-list {
    margin-top: 14px;
}

.contact-tabs {
    min-height: 0;
}

.contact-tabs :deep(.ant-tabs-content-holder),
.contact-tabs :deep(.ant-tabs-content),
.contact-tabs :deep(.ant-tabs-tabpane) {
    min-height: 0;
    height: 100%;
}
</style>
