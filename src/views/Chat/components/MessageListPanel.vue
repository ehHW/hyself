<template>
    <section class="chat-panel">
        <div class="toolbar-row">
            <div class="search-box" @mousedown.prevent>
                <a-input
                    v-model:value="searchKeyword"
                    allow-clear
                    placeholder="搜索好友、群聊、聊天记录"
                    @focus="searchFocused = true"
                    @blur="handleSearchBlur"
                />

                <div v-if="searchDropdownVisible" class="search-dropdown">
                    <div
                        class="search-dropdown__section"
                        v-if="topUserMatches.length"
                    >
                        <div class="search-dropdown__label">用户</div>
                        <button
                            v-for="item in topUserMatches"
                            :key="item.key"
                            type="button"
                            class="search-dropdown__item"
                            @click="handleTopMatchClick(item)"
                        >
                            <span class="search-dropdown__primary">{{
                                item.label
                            }}</span>
                            <small class="search-dropdown__secondary">{{
                                item.meta
                            }}</small>
                        </button>
                    </div>

                    <div
                        class="search-dropdown__section"
                        v-if="recentMessageMatches.length"
                    >
                        <div class="search-dropdown__label">聊天记录</div>
                        <button
                            v-for="item in recentMessageMatches"
                            :key="item.message_id"
                            type="button"
                            class="search-dropdown__item"
                            @click="
                                openConversation(
                                    item.conversation_id,
                                    item.sequence,
                                )
                            "
                        >
                            <span class="search-dropdown__primary">{{
                                item.conversation_name
                            }}</span>
                            <small class="search-dropdown__secondary">{{
                                item.content_preview
                            }}</small>
                        </button>
                    </div>

                    <button
                        type="button"
                        class="search-dropdown__more"
                        @click="allResultModalOpen = true"
                    >
                        查看全部匹配结果
                    </button>
                </div>
            </div>

            <a-dropdown
                v-if="showQuickActionTrigger"
                :trigger="['hover']"
                placement="bottomRight"
            >
                <a-button type="primary" class="chat-action-trigger"
                    >+</a-button
                >
                <template #overlay>
                    <a-menu @click="handleQuickMenuClick">
                        <a-menu-item v-if="canCreateGroup" key="group"
                            >创建群聊</a-menu-item
                        >
                        <a-menu-item v-if="canAddFriend" key="discover"
                            >加好友/群</a-menu-item
                        >
                    </a-menu>
                </template>
            </a-dropdown>
        </div>

        <div class="chat-panel__list">
            <button
                v-for="conversation in chatConversationState.conversations"
                :key="conversation.id"
                class="conversation-item"
                :class="{
                    active:
                        chatConversationState.activeConversationId ===
                        conversation.id,
                    pinned: conversation.is_pinned,
                }"
                type="button"
                @click="openConversation(conversation.id)"
                @contextmenu.prevent="
                    openConversationMenu($event, conversation)
                "
            >
                <a-avatar
                    :src="conversation.avatar || undefined"
                    :style="avatarStyle(conversation.type)"
                >
                    {{ avatarText(conversationDisplayName(conversation)) }}
                </a-avatar>
                <div class="conversation-item__body">
                    <div class="conversation-item__top">
                        <span class="conversation-item__name">{{
                            conversationDisplayName(conversation)
                        }}</span>
                        <span class="conversation-item__time">{{
                            formatShortTime(conversation.last_message_at)
                        }}</span>
                    </div>
                    <div class="conversation-item__bottom">
                        <span class="conversation-item__preview">{{
                            conversation.last_message_preview || "暂无消息"
                        }}</span>
                        <a-badge
                            v-if="getVisibleUnreadCount(conversation) > 0"
                            class="conversation-item__badge"
                            :count="getVisibleUnreadCount(conversation)"
                            :overflow-count="99"
                            :number-style="getUnreadBadgeStyle(conversation)"
                        />
                    </div>
                </div>
            </button>
            <a-empty
                v-if="!chatConversationState.conversations.length"
                description="暂无会话"
            />
        </div>

        <transition name="context-menu-fade">
            <div
                v-if="contextMenuOpen"
                class="context-menu"
                :style="contextMenuStyle"
            >
                <button
                    v-if="canHideConversation"
                    type="button"
                    class="context-menu__item"
                    @click="handleHideConversation"
                >
                    删除
                </button>
                <button
                    v-if="canPinConversation"
                    type="button"
                    class="context-menu__item"
                    @click="handleTogglePin"
                >
                    {{ contextConversation?.is_pinned ? "取消置顶" : "置顶" }}
                </button>
            </div>
        </transition>

        <a-modal
            v-model:open="allResultModalOpen"
            title="搜索结果"
            :footer="null"
            :width="CHAT_MODAL_WIDTH_MD"
            :body-style="tallModalBodyStyle"
        >
            <a-tabs
                v-model:activeKey="activeResultTab"
                class="search-result-tabs"
            >
                <a-tab-pane key="conversations" tab="会话">
                    <div class="drawer-list">
                        <div
                            v-for="conversation in chatAudit.searchResult
                                ?.conversations || []"
                            :key="`result-conversation-${conversation.id}`"
                            class="drawer-list-item"
                        >
                            <div class="drawer-list-item__content">
                                <div class="drawer-list-title">
                                    {{ conversation.name }}
                                </div>
                                <div class="drawer-list-desc">
                                    {{
                                        conversation.type === "group"
                                            ? "群聊"
                                            : "私聊"
                                    }}
                                </div>
                            </div>
                            <a-button
                                size="small"
                                @click="
                                    handleConversationSearchAction(conversation)
                                "
                                >{{
                                    getConversationSearchActionLabel(
                                        conversation,
                                    )
                                }}</a-button
                            >
                        </div>
                        <a-empty
                            v-if="
                                !(chatAudit.searchResult?.conversations || [])
                                    .length
                            "
                            description="暂无匹配会话"
                        />
                    </div>
                </a-tab-pane>
                <a-tab-pane key="users" tab="用户">
                    <div class="drawer-list">
                        <div
                            v-for="user in chatAudit.searchResult?.users || []"
                            :key="`result-user-${user.id}`"
                            class="drawer-list-item"
                        >
                            <div class="drawer-list-item__content">
                                <div class="drawer-list-title">
                                    {{ user.display_name || user.username }}
                                </div>
                                <div class="drawer-list-desc">
                                    {{ user.username }}
                                </div>
                            </div>
                            <a-space>
                                <a-button
                                    size="small"
                                    @click="openDirectConversation(user.id)"
                                    :disabled="!user.can_open_direct"
                                    >私聊</a-button
                                >
                                <a-button
                                    v-if="canAddFriend"
                                    size="small"
                                    type="primary"
                                    @click="handleSendFriendRequest(user.id)"
                                    >加好友</a-button
                                >
                            </a-space>
                        </div>
                        <a-empty
                            v-if="!(chatAudit.searchResult?.users || []).length"
                            description="暂无匹配用户"
                        />
                    </div>
                </a-tab-pane>
                <a-tab-pane key="groups" tab="群聊">
                    <div class="drawer-list">
                        <div
                            v-for="conversation in matchedGroups"
                            :key="`result-group-${conversation.id}`"
                            class="drawer-list-item"
                        >
                            <div class="drawer-list-item__content">
                                <div class="drawer-list-title">
                                    {{ conversation.name }}
                                </div>
                                <div class="drawer-list-desc">群聊</div>
                            </div>
                            <a-button
                                size="small"
                                @click="handleGroupSearchAction(conversation)"
                                >{{
                                    getGroupSearchActionLabel(conversation)
                                }}</a-button
                            >
                        </div>
                        <a-empty
                            v-if="!matchedGroups.length"
                            description="暂无匹配群聊"
                        />
                    </div>
                </a-tab-pane>
                <a-tab-pane key="messages" tab="聊天记录">
                    <div class="drawer-list">
                        <button
                            v-for="messageItem in chatAudit.searchResult
                                ?.messages || []"
                            :key="`result-message-${messageItem.message_id}`"
                            type="button"
                            class="drawer-list-item search-message-card"
                            @click="
                                openConversation(
                                    messageItem.conversation_id,
                                    messageItem.sequence,
                                )
                            "
                        >
                            <div class="search-message-card__top">
                                <div class="drawer-list-title">
                                    {{ messageItem.conversation_name }}
                                </div>
                                <div class="drawer-list-time">
                                    {{
                                        formatShortTime(messageItem.created_at)
                                    }}
                                </div>
                            </div>
                            <div class="drawer-list-desc">
                                {{ messageItem.content_preview }}
                            </div>
                        </button>
                        <a-empty
                            v-if="
                                !(chatAudit.searchResult?.messages || []).length
                            "
                            description="暂无匹配聊天记录"
                        />
                    </div>
                </a-tab-pane>
            </a-tabs>
        </a-modal>

        <a-modal
            v-model:open="discoverModalOpen"
            title="加好友/群"
            :footer="null"
            :width="CHAT_MODAL_WIDTH_MD"
            :body-style="tallModalBodyStyle"
        >
            <a-input
                v-model:value="discoverKeyword"
                allow-clear
                placeholder="搜索用户名、昵称或群聊名称"
            />
            <a-tabs v-model:activeKey="discoverTab" class="discover-tabs">
                <a-tab-pane key="users" tab="匹配的用户">
                    <div class="drawer-list">
                        <div
                            v-for="user in discoverUsers"
                            :key="`discover-user-${user.id}`"
                            class="drawer-list-item"
                        >
                            <div class="drawer-list-item__content">
                                <div class="drawer-list-title">
                                    {{ user.display_name || user.username }}
                                </div>
                                <div class="drawer-list-desc">
                                    {{ user.username }}
                                </div>
                            </div>
                            <a-space>
                                <a-button
                                    size="small"
                                    @click="openDirectConversation(user.id)"
                                    :disabled="!user.can_open_direct"
                                    >私聊</a-button
                                >
                                <a-button
                                    v-if="canAddFriend"
                                    size="small"
                                    type="primary"
                                    @click="handleSendFriendRequest(user.id)"
                                    >加好友</a-button
                                >
                            </a-space>
                        </div>
                        <a-empty
                            v-if="
                                !discoverUsers.length && discoverKeyword.trim()
                            "
                            description="暂无匹配用户"
                        />
                    </div>
                </a-tab-pane>
                <a-tab-pane key="groups" tab="匹配的群聊">
                    <div class="drawer-list">
                        <div
                            v-for="conversation in discoverGroups"
                            :key="`discover-group-${conversation.id}`"
                            class="drawer-list-item"
                        >
                            <div class="drawer-list-item__content">
                                <div class="drawer-list-title">
                                    {{ conversation.name }}
                                </div>
                                <div class="drawer-list-desc">群聊</div>
                            </div>
                            <a-button
                                size="small"
                                @click="handleGroupSearchAction(conversation)"
                                >{{
                                    getGroupSearchActionLabel(conversation)
                                }}</a-button
                            >
                        </div>
                        <a-empty
                            v-if="
                                !discoverGroups.length && discoverKeyword.trim()
                            "
                            description="暂无匹配群聊"
                        />
                    </div>
                </a-tab-pane>
            </a-tabs>
        </a-modal>

        <a-modal
            v-model:open="groupModalOpen"
            title="创建群聊"
            @ok="handleCreateGroup"
            :confirm-loading="groupSaving"
            :width="CHAT_MODAL_WIDTH_SM"
            :body-style="tallModalBodyStyle"
        >
            <a-form layout="vertical" :model="groupForm">
                <a-form-item label="群名称">
                    <a-input v-model:value="groupForm.name" :maxlength="50" />
                </a-form-item>
                <a-form-item label="初始成员">
                    <a-select
                        v-model:value="groupForm.member_user_ids"
                        mode="multiple"
                        :options="friendOptions"
                        placeholder="选择好友加入群聊"
                    />
                </a-form-item>
                <a-form-item label="入群需审批">
                    <a-switch
                        v-model:checked="groupForm.join_approval_required"
                    />
                </a-form-item>
                <a-form-item label="允许普通成员邀请">
                    <a-switch v-model:checked="groupForm.allow_member_invite" />
                </a-form-item>
            </a-form>
        </a-modal>
    </section>
</template>

<script setup lang="ts">
import { useConversationListScene } from "@/modules/chat-center/composables/useConversationListScene";

const {
    CHAT_MODAL_WIDTH_MD,
    CHAT_MODAL_WIDTH_SM,
    activeResultTab,
    allResultModalOpen,
    avatarStyle,
    avatarText,
    canAddFriend,
    canCreateGroup,
    canHideConversation,
    canPinConversation,
    chatAudit,
    chatConversationState,
    contextConversation,
    contextMenuOpen,
    contextMenuStyle,
    conversationDisplayName,
    discoverGroups,
    discoverKeyword,
    discoverModalOpen,
    discoverTab,
    discoverUsers,
    formatShortTime,
    friendOptions,
    getConversationSearchActionLabel,
    getGroupSearchActionLabel,
    getUnreadBadgeStyle,
    getVisibleUnreadCount,
    groupForm,
    groupModalOpen,
    groupSaving,
    handleConversationSearchAction,
    handleCreateGroup,
    handleGroupSearchAction,
    handleHideConversation,
    handleQuickMenuClick,
    handleSearchBlur,
    handleSendFriendRequest,
    handleTogglePin,
    handleTopMatchClick,
    matchedGroups,
    openConversation,
    openConversationMenu,
    openDirectConversation,
    recentMessageMatches,
    searchDropdownVisible,
    searchFocused,
    searchKeyword,
    showQuickActionTrigger,
    tallModalBodyStyle,
    topUserMatches,
} = useConversationListScene();
</script>

<style scoped>
.chat-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    height: 100%;
    padding: 14px;
    background: var(--chat-panel-bg);
    border: 1px solid var(--chat-panel-border);
    border-radius: 16px 0 0 16px;
    box-shadow: none;
}

.toolbar-row,
.drawer-list-item,
.conversation-item__top,
.conversation-item__bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.search-box {
    position: relative;
    flex: 1;
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

.context-menu {
    position: absolute;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 136px;
    padding: 6px;
    background: var(--chat-panel-bg-strong);
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    box-shadow: var(--chat-panel-shadow);
}

.context-menu {
    position: fixed;
}

.context-menu__item {
    width: 100%;
    padding: 9px 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--chat-text-primary);
    text-align: left;
    cursor: pointer;
}

.context-menu__item:hover {
    background: var(--chat-accent-soft);
}

:deep(.ant-dropdown-menu) {
    padding: 6px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: var(--chat-panel-bg-strong);
    box-shadow: var(--chat-panel-shadow);
}

:deep(.ant-dropdown-menu-item) {
    border-radius: 8px;
    color: var(--chat-text-primary);
}

:deep(.ant-dropdown-menu-item:hover),
:deep(.ant-dropdown-menu-item-active),
:deep(.ant-dropdown-menu-item-selected) {
    background: var(--chat-accent-soft);
}

.context-menu-fade-enter-active,
.context-menu-fade-leave-active {
    transition:
        opacity 0.16s ease,
        transform 0.16s ease;
}

.context-menu-fade-enter-from,
.context-menu-fade-leave-to {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
}

.search-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    z-index: 20;
    padding: 8px;
    background: var(--chat-panel-bg-strong);
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    box-shadow: var(--chat-panel-shadow);
}

.search-dropdown__section,
.chat-panel__list,
.drawer-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.search-dropdown__label {
    padding: 2px 6px 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--chat-text-secondary);
}

.chat-panel__list,
.drawer-list {
    min-height: 0;
    overflow: auto;
}

.search-dropdown__item,
.search-dropdown__more {
    width: 100%;
    padding: 10px 12px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--chat-text-primary);
    text-align: left;
    cursor: pointer;
}

.search-dropdown__item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.search-dropdown__primary,
.search-dropdown__secondary {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.search-dropdown__item small,
.drawer-list-desc,
.conversation-item__preview,
.conversation-item__time {
    color: var(--chat-text-secondary);
}

.search-dropdown__item:hover,
.search-dropdown__more:hover {
    background: var(--chat-accent-soft);
}

.search-dropdown__more {
    color: var(--chat-accent);
}

.conversation-item {
    display: grid;
    grid-template-columns: 42px 1fr;
    gap: 6px;
    padding: 10px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: var(--chat-panel-bg-strong);
    text-align: left;
    cursor: pointer;
    transition: 0.2s ease;
}

.conversation-item:hover,
.conversation-item.active {
    border-color: color-mix(in srgb, var(--chat-accent) 32%, transparent);
    box-shadow: 0 8px 18px
        color-mix(in srgb, var(--chat-accent) 16%, transparent);
}

.conversation-item.pinned {
    background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--chat-accent-soft) 70%, transparent),
        var(--chat-panel-bg-strong)
    );
}

.conversation-item__body {
    min-width: 0;
}

.conversation-item__badge {
    flex: 0 0 auto;
}

.conversation-item__badge :deep(.ant-badge-count) {
    box-shadow: none;
}

.conversation-item__name,
.drawer-list-title {
    font-weight: 700;
    color: var(--chat-text-primary);
}

.conversation-item__preview {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.drawer-list-item {
    padding: 12px 14px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: var(--chat-panel-bg-strong);
}

.drawer-list-item__content {
    flex: 1;
    min-width: 0;
}

.drawer-list-title,
.drawer-list-desc {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.search-message-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    width: 100%;
    text-align: left;
    cursor: pointer;
    transition:
        border-color 0.18s ease,
        background-color 0.18s ease,
        transform 0.18s ease;
}

.search-message-card:hover {
    border-color: color-mix(in srgb, var(--chat-accent) 30%, transparent);
    background: var(--chat-accent-soft);
    transform: translateY(-1px);
}

.search-message-card__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.drawer-list-time {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--chat-text-secondary);
}

.discover-tabs {
    margin-top: 12px;
}

.search-result-tabs :deep(.ant-tabs-nav) {
    position: sticky;
    top: 0;
    z-index: 2;
    margin-bottom: 12px;
    padding-top: 2px;
    background: var(--chat-panel-bg-strong);
}

@media (max-width: 960px) {
    .chat-panel {
        min-height: 320px;
    }
}
</style>
