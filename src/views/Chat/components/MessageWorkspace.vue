<template>
    <main class="chat-main" :style="chatMainStyle">
        <template v-if="chatConversationState.activeConversation">
            <header class="chat-main__header">
                <div class="chat-main__header-main">
                    <div class="chat-main__title-row">
                        <div class="chat-main__title">
                            {{ chatConversationState.activeConversation.name }}
                        </div>
                        <div
                            v-if="
                                chatConversationState.activeConversation
                                    .type === 'group'
                            "
                            class="chat-main__meta-tag"
                        >
                            {{
                                chatConversationState.activeConversation
                                    .member_count
                            }}
                            人群聊
                        </div>
                    </div>
                    <div v-if="typingText" class="chat-main__meta">
                        {{ typingText }}
                    </div>
                    <div
                        v-if="directSourceHintText"
                        class="chat-main__source-hint"
                    >
                        {{ directSourceHintText }}
                    </div>
                </div>
                <a-space>
                    <template v-if="showDirectActions">
                        <a-button type="primary" ghost @click="handleAddFriend"
                            >加好友</a-button
                        >
                    </template>
                    <a-button
                        v-if="showSettingsTrigger"
                        class="chat-menu-trigger"
                        @click="openSettingsDrawer"
                    >
                        <MenuOutlined />
                    </a-button>
                </a-space>
            </header>

            <div
                ref="messageContainerRef"
                class="chat-main__messages"
                :class="{
                    'chat-main__messages--positioning': isPositioningMessages,
                }"
            >
                <a-button
                    v-if="canLoadOlderMessages"
                    size="small"
                    class="chat-main__load-more"
                    :loading="chatMessageState.loadingMessages"
                    @click="handleLoadOlderMessages"
                    >加载更早消息</a-button
                >
                <div
                    v-if="messageSelectionMode"
                    class="chat-main__selection-bar"
                >
                    <span>已选择 {{ selectedMessageIds.length }} 条消息</span>
                    <a-space>
                        <a-button
                            size="small"
                            @click="handleForwardSelection"
                            v-if="canForwardMessage"
                            >转发</a-button
                        >
                        <a-button size="small" @click="clearMessageSelection"
                            >取消多选</a-button
                        >
                    </a-space>
                </div>
                <div
                    v-for="messageItem in chatMessageState.activeMessages"
                    :key="messageItem.id"
                    class="message-row"
                    :class="[
                        messageRowClass(messageItem),
                        {
                            'message-row--selection-mode': messageSelectionMode,
                            'message-row--revoked':
                                isRevokedMessage(messageItem),
                        },
                    ]"
                    :data-sequence="messageItem.sequence"
                    @click.capture="handleMessageRowClick(messageItem, $event)"
                >
                    <template v-if="messageItem.is_system">
                        <div class="system-bubble">
                            {{ messageItem.content }}
                        </div>
                    </template>
                    <template
                        v-else-if="shouldRenderRevokedPlaceholder(messageItem)"
                    >
                        <div
                            class="message-revoked-row"
                            @contextmenu.prevent.stop="
                                openMessageMenu($event, messageItem)
                            "
                        >
                            <span>{{
                                isSelfMessage(messageItem)
                                    ? "你已撤回一条消息"
                                    : "对方已撤回"
                            }}</span>
                            <button
                                v-if="canRestoreRevokedMessage(messageItem)"
                                type="button"
                                class="message-revoked-row__restore"
                                @click.stop="
                                    handleRestoreRevokedMessage(messageItem)
                                "
                            >
                                编辑
                            </button>
                        </div>
                    </template>
                    <template v-else>
                        <div
                            class="message-row__content"
                            :class="{ self: isSelfMessage(messageItem) }"
                        >
                            <a-avatar
                                v-if="!isSelfMessage(messageItem)"
                                class="message-row__avatar"
                                :src="messageItem.sender?.avatar || undefined"
                            >
                                {{
                                    avatarText(
                                        messageItem.sender?.display_name ||
                                            messageItem.sender?.username ||
                                            "?",
                                    )
                                }}
                            </a-avatar>
                            <div
                                class="message-bubble-wrap"
                                :class="{ self: isSelfMessage(messageItem) }"
                            >
                                <div
                                    v-if="showGroupSenderLine(messageItem)"
                                    class="message-bubble__sender-line"
                                    :class="{
                                        self: isSelfMessage(messageItem),
                                    }"
                                >
                                    <span class="message-bubble__sender">{{
                                        getSenderLabel(messageItem)
                                    }}</span>
                                </div>
                                <div
                                    v-if="shouldShowRevokedTag(messageItem)"
                                    class="message-bubble__revoked-tag"
                                >
                                    已撤回
                                </div>
                                <div
                                    class="message-bubble-row"
                                    :class="{
                                        self: isSelfMessage(messageItem),
                                    }"
                                >
                                    <span
                                        v-if="isSelfMessage(messageItem)"
                                        class="message-bubble__time self"
                                        >{{
                                            formatTime(messageItem.created_at)
                                        }}</span
                                    >
                                    <div
                                        v-if="
                                            isSelfMessage(messageItem) &&
                                            messageItem.local_status
                                        "
                                        class="message-status message-status--inline"
                                    >
                                        <span
                                            v-if="
                                                messageItem.local_status ===
                                                'sending'
                                            "
                                            class="message-status__spinner"
                                            aria-label="发送中"
                                        ></span>
                                        <a-tooltip
                                            v-else
                                            :title="
                                                getMessageFailureTooltip(
                                                    messageItem.local_error,
                                                )
                                            "
                                        >
                                            <button
                                                type="button"
                                                class="message-status__failed"
                                                @click.stop="
                                                    openMessageMenu(
                                                        $event,
                                                        messageItem,
                                                    )
                                                "
                                            >
                                                !
                                            </button>
                                        </a-tooltip>
                                    </div>
                                    <div
                                        class="message-bubble"
                                        :class="{
                                            self: isSelfMessage(messageItem),
                                            'message-bubble--interactive':
                                                hasMessageBubbleAction(
                                                    messageItem,
                                                ),
                                            'message-bubble--asset':
                                                isAssetMessage(messageItem),
                                        }"
                                        @click="
                                            handleMessageBubbleClick(
                                                messageItem,
                                            )
                                        "
                                        @contextmenu.prevent.stop="
                                            openMessageMenu($event, messageItem)
                                        "
                                    >
                                        <div
                                            v-if="
                                                getForwardedPayload(messageItem)
                                            "
                                            class="message-bubble__forwarded"
                                        >
                                            转发自
                                            {{
                                                getForwardedPayload(messageItem)
                                                    ?.sender_name
                                            }}
                                        </div>
                                        <button
                                            v-if="getReplyPayload(messageItem)"
                                            type="button"
                                            class="message-bubble__reply"
                                            :disabled="
                                                Boolean(
                                                    getReplyPayload(messageItem)
                                                        ?.is_revoked,
                                                )
                                            "
                                            @click.stop="
                                                handleReplyJump(
                                                    getReplyPayload(
                                                        messageItem,
                                                    )!,
                                                )
                                            "
                                        >
                                            <span
                                                class="message-bubble__reply-arrow"
                                                ><ArrowUpOutlined
                                            /></span>
                                            <div
                                                class="message-bubble__reply-body"
                                            >
                                                <div
                                                    class="message-bubble__reply-sender"
                                                >
                                                    {{
                                                        getReplyPayload(
                                                            messageItem,
                                                        )?.sender_name
                                                    }}
                                                </div>
                                                <div
                                                    class="message-bubble__reply-content"
                                                >
                                                    "{{
                                                        getReplyPayload(
                                                            messageItem,
                                                        )?.content_preview
                                                    }}"
                                                </div>
                                            </div>
                                        </button>
                                        <template
                                            v-if="
                                                getGroupInvitationPayload(
                                                    messageItem,
                                                )
                                            "
                                        >
                                            <button
                                                type="button"
                                                class="group-invitation-card"
                                                :class="{
                                                    self: isSelfMessage(
                                                        messageItem,
                                                    ),
                                                }"
                                                @click.stop="
                                                    openGroupInvitationModal(
                                                        messageItem,
                                                    )
                                                "
                                            >
                                                <div
                                                    class="group-invitation-card__header"
                                                >
                                                    群聊邀请
                                                </div>
                                                <div
                                                    class="group-invitation-card__main"
                                                >
                                                    <a-avatar
                                                        :src="
                                                            getGroupInvitationPayload(
                                                                messageItem,
                                                            )?.group_avatar ||
                                                            undefined
                                                        "
                                                        :size="44"
                                                    >
                                                        {{
                                                            avatarText(
                                                                getGroupInvitationPayload(
                                                                    messageItem,
                                                                )?.group_name ||
                                                                    "群",
                                                            )
                                                        }}
                                                    </a-avatar>
                                                    <div
                                                        class="group-invitation-card__body"
                                                    >
                                                        <div
                                                            class="group-invitation-card__name"
                                                        >
                                                            {{
                                                                getGroupInvitationPayload(
                                                                    messageItem,
                                                                )?.group_name
                                                            }}
                                                        </div>
                                                        <div
                                                            class="group-invitation-card__meta"
                                                        >
                                                            {{
                                                                getGroupInvitationPayload(
                                                                    messageItem,
                                                                )
                                                                    ?.member_count ||
                                                                0
                                                            }}
                                                            人
                                                            <span>·</span>
                                                            {{
                                                                getGroupInvitationPayload(
                                                                    messageItem,
                                                                )
                                                                    ?.join_approval_required
                                                                    ? "申请后需审批"
                                                                    : "可直接加入"
                                                            }}
                                                        </div>
                                                        <div
                                                            class="group-invitation-card__desc"
                                                        >
                                                            {{
                                                                getGroupInvitationPayload(
                                                                    messageItem,
                                                                )?.inviter
                                                                    .display_name ||
                                                                getGroupInvitationPayload(
                                                                    messageItem,
                                                                )?.inviter
                                                                    .username
                                                            }}
                                                            邀请你加入群聊
                                                        </div>
                                                    </div>
                                                </div>
                                                <div
                                                    class="group-invitation-card__footer"
                                                >
                                                    <span
                                                        v-if="
                                                            isSelfMessage(
                                                                messageItem,
                                                            )
                                                        "
                                                        >已发送邀请消息</span
                                                    >
                                                    <span v-else
                                                        >点击查看并申请加入</span
                                                    >
                                                </div>
                                            </button>
                                        </template>
                                        <template
                                            v-else-if="
                                                isChatRecordMessage(messageItem)
                                            "
                                        >
                                            <ChatRecordCard
                                                :record="
                                                    getChatRecordPayload(
                                                        messageItem,
                                                    )!
                                                "
                                                @open="
                                                    openChatRecordViewerFromMessage(
                                                        messageItem,
                                                    )
                                                "
                                            />
                                        </template>
                                        <template
                                            v-else-if="
                                                isAssetMessage(messageItem)
                                            "
                                        >
                                            <div
                                                class="attachment-bubble"
                                                :class="{
                                                    self: isSelfMessage(
                                                        messageItem,
                                                    ),
                                                    'attachment-bubble--media':
                                                        canPreviewImage(
                                                            messageItem,
                                                        ) ||
                                                        canPreviewVideo(
                                                            messageItem,
                                                        ),
                                                }"
                                            >
                                                <div
                                                    v-if="
                                                        canPreviewImage(
                                                            messageItem,
                                                        ) ||
                                                        canPreviewVideo(
                                                            messageItem,
                                                        )
                                                    "
                                                    class="attachment-bubble__media-shell"
                                                    :style="
                                                        getAssetPreviewBoxStyle(
                                                            messageItem,
                                                        )
                                                    "
                                                >
                                                    <img
                                                        v-if="
                                                            canPreviewImage(
                                                                messageItem,
                                                            )
                                                        "
                                                        :src="
                                                            getAssetPreviewImageUrl(
                                                                messageItem,
                                                            )
                                                        "
                                                        :alt="
                                                            getAssetDisplayName(
                                                                messageItem,
                                                            )
                                                        "
                                                        class="attachment-bubble__preview"
                                                        loading="lazy"
                                                        decoding="async"
                                                    />
                                                    <VideoAttachmentThumbnail
                                                        v-else-if="
                                                            canPreviewVideo(
                                                                messageItem,
                                                            )
                                                        "
                                                        :poster-url="
                                                            getVideoPosterUrl(
                                                                messageItem,
                                                            )
                                                        "
                                                        :source-url="
                                                            getAssetMessagePayload(
                                                                messageItem,
                                                            )?.url || ''
                                                        "
                                                        :alt="
                                                            getAssetDisplayName(
                                                                messageItem,
                                                            )
                                                        "
                                                        class="attachment-bubble__preview attachment-bubble__preview--video"
                                                    />
                                                    <div
                                                        v-if="
                                                            isAssetUploading(
                                                                messageItem,
                                                            )
                                                        "
                                                        class="attachment-bubble__overlay"
                                                    >
                                                        <div
                                                            class="attachment-bubble__progress-ring"
                                                        >
                                                            {{
                                                                getAssetUploadProgress(
                                                                    messageItem,
                                                                )
                                                            }}%
                                                        </div>
                                                    </div>
                                                    <div
                                                        v-else-if="
                                                            showVideoPlayOverlay(
                                                                messageItem,
                                                            )
                                                        "
                                                        class="attachment-bubble__overlay"
                                                    >
                                                        <button
                                                            type="button"
                                                            class="attachment-bubble__play-button"
                                                            @click.stop="
                                                                openAssetMessage(
                                                                    messageItem,
                                                                )
                                                            "
                                                        >
                                                            <CaretRightFilled />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div
                                                    v-else
                                                    class="attachment-file-card"
                                                >
                                                    <span
                                                        class="attachment-file-card__icon"
                                                    >
                                                        <FileOutlined />
                                                    </span>
                                                    <div
                                                        class="attachment-file-card__body"
                                                    >
                                                        <span
                                                            class="attachment-file-card__name"
                                                            >{{
                                                                getAssetDisplayName(
                                                                    messageItem,
                                                                )
                                                            }}</span
                                                        >
                                                        <span
                                                            class="attachment-file-card__size"
                                                            >{{
                                                                formatAssetFileSize(
                                                                    messageItem,
                                                                )
                                                            }}</span
                                                        >
                                                    </div>
                                                </div>
                                            </div>
                                        </template>
                                        <template v-else>
                                            <div class="message-bubble__text">
                                                {{ messageItem.content }}
                                            </div>
                                        </template>
                                    </div>
                                    <span
                                        v-if="!isSelfMessage(messageItem)"
                                        class="message-bubble__time"
                                        >{{
                                            formatTime(messageItem.created_at)
                                        }}</span
                                    >
                                </div>
                            </div>
                            <a-avatar
                                v-if="isSelfMessage(messageItem)"
                                class="message-row__avatar message-row__avatar--self"
                                :src="messageItem.sender?.avatar || undefined"
                            >
                                {{
                                    avatarText(
                                        messageItem.sender?.display_name ||
                                            messageItem.sender?.username ||
                                            "?",
                                    )
                                }}
                            </a-avatar>
                        </div>
                        <button
                            v-if="messageSelectionMode"
                            type="button"
                            class="message-row__select"
                            :class="{
                                'is-checked': isMessageSelected(messageItem.id),
                            }"
                            tabindex="-1"
                            aria-hidden="true"
                        >
                            <span class="message-row__select-indicator"></span>
                        </button>
                    </template>
                </div>
            </div>

            <div
                class="chat-main__composer-resizer"
                @mousedown="startComposerResize"
            ></div>

            <footer
                class="chat-main__composer"
                :class="{ 'chat-main__composer--disabled': composerDisabled }"
            >
                <div class="chat-main__composer-toolbar">
                    <a-dropdown placement="topLeft" :trigger="['hover']">
                        <a-button
                            class="chat-main__composer-trigger"
                            :disabled="composerDisabled || attachmentUploading"
                        >
                            <PaperClipOutlined />
                        </a-button>
                        <template #overlay>
                            <a-menu @click="handleComposerMenuClick">
                                <a-menu-item key="attachment"
                                    >本地附件</a-menu-item
                                >
                                <a-menu-item key="asset-picker"
                                    >资源中心</a-menu-item
                                >
                            </a-menu>
                        </template>
                    </a-dropdown>
                </div>
                <div v-if="quotedMessage" class="chat-main__quote-bar">
                    <div>
                        <div class="chat-main__quote-title">引用回复</div>
                        <div class="chat-main__quote-content">
                            {{ getMessageQuotePreview(quotedMessage) }}
                        </div>
                    </div>
                    <button
                        type="button"
                        class="chat-main__quote-close"
                        @click="quotedMessage = null"
                    >
                        关闭
                    </button>
                </div>
                <RichMessageComposer
                    ref="composerRef"
                    :disabled="composerDisabled"
                    class="chat-main__composer-input"
                    :placeholder="composerPlaceholder"
                    :send-hotkey="settingsStore.chatSendHotkey"
                    @typing-change="handleComposerTypingChange"
                    @paste-files="handleComposerPasteFiles"
                    @request-submit="handleSendMessage"
                />
                <div class="chat-main__composer-actions">
                    <input
                        ref="attachmentInputRef"
                        type="file"
                        class="chat-main__attachment-input"
                        :disabled="!canSendAttachment"
                        multiple
                        @change="handleAttachmentSelection"
                    />
                    <a-button
                        type="primary"
                        :disabled="composerDisabled"
                        @click="handleSendMessage"
                        >发送</a-button
                    >
                </div>
            </footer>
        </template>

        <a-empty v-else description="选择一个会话开始聊天" />

        <transition name="message-menu-fade">
            <div
                v-if="messageMenuOpen && messageMenuMessage"
                class="failed-menu"
                :style="messageMenuStyle"
            >
                <div
                    v-if="messageMenuMessage.local_status === 'failed'"
                    class="failed-menu__hint"
                >
                    <div class="failed-menu__hint-title">
                        {{
                            getMessageFailureHint(
                                messageMenuMessage.local_error,
                            )
                        }}
                    </div>
                    <div
                        v-if="
                            getMessageFailureDetail(
                                messageMenuMessage.local_error,
                            )
                        "
                        class="failed-menu__hint-detail"
                    >
                        {{
                            getMessageFailureDetail(
                                messageMenuMessage.local_error,
                            )
                        }}
                    </div>
                </div>
                <button
                    type="button"
                    class="failed-menu__item"
                    @click="handleCopyMessage"
                >
                    复制
                </button>
                <button
                    v-if="isAssetMessage(messageMenuMessage)"
                    type="button"
                    class="failed-menu__item"
                    @click="handleMenuDownloadAssetMessage"
                >
                    下载
                </button>
                <button
                    v-if="
                        isAssetMessage(messageMenuMessage) &&
                        canSaveChatAttachmentToResource
                    "
                    type="button"
                    class="failed-menu__item"
                    @click="handleMenuSaveAssetToResource"
                >
                    保存到资源中心
                </button>
                <button
                    v-if="canForwardMessage"
                    type="button"
                    class="failed-menu__item"
                    @click="handleForwardMessage"
                >
                    转发
                </button>
                <button
                    type="button"
                    class="failed-menu__item"
                    @click="handleQuoteMessage"
                >
                    引用
                </button>
                <button
                    v-if="canDeleteMessage(messageMenuMessage)"
                    type="button"
                    class="failed-menu__item"
                    @click="handleDeleteMessage"
                >
                    删除
                </button>
                <button
                    type="button"
                    class="failed-menu__item"
                    @click="enableMessageSelection(messageMenuMessage)"
                >
                    多选
                </button>
                <button
                    v-if="canRevokeMessage(messageMenuMessage)"
                    type="button"
                    class="failed-menu__item"
                    @click="handleRevokeMessage"
                >
                    撤回
                </button>
                <button
                    v-if="messageMenuMessage.local_status === 'failed'"
                    type="button"
                    class="failed-menu__item"
                    @click="handleRetryMessage"
                >
                    重新发送
                </button>
            </div>
        </transition>

        <ChatWorkspaceForwardDialogs
            :forward-modal-open="forwardModalOpen"
            :forward-mode-modal-open="forwardModeModalOpen"
            :forwarding-message-count="forwardingMessageIds.length"
            :forward-search-keyword="forwardSearchKeyword"
            :selected-forward-target-key="selectedForwardTargetKey"
            :forwarding="forwarding"
            :recent-forward-targets="recentForwardTargets"
            :filtered-forward-targets="filteredForwardTargets"
            :forward-summary="buildForwardMessageSummary()"
            :pending-forward-target-name="pendingForwardTarget?.name || ''"
            :avatar-text="avatarText"
            :modal-width="CHAT_MODAL_WIDTH_LG"
            @update:forward-modal-open="forwardModalOpen = $event"
            @update:forward-mode-modal-open="forwardModeModalOpen = $event"
            @update:forward-search-keyword="forwardSearchKeyword = $event"
            @select-target="handleSelectForwardTarget"
            @confirm-mode="handleConfirmForwardMode"
        />

        <a-modal
            v-model:open="groupInvitationModalOpen"
            title="群聊邀请"
            :footer="null"
            :width="CHAT_MODAL_WIDTH_LG"
        >
            <div v-if="activeGroupInvitation" class="group-invitation-modal">
                <div class="group-invitation-modal__summary">
                    <a-avatar
                        :src="activeGroupInvitation.group_avatar || undefined"
                        :size="64"
                    >
                        {{
                            avatarText(activeGroupInvitation.group_name || "群")
                        }}
                    </a-avatar>
                    <div class="group-invitation-modal__body">
                        <div class="group-invitation-modal__name">
                            {{ activeGroupInvitation.group_name }}
                        </div>
                        <div class="group-invitation-modal__meta">
                            {{ activeGroupInvitation.member_count }} 人群聊
                        </div>
                        <div class="group-invitation-modal__desc">
                            邀请人：{{
                                activeGroupInvitation.inviter.display_name ||
                                activeGroupInvitation.inviter.username
                            }}
                        </div>
                        <div class="group-invitation-modal__desc">
                            {{
                                activeGroupInvitation.join_approval_required
                                    ? "提交后需要管理员审批。"
                                    : "提交后可直接加入该群聊。"
                            }}
                        </div>
                    </div>
                </div>
                <div class="group-invitation-modal__actions">
                    <a-button @click="groupInvitationModalOpen = false"
                        >关闭</a-button
                    >
                    <a-button
                        v-if="
                            activeGroupInvitation.inviter.id !==
                            userStore.user?.id
                        "
                        type="primary"
                        :loading="groupInvitationApplying"
                        @click="handleApplyGroupInvitation"
                    >
                        申请加入群聊
                    </a-button>
                </div>
            </div>
        </a-modal>

        <ChatWorkspaceRecordModals
            :viewer-stack="chatRecordViewerStack"
            @open-record="openChatRecordViewer"
            @close-viewer="closeChatRecordViewer"
            @remove-viewer="removeChatRecordViewer"
            @copy-entry="handleCopyChatRecordEntry"
            @forward-entry="handleForwardChatRecordEntry"
        />

        <a-drawer
            v-model:open="groupDrawerOpen"
            :title="settingsDrawerTitle"
            :width="CHAT_DRAWER_WIDTH"
            :body-style="drawerBodyStyle"
        >
            <template
                v-if="
                    chatConversationState.activeConversation?.type === 'group'
                "
            >
                <section class="settings-section">
                    <div class="settings-section__title">群资料</div>
                    <div class="group-basic-panel">
                        <div class="group-basic-panel__fields">
                            <div class="group-summary-card">
                                <a-upload
                                    v-if="canManageGroupPermission"
                                    :before-upload="handleGroupAvatarUpload"
                                    :show-upload-list="false"
                                    accept="image/*"
                                >
                                    <button
                                        type="button"
                                        class="group-summary-card__avatar group-summary-card__avatar--editable"
                                    >
                                        <a-avatar
                                            :src="
                                                groupConfigForm.avatar ||
                                                undefined
                                            "
                                            :size="56"
                                            >{{
                                                avatarText(
                                                    groupConfigForm.name ||
                                                        chatConversationState
                                                            .activeConversation
                                                            .name,
                                                )
                                            }}</a-avatar
                                        >
                                    </button>
                                </a-upload>
                                <div v-else class="group-summary-card__avatar">
                                    <a-avatar
                                        :src="
                                            groupConfigForm.avatar || undefined
                                        "
                                        :size="56"
                                        >{{
                                            avatarText(
                                                groupConfigForm.name ||
                                                    chatConversationState
                                                        .activeConversation
                                                        .name,
                                            )
                                        }}</a-avatar
                                    >
                                </div>
                                <div class="group-summary-card__body">
                                    <div class="group-summary-card__top">
                                        <template v-if="groupNameEditing">
                                            <a-input
                                                ref="groupNameInputRef"
                                                v-model:value="
                                                    groupConfigForm.name
                                                "
                                                placeholder="群名称"
                                                :maxlength="150"
                                                class="group-summary-card__input group-summary-card__input--editing"
                                                @blur="handleGroupNameBlur"
                                                @press-enter="
                                                    handleGroupNameEnter
                                                "
                                                @keydown.esc="
                                                    handleGroupNameEscape
                                                "
                                            />
                                        </template>
                                        <template v-else>
                                            <span
                                                class="group-summary-card__name"
                                                @dblclick="
                                                    toggleGroupNameEditing
                                                "
                                                >{{
                                                    groupConfigForm.name ||
                                                    chatConversationState
                                                        .activeConversation.name
                                                }}</span
                                            >
                                        </template>
                                        <button
                                            v-if="canManageGroupPermission"
                                            type="button"
                                            class="group-summary-card__edit"
                                            @click="toggleGroupNameEditing"
                                        >
                                            <EditOutlined />
                                        </button>
                                    </div>
                                    <div class="group-summary-card__meta">
                                        群号
                                        {{
                                            chatConversationState
                                                .activeConversation.id
                                        }}
                                    </div>
                                </div>
                            </div>
                            <div
                                class="group-config-field group-config-field--inline"
                            >
                                <span>预留群人数上限</span>
                                <a-input-number
                                    v-if="canManageGroupPermission"
                                    v-model:value="groupConfigForm.max_members"
                                    :min="1"
                                    :max="100000"
                                    style="width: 220px"
                                    placeholder="不限制"
                                    @blur="handleGroupMaxMembersBlur"
                                />
                                <span v-else class="settings-section__desc">
                                    {{
                                        groupConfigForm.max_members || "不限制"
                                    }}
                                </span>
                            </div>
                            <div class="group-switch-grid">
                                <div class="group-config-field">
                                    <span>入群需审批</span>
                                    <a-switch
                                        v-if="canManageGroupPermission"
                                        v-model:checked="
                                            groupConfigForm.join_approval_required
                                        "
                                        @change="
                                            handleGroupSwitchChange(
                                                'join_approval_required',
                                                $event,
                                            )
                                        "
                                    />
                                    <a-tag
                                        v-else
                                        :color="
                                            groupConfigForm.join_approval_required
                                                ? 'processing'
                                                : 'default'
                                        "
                                    >
                                        {{
                                            groupConfigForm.join_approval_required
                                                ? "已开启"
                                                : "已关闭"
                                        }}
                                    </a-tag>
                                </div>
                                <div class="group-config-field">
                                    <span>允许普通成员邀请</span>
                                    <a-switch
                                        v-if="canManageGroupPermission"
                                        v-model:checked="
                                            groupConfigForm.allow_member_invite
                                        "
                                        @change="
                                            handleGroupSwitchChange(
                                                'allow_member_invite',
                                                $event,
                                            )
                                        "
                                    />
                                    <a-tag
                                        v-else
                                        :color="
                                            groupConfigForm.allow_member_invite
                                                ? 'processing'
                                                : 'default'
                                        "
                                    >
                                        {{
                                            groupConfigForm.allow_member_invite
                                                ? "已开启"
                                                : "已关闭"
                                        }}
                                    </a-tag>
                                </div>
                                <div class="group-config-field">
                                    <span>全员禁言</span>
                                    <a-switch
                                        v-if="canManageGroupPermission"
                                        v-model:checked="
                                            groupConfigForm.mute_all
                                        "
                                        @change="
                                            handleGroupSwitchChange(
                                                'mute_all',
                                                $event,
                                            )
                                        "
                                    />
                                    <a-tag
                                        v-else
                                        :color="
                                            groupConfigForm.mute_all
                                                ? 'warning'
                                                : 'default'
                                        "
                                    >
                                        {{
                                            groupConfigForm.mute_all
                                                ? "已开启"
                                                : "已关闭"
                                        }}
                                    </a-tag>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="settings-section">
                    <div class="settings-section__header-row">
                        <div class="settings-section__title">群成员</div>
                        <button
                            type="button"
                            class="settings-section__link-button"
                            @click="openMemberModal()"
                        >
                            <span
                                >{{
                                    chatGroupState.activeMembers.length
                                }}
                                人</span
                            >
                            <span class="settings-section__link"
                                ><RightOutlined
                            /></span>
                        </button>
                    </div>
                    <div class="member-preview-grid">
                        <div
                            v-for="member in previewMembers"
                            :key="member.user.id"
                            class="member-preview"
                        >
                            <a-avatar
                                :src="member.user.avatar || undefined"
                                :size="42"
                                >{{
                                    avatarText(memberDisplayName(member))
                                }}</a-avatar
                            >
                        </div>
                        <button
                            v-if="canInviteGroupMembers"
                            type="button"
                            class="member-preview member-preview--add"
                            @click="openInviteModal()"
                        >
                            <span class="member-preview__plus"
                                ><PlusOutlined
                            /></span>
                        </button>
                    </div>
                </section>

                <section class="settings-section">
                    <div class="settings-section__title">会话偏好</div>
                    <div class="setting-switch-row">
                        <span>设为置顶</span>
                        <a-switch
                            :checked="pinnedConversation"
                            :disabled="!canPinConversationPermission"
                            @change="handlePinChange"
                        />
                    </div>
                    <div class="setting-switch-row">
                        <span>消息免打扰</span>
                        <a-switch
                            :checked="muteNotifications"
                            @change="handleMuteNotificationChange"
                        />
                    </div>
                </section>

                <section class="settings-section">
                    <div class="settings-section__title">我的本群昵称</div>
                    <div class="nickname-editor nickname-editor--card">
                        <div class="group-summary-card__top">
                            <template v-if="groupNicknameEditing">
                                <a-input
                                    ref="groupNicknameInputRef"
                                    v-model:value="groupNicknameInput"
                                    :maxlength="80"
                                    placeholder="不填则显示默认昵称"
                                    class="group-summary-card__input group-summary-card__input--editing"
                                    @blur="handleGroupNicknameBlur"
                                    @press-enter="handleGroupNicknameEnter"
                                    @keydown.esc="handleGroupNicknameEscape"
                                />
                            </template>
                            <template v-else>
                                <span
                                    class="group-summary-card__name"
                                    @dblclick="toggleGroupNicknameEditing"
                                    >{{ groupNicknamePreview }}</span
                                >
                            </template>
                            <button
                                type="button"
                                class="group-summary-card__edit"
                                @click="toggleGroupNicknameEditing"
                            >
                                <EditOutlined />
                            </button>
                        </div>
                    </div>
                </section>

                <section class="settings-section settings-section--danger">
                    <a-button
                        danger
                        block
                        class="group-leave-btn"
                        @click="handleLeaveConversation"
                        >退出群聊</a-button
                    >
                </section>
            </template>

            <template
                v-else-if="
                    chatConversationState.activeConversation?.type === 'direct'
                "
            >
                <section class="settings-section direct-profile-card">
                    <div class="direct-profile-card__main">
                        <a-avatar
                            :src="directTargetUser?.avatar || undefined"
                            :size="68"
                            >{{ avatarText(directConversationTitle) }}</a-avatar
                        >
                        <div>
                            <div class="settings-section__title">
                                {{ directConversationTitle }}
                            </div>
                            <div class="settings-section__desc">
                                {{ directTargetUser?.username || "未知用户" }}
                            </div>
                        </div>
                    </div>
                    <a-button
                        v-if="showDirectActions"
                        type="primary"
                        ghost
                        @click="handleAddFriend"
                        >加好友</a-button
                    >
                </section>

                <section class="settings-section">
                    <div class="settings-section__title">会话偏好</div>
                    <div class="setting-switch-row">
                        <span>设为置顶</span>
                        <a-switch
                            :checked="pinnedConversation"
                            :disabled="!canPinConversationPermission"
                            @change="handlePinChange"
                        />
                    </div>
                    <div class="setting-switch-row">
                        <span>消息免打扰</span>
                        <a-switch
                            :checked="muteNotifications"
                            @change="handleMuteNotificationChange"
                        />
                    </div>
                </section>

                <section class="settings-section">
                    <div class="settings-section__title">好友备注</div>
                    <template v-if="isDirectFriend && currentFriendship">
                        <div class="friend-remark-editor">
                            <div class="friend-remark-editor__top">
                                <template v-if="directRemarkEditing">
                                    <a-input
                                        ref="directRemarkInputRef"
                                        v-model:value="directRemark"
                                        :maxlength="80"
                                        placeholder="输入备注名称"
                                        class="friend-remark-editor__input"
                                        @blur="handleDirectRemarkBlur"
                                        @press-enter="handleDirectRemarkEnter"
                                        @keydown.esc="handleDirectRemarkEscape"
                                    />
                                </template>
                                <template v-else>
                                    <span class="friend-remark-editor__value">{{
                                        directRemark || directConversationTitle
                                    }}</span>
                                </template>
                                <button
                                    type="button"
                                    class="group-summary-card__edit"
                                    @click="toggleDirectRemarkEditing"
                                >
                                    <EditOutlined />
                                </button>
                            </div>
                        </div>
                    </template>
                    <div v-else class="settings-section__desc">
                        成为好友后可在这里设置备注。
                    </div>
                </section>

                <section
                    v-if="
                        isDirectFriend && currentFriendship && canDeleteFriend
                    "
                    class="settings-section settings-section--danger"
                >
                    <a-button danger block @click="handleDeleteCurrentFriend">
                        删除好友
                    </a-button>
                </section>
            </template>
        </a-drawer>

        <a-modal
            v-model:open="memberModalOpen"
            title="群成员"
            :footer="null"
            :width="CHAT_MEMBER_MODAL_WIDTH"
            :body-style="tallModalBodyStyle"
        >
            <template
                v-if="
                    chatConversationState.activeConversation?.type === 'group'
                "
            >
                <div class="entity-modal__search">
                    <a-input
                        v-model:value="memberSearchKeyword"
                        allow-clear
                        placeholder="搜索群成员"
                    />
                    <a-button
                        v-if="canManageGroupPermission"
                        danger
                        @click="handleDisbandConversation"
                    >
                        解散群聊
                    </a-button>
                </div>

                <div class="drawer-list entity-modal__list">
                    <div
                        v-for="member in filteredGroupMembers"
                        :key="member.user.id"
                        class="drawer-list-item member-item"
                        @dblclick="handleMemberDoubleClick(member)"
                    >
                        <div class="member-item__main">
                            <a-avatar
                                class="member-item__avatar"
                                :src="member.user.avatar || undefined"
                                >{{
                                    avatarText(memberDisplayName(member))
                                }}</a-avatar
                            >
                            <div class="member-item__body">
                                <div class="drawer-list-title">
                                    {{ memberDisplayName(member)
                                    }}<span
                                        v-if="memberRemarkHint(member)"
                                        class="member-item__alias"
                                        >（{{
                                            memberRemarkHint(member)
                                        }}）</span
                                    >
                                </div>
                                <div class="drawer-list-desc">
                                    <span>{{ member.user.username }}</span>
                                </div>
                            </div>
                        </div>
                        <div class="member-item__mute">
                            <span v-if="isMuteActive(member)"
                                >禁言至
                                {{ formatDateTime(member.mute_until!) }}</span
                            >
                        </div>
                        <div class="member-item__actions">
                            <a-tag>{{ memberRoleLabel(member.role) }}</a-tag>
                            <a-dropdown
                                v-if="showMemberActionMenu(member)"
                                placement="bottomRight"
                                :trigger="['hover']"
                            >
                                <a-button
                                    size="small"
                                    class="member-item__menu-trigger"
                                >
                                    <EllipsisOutlined />
                                </a-button>
                                <template #overlay>
                                    <a-menu
                                        @click="
                                            handleMemberActionMenuClick(
                                                member,
                                                $event,
                                            )
                                        "
                                    >
                                        <a-sub-menu
                                            v-if="
                                                canManageMembers &&
                                                member.role !== 'owner'
                                            "
                                            key="mute"
                                        >
                                            <template #title
                                                >设置禁言时长</template
                                            >
                                            <a-menu-item
                                                v-for="option in muteDurationOptions"
                                                :key="`mute:${option.minutes}`"
                                                >{{ option.label }}</a-menu-item
                                            >
                                        </a-sub-menu>
                                        <a-menu-item
                                            v-if="
                                                canManageMembers &&
                                                member.role !== 'owner' &&
                                                isMuteActive(member)
                                            "
                                            key="unmute"
                                            >解除禁言</a-menu-item
                                        >
                                        <a-menu-item
                                            v-if="
                                                canEditRoles &&
                                                member.role !== 'owner'
                                            "
                                            key="toggle-role"
                                            >{{
                                                member.role === "admin"
                                                    ? "设为成员"
                                                    : "设为管理员"
                                            }}</a-menu-item
                                        >
                                        <a-menu-item
                                            v-if="
                                                canManageGroupPermission &&
                                                member.role !== 'owner'
                                            "
                                            key="transfer-owner"
                                            >转让群主</a-menu-item
                                        >
                                        <a-menu-item
                                            v-if="
                                                canManageMembers &&
                                                member.role !== 'owner'
                                            "
                                            key="remove"
                                            danger
                                            >移除成员</a-menu-item
                                        >
                                    </a-menu>
                                </template>
                            </a-dropdown>
                        </div>
                    </div>
                    <a-empty
                        v-if="!filteredGroupMembers.length"
                        description="暂无匹配成员"
                    />
                </div>
            </template>
        </a-modal>

        <a-modal
            v-model:open="inviteModalOpen"
            title="邀请好友进群"
            :footer="null"
            :width="CHAT_MODAL_WIDTH_LG"
            :body-style="tallModalBodyStyle"
        >
            <template
                v-if="
                    chatConversationState.activeConversation?.type === 'group'
                "
            >
                <div class="entity-modal">
                    <div class="entity-modal__search">
                        <a-input
                            v-model:value="inviteSearchKeyword"
                            allow-clear
                            placeholder="搜索好友昵称、备注或用户名"
                        />
                    </div>
                    <div class="drawer-list entity-modal__list">
                        <label
                            v-for="friend in filteredAvailableInviteFriends"
                            :key="friend.friend_user.id"
                            class="drawer-list-item invite-item"
                        >
                            <span class="invite-item__check">
                                <a-checkbox
                                    :checked="
                                        selectedInviteUserIds.includes(
                                            friend.friend_user.id,
                                        )
                                    "
                                    @change="
                                        toggleInviteUser(friend.friend_user.id)
                                    "
                                />
                            </span>
                            <div class="invite-item__main">
                                <a-avatar
                                    :src="
                                        friend.friend_user.avatar || undefined
                                    "
                                    >{{
                                        avatarText(
                                            friend.remark ||
                                                friend.friend_user
                                                    .display_name ||
                                                friend.friend_user.username,
                                        )
                                    }}</a-avatar
                                >
                                <div>
                                    <div class="drawer-list-title">
                                        {{
                                            friend.remark ||
                                            friend.friend_user.display_name ||
                                            friend.friend_user.username
                                        }}
                                    </div>
                                    <div class="drawer-list-desc">
                                        {{
                                            friend.friend_user.display_name ||
                                            friend.friend_user.username
                                        }}
                                        · {{ friend.friend_user.username }}
                                    </div>
                                </div>
                            </div>
                        </label>
                        <a-empty
                            v-if="!filteredAvailableInviteFriends.length"
                            description="暂无可邀请好友"
                        />
                    </div>
                    <div class="entity-modal__footer">
                        <span class="entity-modal__selection"
                            >已选择
                            {{ selectedInviteUserIds.length }} 位好友</span
                        >
                        <a-button
                            type="primary"
                            :disabled="!selectedInviteUserIds.length"
                            @click="handleInviteMembers"
                            >邀请进群</a-button
                        >
                    </div>
                </div>
            </template>
        </a-modal>

        <AvatarCropModal
            :open="avatarCropOpen"
            :image-url="avatarCropImageUrl"
            :confirm-loading="groupAvatarUploading"
            @cancel="handleAvatarCropCancel"
            @confirm="handleAvatarCropConfirm"
        />

        <a-modal
            v-model:open="assetPreviewOpen"
            :title="assetPreviewTitle"
            :footer="null"
            :width="CHAT_MODAL_WIDTH_LG"
            destroy-on-close
        >
            <div v-if="previewingAssetMessage" class="asset-preview-modal">
                <img
                    v-if="canPreviewImage(previewingAssetMessage)"
                    class="asset-preview-modal__image"
                    :src="getAssetMessagePayload(previewingAssetMessage)?.url"
                    :alt="assetPreviewTitle"
                />
                <ChatVideoPlayer
                    v-else-if="canPreviewVideo(previewingAssetMessage)"
                    :key="previewingAssetMessage.id"
                    class="asset-preview-modal__video"
                    :source-url="
                        getAssetMessagePayload(previewingAssetMessage)?.url
                    "
                    :stream-url="
                        getAssetMessagePayload(previewingAssetMessage)
                            ?.stream_url
                    "
                    :poster-url="getVideoPosterUrl(previewingAssetMessage)"
                    :subtitle-tracks="
                        getAssetMessagePayload(previewingAssetMessage)
                            ?.subtitle_tracks || []
                    "
                    autoplay
                />
            </div>
        </a-modal>

        <a-modal
            v-model:open="saveAssetDialogOpen"
            title="选择保存位置"
            ok-text="保存"
            cancel-text="取消"
            @ok="confirmSaveAssetToResource"
        >
            <div class="target-modal-toolbar">
                <a-breadcrumb class="target-modal-toolbar__breadcrumb">
                    <a-breadcrumb-item
                        v-for="item in saveAssetBreadcrumbs"
                        :key="String(item.id ?? 'root')"
                    >
                        <a @click="openSaveAssetBreadcrumb(item.id)">{{
                            item.name
                        }}</a>
                    </a-breadcrumb-item>
                </a-breadcrumb>
                <a-button
                    type="primary"
                    ghost
                    size="small"
                    :disabled="!canCreateFolderInResource"
                    @click="toggleSaveAssetFolderInline"
                    >新建文件夹</a-button
                >
            </div>
            <div
                v-if="saveAssetCreateFolderOpen"
                class="target-modal-toolbar__inline"
            >
                <a-input
                    v-model:value="saveAssetFolderName"
                    placeholder="输入目录名称"
                    @press-enter="handleCreateSaveAssetFolder"
                />
                <a-button
                    type="primary"
                    size="small"
                    :loading="saveAssetSaving"
                    @click="handleCreateSaveAssetFolder"
                    >创建</a-button
                >
                <a-button
                    size="small"
                    :disabled="saveAssetSaving"
                    @click="toggleSaveAssetFolderInline"
                    >取消</a-button
                >
            </div>
            <a-table
                :columns="saveAssetColumns"
                :data-source="saveAssetFolderEntries"
                row-key="id"
                size="small"
                :pagination="false"
                :loading="saveAssetLoading"
            >
                <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'name'">
                        <button
                            type="button"
                            class="save-asset-folder-button"
                            @click="enterSaveAssetFolder(record)"
                        >
                            {{ record.display_name }}
                        </button>
                    </template>
                </template>
            </a-table>
        </a-modal>

        <AssetPickerDialog
            v-model:open="assetPickerOpen"
            @select="handleAssetPickerSelect"
        />
    </main>
</template>

<script setup lang="ts">
import {
    ArrowUpOutlined,
    CaretRightFilled,
    EditOutlined,
    EllipsisOutlined,
    FileOutlined,
    MenuOutlined,
    PaperClipOutlined,
    PlusOutlined,
    RightOutlined,
} from "@ant-design/icons-vue";
import { Modal, message } from "ant-design-vue";
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import AvatarCropModal from "@/components/AvatarCropModal.vue";
import AssetPickerDialog from "@/components/assets/AssetPickerDialog.vue";
import ChatWorkspaceForwardDialogs from "@/modules/chat-center/components/ChatWorkspaceForwardDialogs.vue";
import ChatWorkspaceRecordModals from "@/modules/chat-center/components/ChatWorkspaceRecordModals.vue";
import { useChatWorkspaceForwarding } from "@/modules/chat-center/composables/useChatWorkspaceForwarding";
import { useChatWorkspaceRecords } from "@/modules/chat-center/composables/useChatWorkspaceRecords";
import { useMessageWorkspaceAssetScene } from "@/modules/chat-center/composables/useMessageWorkspaceAssetScene";
import { useMessageWorkspaceComposerScene } from "@/modules/chat-center/composables/useMessageWorkspaceComposerScene";
import { useMessageWorkspaceMemberScene } from "@/modules/chat-center/composables/useMessageWorkspaceMemberScene";
import { useMessageWorkspaceMessageMenuScene } from "@/modules/chat-center/composables/useMessageWorkspaceMessageMenuScene";
import { useMessageWorkspaceSettingsScene } from "@/modules/chat-center/composables/useMessageWorkspaceSettingsScene";
import ChatRecordCard from "@/views/Chat/components/ChatRecordCard.vue";
import ChatVideoPlayer from "@/views/Chat/components/ChatVideoPlayer.vue";
import VideoAttachmentThumbnail from "@/views/Chat/components/VideoAttachmentThumbnail.vue";
import RichMessageComposer from "@/views/Chat/components/RichMessageComposer.vue";
import { useAuthStore } from "@/stores/auth";
import {
    getMessageFailureDetail,
    getMessageFailureHint,
    getMessageFailureTooltip,
} from "@/stores/chat/messageFailure";
import { useUserStore } from "@/stores/user";
import type {
    ChatConversationMemberItem,
    ChatMessageForwardedPayload,
    ChatMessageItem,
    ChatMessageRecordPayload,
    ChatMessageReplyPayload,
} from "@/types/chat";
import { useConversationWorkspaceScene } from "@/modules/chat-center/composables/useConversationWorkspaceScene";
import { useChatShell } from "@/views/Chat/useChatShell";
import { getErrorMessage } from "@/utils/error";
import { formatTime } from "@/utils/timeFormatter";
import { trimText } from "@/validators/common";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const userStore = useUserStore();
const {
    avatarText,
    canEditRoles,
    canLoadOlderMessages,
    canManageMembers,
    chatStore,
    formatDateTime,
    isSelfMessage,
    isStealthAuditEnabled,
    messageRowClass,
    settingsStore,
    typingText,
} = useChatShell();
const chatConversationState = chatStore.state.conversationState;
const chatMessageState = chatStore.state.messageState;
const chatFriendshipState = chatStore.state.friendshipState;
const chatGroupState = chatStore.state.groupState;
const chatConversation = chatStore.conversation;
const chatMessage = chatStore.message;
const chatFriendship = chatStore.friendship;
const chatGroup = chatStore.group;
const {
    availableInviteFriends,
    canAddFriend,
    canCreateFolderInResource,
    canDeleteAnyMessage,
    canDeleteFriend,
    canForwardMessage,
    canInviteGroupMembers,
    canManageGroupPermission,
    canPinConversationPermission,
    canRestoreRevokedDraft,
    canRevokeAnyMessage,
    canSaveChatAttachmentToResource,
    canSendAttachment,
    canSendTextMessage,
    composerBlockedReason,
    composerDisabled,
    currentConversationMember,
    currentFriendship,
    directConversationTitle,
    directTargetUser,
    isDirectFriend,
    isSelfDirectConversation,
    settingsDrawerTitle,
    showDirectActions,
    showSettingsTrigger,
} = useConversationWorkspaceScene();

const directSourceContext = ref<{
    userId: number;
    groupName: string;
} | null>(null);
const messageContainerRef = ref<HTMLElement | null>(null);
const focusedSequenceTimer = ref<number | null>(null);
const isPositioningMessages = ref(false);
const quotedMessage = ref<ChatMessageItem | null>(null);
const composerResizeState = ref<{
    startY: number;
    composerHeight: number;
} | null>(null);

const {
    groupDrawerOpen,
    groupConfigSaving,
    groupAvatarUploading,
    groupNameEditing,
    groupNicknameEditing,
    directRemarkEditing,
    groupNameInputRef,
    groupNicknameInputRef,
    directRemarkInputRef,
    muteNotifications,
    pinnedConversation,
    groupNicknameInput,
    directRemark,
    avatarCropOpen,
    avatarCropImageUrl,
    groupConfigForm,
    openSettingsDrawer,
    handleGroupAvatarUpload,
    handleAvatarCropCancel,
    handleAvatarCropConfirm,
    handleSaveGroupConfig,
    toggleGroupNameEditing,
    handleGroupNameBlur,
    handleGroupNameEnter,
    handleGroupNameEscape,
    handleGroupMaxMembersBlur,
    handleGroupSwitchChange,
    handlePinChange,
    handleMuteNotificationChange,
    toggleGroupNicknameEditing,
    handleGroupNicknameBlur,
    handleGroupNicknameEnter,
    handleGroupNicknameEscape,
    toggleDirectRemarkEditing,
    handleDirectRemarkBlur,
    handleDirectRemarkEnter,
    handleDirectRemarkEscape,
    handleLeaveConversation,
    handleAddFriend,
    handleDeleteCurrentFriend,
} = useMessageWorkspaceSettingsScene({
    authAccessToken: computed(() => authStore.accessToken || undefined),
    chatConversationState,
    chatGroup,
    chatFriendship,
    chatConversation,
    currentFriendship,
    directTargetUser,
    directConversationTitle,
    canManageGroupPermission,
    canPinConversationPermission,
    canDeleteFriend,
    canAddFriend,
    formatDateTime,
    confirmAction: (options) => confirmAction(options),
    onCloseDrawerAfterLeave: async () => {
        await router.replace({ name: "ChatMessages" });
    },
});

const {
    memberModalOpen,
    inviteModalOpen,
    selectedInviteUserIds,
    memberSearchKeyword,
    inviteSearchKeyword,
    previewMembers,
    filteredGroupMembers,
    filteredAvailableInviteFriends,
    memberRoleLabel,
    memberDisplayName,
    memberRemarkHint,
    isMuteActive,
    showMemberActionMenu,
    openMemberModal,
    openInviteModal,
    toggleInviteUser,
    handleInviteMembers,
    handleMemberActionMenuClick,
    handleMemberDoubleClick,
    handleDisbandConversation,
    handleJoinRequestAction,
    resetMemberManagementState,
} = useMessageWorkspaceMemberScene({
    router,
    currentUserId: computed(() => userStore.user?.id),
    chatConversationState,
    chatGroupState,
    availableInviteFriends,
    canManageMembers,
    canEditRoles,
    canInviteGroupMembers,
    canManageGroupPermission,
    chatFriendship,
    chatGroup,
    chatConversation,
    directSourceContext,
    groupDrawerOpen,
    confirmAction: (options) => confirmAction(options),
});

const COMPOSER_MIN_HEIGHT = 176;
const COMPOSER_MAX_HEIGHT = 320;
const CHAT_MEMBER_MODAL_WIDTH = 540;
const CHAT_MODAL_WIDTH_LG = 720;
const CHAT_DRAWER_WIDTH = 428;

const drawerBodyStyle = {
    padding: "16px",
};

const MESSAGE_MENU_WIDTH = 156;
const MESSAGE_MENU_MIN_HEIGHT = 188;
const MESSAGE_MENU_VIEWPORT_PADDING = 12;

const tallModalBodyStyle = {
    minHeight: "54vh",
    maxHeight: "72vh",
    overflowY: "auto" as const,
};

const groupNicknamePreview = computed(
    () =>
        trimText(groupNicknameInput.value) ||
        userStore.user?.display_name ||
        userStore.user?.username ||
        "未设置",
);
const sendShortcutLabel = computed(() =>
    settingsStore.chatSendHotkey === "enter" ? "Enter" : "Ctrl + Enter",
);
const composerPlaceholder = computed(
    () =>
        composerBlockedReason.value ||
        `输入文本消息，按 ${sendShortcutLabel.value} 发送`,
);
const chatMainStyle = computed(() => ({
    gridTemplateRows: `auto minmax(220px, 1fr) 8px ${settingsStore.chatLayout.composerHeight}px`,
}));
const muteDurationOptions = [
    { minutes: 10, label: "禁言 10 分钟" },
    { minutes: 30, label: "禁言 30 分钟" },
    { minutes: 60, label: "禁言 1 小时" },
    { minutes: 60 * 24, label: "禁言 1 天" },
    { minutes: 60 * 24 * 7, label: "禁言 7 天" },
];

const saveAssetColumns = [
    { title: "目录", dataIndex: "display_name", key: "name" },
];

const getChatRecordPayload = (
    messageItem: ChatMessageItem,
): ChatMessageRecordPayload | null => {
    if (messageItem.message_type !== "chat_record") {
        return null;
    }
    const payload = messageItem.payload as {
        chat_record?: ChatMessageRecordPayload;
    };
    if (!payload?.chat_record || !Array.isArray(payload.chat_record.items)) {
        return null;
    }
    return payload.chat_record;
};

const showGroupSenderLine = (messageItem: ChatMessageItem) =>
    chatConversationState.activeConversation?.type === "group" &&
    !messageItem.is_system;

const directSourceHintText = computed(() => {
    const activeConversation = chatConversationState.activeConversation;
    const sourceContext = directSourceContext.value;
    if (
        !sourceContext ||
        !activeConversation ||
        activeConversation.type !== "direct" ||
        isDirectFriend.value ||
        activeConversation.direct_target?.id !== sourceContext.userId
    ) {
        return "";
    }
    return `对方来自 ${sourceContext.groupName} 群聊`;
});

const confirmAction = (options: {
    title: string;
    content: string;
    okText?: string;
    danger?: boolean;
}) =>
    new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (value: boolean) => {
            if (settled) {
                return;
            }
            settled = true;
            resolve(value);
        };

        Modal.confirm({
            title: options.title,
            content: options.content,
            okText: options.okText || "确认",
            cancelText: "取消",
            okType: options.danger ? "danger" : "primary",
            centered: true,
            onOk: () => {
                finish(true);
            },
            onCancel: () => {
                finish(false);
            },
            afterClose: () => {
                finish(false);
            },
        });
    });

const getSenderLabel = (messageItem: ChatMessageItem) => {
    if (chatConversationState.activeConversation?.type === "group") {
        const member = chatGroupState.activeMembers.find(
            (item) => item.user.id === messageItem.sender?.id,
        );
        if (member?.friend_remark) {
            return member.friend_remark;
        }
        if (member?.group_nickname) {
            return member.group_nickname;
        }
    }
    if (messageItem.sender?.display_name) {
        return messageItem.sender.display_name;
    }
    return messageItem.sender?.username || "未知成员";
};

const getReplyPayload = (messageItem: ChatMessageItem) => {
    const payload = messageItem.payload as {
        reply_to_message?: ChatMessageReplyPayload;
    };
    return payload.reply_to_message || null;
};

const getRevokedPayload = (messageItem: ChatMessageItem) => {
    const payload = messageItem.payload as {
        revoked?: Record<string, unknown>;
    };
    const revoked = payload.revoked;
    if (!revoked || typeof revoked !== "object" || !revoked.revoked_at) {
        return null;
    }
    return revoked as {
        revoked_at: string;
        revoked_by_user_id: number | null;
        can_restore_once?: boolean;
        restore_used?: boolean;
    };
};

const isRevokedMessage = (messageItem: ChatMessageItem) =>
    Boolean(getRevokedPayload(messageItem));

const shouldRenderRevokedPlaceholder = (messageItem: ChatMessageItem) =>
    isRevokedMessage(messageItem) && !isStealthAuditEnabled.value;

const shouldShowRevokedTag = (messageItem: ChatMessageItem) =>
    isRevokedMessage(messageItem) && isStealthAuditEnabled.value;

const canRestoreRevokedMessage = (messageItem: ChatMessageItem) => {
    const revoked = getRevokedPayload(messageItem);
    if (!revoked || !isSelfMessage(messageItem)) {
        return false;
    }
    if (!canRestoreRevokedDraft.value) {
        return false;
    }
    const revokedAt = new Date(revoked.revoked_at).getTime();
    if (!revokedAt || Date.now() - revokedAt > 120000) {
        return false;
    }
    return Boolean(revoked.can_restore_once) && !Boolean(revoked.restore_used);
};

const handleReplyJump = async (replyPayload: ChatMessageReplyPayload) => {
    if (!chatConversationState.activeConversationId) {
        return;
    }
    const located = await scrollToSequence(replyPayload.sequence);
    if (located) {
        return;
    }
    try {
        await chatMessage.loadMessages(
            chatConversationState.activeConversationId,
            { around_sequence: replyPayload.sequence, limit: 30 },
        );
        const loaded = await scrollToSequence(replyPayload.sequence);
        if (!loaded) {
            message.info("未找到引用消息");
        }
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "跳转引用消息失败"));
    }
};

const getForwardedPayload = (messageItem: ChatMessageItem) => {
    const payload = messageItem.payload as {
        forwarded_from_message?: ChatMessageForwardedPayload;
    };
    return payload.forwarded_from_message || null;
};

const getMessageQuotePreview = (messageItem: ChatMessageItem) => {
    if (isChatRecordMessage(messageItem)) {
        return `[聊天记录] ${getChatRecordPayload(messageItem)?.title || "聊天记录"}`;
    }
    if (isAssetMessage(messageItem)) {
        return `[附件] ${getAssetDisplayName(messageItem)}`;
    }
    return trimText(messageItem.content) || "空消息";
};

const {
    forwardModalOpen,
    forwardModeModalOpen,
    forwardSearchKeyword,
    selectedForwardTargetKey,
    forwarding,
    forwardingMessageIds,
    pendingForwardTarget,
    recentForwardTargets,
    filteredForwardTargets,
    buildForwardMessageSummary,
    beginForwardSelection,
    handleSelectForwardTarget,
    handleConfirmForwardMode,
    resetForwardingState,
} = useChatWorkspaceForwarding({
    chatStore,
    getMessageQuotePreview,
    resolveMenuMessage: () => messageMenuMessage.value,
    clearMessageSelection: () => clearMessageSelectionState(),
    closeMessageMenu: () => closeMessageMenuState(),
});

const {
    chatRecordViewerStack,
    buildChatRecordPlainText,
    openChatRecordViewer,
    openChatRecordViewerFromMessage,
    closeChatRecordViewer,
    removeChatRecordViewer,
    handleCopyChatRecordEntry,
    handleForwardChatRecordEntry,
    clearChatRecordViewers,
} = useChatWorkspaceRecords({
    getChatRecordPayload,
    beginForwardSelection,
});

const {
    assetPickerOpen,
    composerRef,
    attachmentInputRef,
    attachmentUploading,
    handleComposerPasteFiles,
    handleSendMessage,
    handleAssetPickerSelect,
    handleComposerMenuClick,
    handleAttachmentSelection,
    handleComposerTypingChange,
    disposeComposerScene,
} = useMessageWorkspaceComposerScene({
    authAccessToken: computed(() => authStore.accessToken || undefined),
    chatConversationState,
    chatMessage,
    composerBlockedReason,
    composerDisabled,
    canSendAttachment,
    isDirectFriend,
    quotedMessage,
});

const {
    assetPreviewOpen,
    previewingAssetMessage,
    groupInvitationModalOpen,
    groupInvitationApplying,
    saveAssetDialogOpen,
    saveAssetLoading,
    saveAssetSaving,
    saveAssetCreateFolderOpen,
    saveAssetFolderName,
    saveAssetFolderEntries,
    saveAssetBreadcrumbs,
    assetPreviewTitle,
    activeGroupInvitation,
    getAssetMessagePayload,
    getAssetDisplayName,
    isAssetMessage,
    canPreviewImage,
    canPreviewVideo,
    getVideoPosterUrl,
    getAssetPreviewBoxStyle,
    getAssetPreviewImageUrl,
    getAssetUploadProgress,
    isAssetUploading,
    showVideoPlayOverlay,
    formatAssetFileSize,
    getGroupInvitationPayload,
    isChatRecordMessage,
    hasMessageBubbleAction,
    openAssetMessage,
    openGroupInvitationModal,
    handleMessageBubbleClick,
    triggerAssetDownload,
    toggleSaveAssetFolderInline,
    openSaveAssetBreadcrumb,
    enterSaveAssetFolder,
    handleCreateSaveAssetFolder,
    openSaveAssetDialog,
    confirmSaveAssetToResource,
    handleApplyGroupInvitation,
} = useMessageWorkspaceAssetScene({
    canCreateFolderInResource,
    canSaveChatAttachmentToResource,
    chatConversation,
    getChatRecordPayload,
    openChatRecordViewerFromMessage,
});

const {
    messageMenuOpen,
    messageMenuMessage,
    messageSelectionMode,
    selectedMessageIds,
    messageMenuStyle,
    canRevokeMessage,
    canDeleteMessage,
    isMessageSelected,
    handleMessageRowClick,
    clearMessageSelection: clearMessageSelectionState,
    closeMessageMenu: closeMessageMenuState,
    openMessageMenu,
    handleDocumentClick,
    handleRetryMessage,
    handleCopyMessage,
    handleForwardMessage,
    handleForwardSelection,
    handleQuoteMessage,
    enableMessageSelection,
    handleMenuDownloadAssetMessage,
    handleMenuSaveAssetToResource,
    handleRevokeMessage,
    handleDeleteMessage,
    handleRestoreRevokedMessage,
} = useMessageWorkspaceMessageMenuScene({
    chatConversationState,
    chatMessage,
    composerRef,
    quotedMessage,
    canDeleteAnyMessage,
    canForwardMessage,
    canRevokeAnyMessage,
    canRestoreRevokedDraft,
    isSelfMessage,
    buildChatRecordPlainText,
    beginForwardSelection,
    getAssetDisplayName,
    getAssetMessagePayload,
    getChatRecordPayload,
    isAssetMessage,
    isChatRecordMessage,
    isRevokedMessage,
    openSaveAssetDialog,
    triggerAssetDownload,
});

const clearMessageSelection = () => {
    clearMessageSelectionState();
};

const closeMessageMenu = () => {
    closeMessageMenuState();
};

const scrollToBottom = async () => {
    await nextTick();
    const element = messageContainerRef.value;
    if (!element) {
        return;
    }
    element.scrollTop = element.scrollHeight;
};

const clearFocusedMessageHighlight = () => {
    if (focusedSequenceTimer.value) {
        window.clearTimeout(focusedSequenceTimer.value);
        focusedSequenceTimer.value = null;
    }
    const element = messageContainerRef.value;
    if (!element) {
        return;
    }
    element
        .querySelectorAll(".message-row--focused")
        .forEach((node) => node.classList.remove("message-row--focused"));
};

const scrollToSequence = async (sequence: number) => {
    await nextTick();
    const container = messageContainerRef.value;
    if (!container) {
        return false;
    }
    const target = container.querySelector<HTMLElement>(
        `.message-row[data-sequence="${sequence}"]`,
    );
    if (!target) {
        return false;
    }
    clearFocusedMessageHighlight();
    target.classList.add("message-row--focused");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    focusedSequenceTimer.value = window.setTimeout(() => {
        target.classList.remove("message-row--focused");
        focusedSequenceTimer.value = null;
    }, 2200);
    return true;
};

const syncActiveConversation = async () => {
    const conversationId = chatConversationState.activeConversationId;
    if (!conversationId) {
        isPositioningMessages.value = false;
        return;
    }
    try {
        if (
            chatConversationState.activeConversation?.type === "group" &&
            chatConversationState.activeConversation.access_mode === "member"
        ) {
            await chatGroup.loadMembers(conversationId);
        }
        if (!chatMessageState.activeMessages.length) {
            await chatMessage.loadMessages(conversationId);
        }
        const lastSequence =
            chatMessageState.activeMessages.at(-1)?.sequence || 0;
        if (
            route.name === "ChatMessages" &&
            chatConversationState.activeConversation?.access_mode ===
                "member" &&
            chatConversationState.activeConversation?.unread_count &&
            lastSequence > 0
        ) {
            await chatMessage.markConversationRead(
                conversationId,
                lastSequence,
            );
        }
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "加载会话失败"));
    }
};

const syncMessageRouteConversation = async () => {
    if (route.name !== "ChatMessages") {
        return;
    }

    const targetConversationId =
        chatConversationState.activeConversationId ||
        chatConversationState.conversations[0]?.id ||
        null;

    if (!targetConversationId) {
        isPositioningMessages.value = false;
        return;
    }

    try {
        if (
            chatConversationState.activeConversationId !==
                targetConversationId ||
            !chatConversationState.activeConversation
        ) {
            await chatConversation.selectConversation(targetConversationId);
            return;
        }
        await syncActiveConversation();
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "加载会话失败"));
    }
};

const handleLoadOlderMessages = async () => {
    if (!chatConversationState.activeConversationId) {
        return;
    }
    const container = messageContainerRef.value;
    const previousHeight = container?.scrollHeight || 0;
    const previousTop = container?.scrollTop || 0;
    try {
        await chatMessage.loadOlderMessages(
            chatConversationState.activeConversationId,
        );
        await nextTick();
        if (container) {
            container.scrollTop =
                container.scrollHeight - previousHeight + previousTop;
        }
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "加载历史消息失败"));
    }
};

const updateComposerHeight = (nextHeight: number) => {
    settingsStore.save({
        chatLayout: {
            ...settingsStore.chatLayout,
            composerHeight: Math.min(
                COMPOSER_MAX_HEIGHT,
                Math.max(COMPOSER_MIN_HEIGHT, Math.round(nextHeight)),
            ),
        },
    });
};

const handleComposerResize = (event: MouseEvent) => {
    if (!composerResizeState.value) {
        return;
    }
    updateComposerHeight(
        composerResizeState.value.composerHeight -
            (event.clientY - composerResizeState.value.startY),
    );
};

const stopComposerResize = () => {
    if (!composerResizeState.value) {
        return;
    }
    composerResizeState.value = null;
    window.removeEventListener("mousemove", handleComposerResize);
    window.removeEventListener("mouseup", stopComposerResize);
    void settingsStore.saveChatPreferences({
        chatLayout: settingsStore.chatLayout,
    });
};

const startComposerResize = (event: MouseEvent) => {
    event.preventDefault();
    composerResizeState.value = {
        startY: event.clientY,
        composerHeight: settingsStore.chatLayout.composerHeight,
    };
    window.addEventListener("mousemove", handleComposerResize);
    window.addEventListener("mouseup", stopComposerResize);
};

watch(
    () => chatConversationState.activeConversationId,
    () => {
        isPositioningMessages.value = Boolean(
            chatConversationState.activeConversationId,
        );
        clearMessageSelection();
        quotedMessage.value = null;
        resetForwardingState();
        clearChatRecordViewers();
        resetMemberManagementState();
        groupInvitationModalOpen.value = false;
        void syncActiveConversation();
    },
    { immediate: true },
);

watch(
    () => [route.name, chatConversationState.conversations.length],
    () => {
        void syncMessageRouteConversation();
    },
    { immediate: true },
);

watch(
    () => [
        chatConversationState.activeConversationId,
        chatMessageState.activeMessages.length,
    ],
    async () => {
        const activeId = chatConversationState.activeConversationId;
        if (!activeId) {
            isPositioningMessages.value = false;
            return;
        }
        const focusSequence = activeId
            ? chatConversationState.focusedSequenceMap[activeId]
            : null;
        if (focusSequence) {
            const located = await scrollToSequence(focusSequence);
            if (located) {
                chatConversation.clearFocusedSequence(activeId);
                isPositioningMessages.value = false;
                return;
            }
        }
        await scrollToBottom();
        isPositioningMessages.value = false;
    },
    { immediate: true },
);

watch(
    () =>
        chatMessageState.activeMessages
            .map((item) => `${item.id}:${isRevokedMessage(item) ? 1 : 0}`)
            .join("|"),
    () => {
        if (quotedMessage.value) {
            const latestQuoted = chatMessageState.activeMessages.find(
                (item) => item.id === quotedMessage.value?.id,
            );
            if (!latestQuoted || isRevokedMessage(latestQuoted)) {
                quotedMessage.value = null;
            } else {
                quotedMessage.value = latestQuoted;
            }
        }
        if (selectedMessageIds.value.length) {
            const activeMessageIds = new Set(
                chatMessageState.activeMessages
                    .filter((item) => !isRevokedMessage(item))
                    .map((item) => item.id),
            );
            selectedMessageIds.value = selectedMessageIds.value.filter((item) =>
                activeMessageIds.has(item),
            );
            if (!selectedMessageIds.value.length) {
                messageSelectionMode.value = false;
            }
        }
    },
);

watch(
    () => [
        chatConversationState.activeConversation?.id,
        chatConversationState.activeConversation?.type,
        chatConversationState.activeConversation?.direct_target?.id,
        isDirectFriend.value,
    ],
    () => {
        const activeConversation = chatConversationState.activeConversation;
        if (
            !directSourceContext.value ||
            !activeConversation ||
            activeConversation.type !== "direct" ||
            isDirectFriend.value ||
            activeConversation.direct_target?.id !==
                directSourceContext.value.userId
        ) {
            directSourceContext.value = null;
        }
    },
    { immediate: true },
);

onMounted(() => {
    document.addEventListener("click", handleDocumentClick);
});

onBeforeUnmount(() => {
    document.removeEventListener("click", handleDocumentClick);
    if (focusedSequenceTimer.value) {
        window.clearTimeout(focusedSequenceTimer.value);
    }
    disposeComposerScene();
    stopComposerResize();
});
</script>

<style scoped>
.chat-main {
    display: grid;
    min-width: 0;
    height: 100%;
    background: var(--chat-panel-bg);
    border: 1px solid var(--chat-panel-border);
    border-radius: 0 14px 14px 0;
    overflow: hidden;
    box-shadow: var(--chat-panel-shadow);
}

.chat-main__header,
.chat-main__composer {
    padding: 12px 16px;
}

.chat-main__header,
.chat-main__header-main,
.chat-main__title-row,
.chat-main__composer-actions,
.drawer-toolbar,
.drawer-list-item,
.chat-main__meta,
.group-settings-card__header,
.direct-profile-card__main,
.nickname-editor,
.member-item__main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.chat-main__header {
    border-bottom: 1px solid var(--chat-panel-border);
}

.chat-main__title {
    min-width: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--chat-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.chat-main__header-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.chat-main__title-row {
    justify-content: flex-start;
    min-width: 0;
}

.chat-main__meta-tag {
    flex: 0 0 auto;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--chat-accent-soft);
    color: var(--chat-accent);
    font-size: 12px;
    font-weight: 600;
}

.chat-main__meta,
.message-bubble__meta,
.system-bubble,
.drawer-list-desc {
    color: var(--chat-text-secondary);
}

.chat-main__meta {
    font-size: 12px;
    justify-content: flex-start;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.chat-main__source-hint {
    align-self: flex-start;
    padding: 4px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--chat-accent-soft) 84%, white 16%);
    color: var(--chat-accent);
    font-size: 12px;
    font-weight: 600;
}

.chat-menu-trigger {
    width: 34px;
    height: 34px;
    padding: 0;
    border-radius: 14px;
}

.chat-main__messages,
.drawer-list {
    overflow: auto;
}

.chat-main__attachment-input {
    display: none;
}

.chat-main__messages {
    position: relative;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--chat-subtle-bg) 90%, transparent),
        var(--chat-panel-bg-strong)
    );
}

.chat-main__load-more {
    align-self: flex-start;
}

.chat-main__messages--positioning {
    visibility: hidden;
}

.message-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 14px;
    transition:
        transform 0.2s ease,
        filter 0.2s ease,
        background-color 0.2s ease,
        box-shadow 0.2s ease;
}

.message-row.self {
    justify-content: center;
}

.message-row.system {
    justify-content: center;
}

.message-row--revoked {
    justify-content: center;
}

.message-row__content {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    max-width: 100%;
    min-width: 0;
    flex: 1 1 auto;
    order: 1;
}

.message-row__content.self {
    justify-content: flex-end;
}

.message-row__avatar {
    flex: 0 0 auto;
    margin-top: 2px;
}

.message-row--selection-mode {
    cursor: pointer;
}

.message-row__select {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: center;
    order: 2;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    background: transparent;
    pointer-events: none;
    flex: 0 0 24px;
}

.message-row.self .message-row__select {
    order: 0;
}

.message-row__select-indicator {
    position: relative;
    width: 18px;
    height: 18px;
    border: 1.5px solid
        color-mix(in srgb, var(--chat-accent) 54%, var(--chat-panel-border));
    border-radius: 999px;
    background: var(--chat-panel-bg-strong);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
}

.message-row__select.is-checked .message-row__select-indicator {
    border-color: var(--chat-accent);
    background: var(--chat-accent);
}

.message-row__select.is-checked .message-row__select-indicator::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 5px;
    height: 9px;
    border-right: 2px solid #fff;
    border-bottom: 2px solid #fff;
    transform: translate(-50%, -58%) rotate(45deg);
}

.message-bubble-wrap {
    display: flex;
    flex-direction: column;
    flex: 0 1 auto;
    width: auto;
    min-width: 0;
    max-width: 80%;
}

.message-bubble-wrap.self {
    align-items: flex-end;
}

.message-bubble__sender-line {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.message-bubble__sender-line.self {
    justify-content: flex-end;
}

.message-bubble-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    max-width: 100%;
    min-width: 0;
}

.message-bubble-row.self {
    justify-content: flex-end;
}

.message-revoked-row {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-width: min(100%, 320px);
    max-width: 100%;
    padding: 9px 14px;
    border-radius: 999px;
    background: color-mix(
        in srgb,
        var(--chat-subtle-bg) 88%,
        var(--chat-panel-bg-strong)
    );
    color: var(--chat-text-secondary);
    font-size: 12px;
}

.message-revoked-row__restore {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--chat-accent);
    cursor: pointer;
    font-weight: 600;
}

.message-bubble__revoked-tag {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    margin-bottom: 6px;
    padding: 2px 8px;
    border-radius: 999px;
    color: #92400e;
    background: rgba(251, 191, 36, 0.22);
    font-size: 12px;
    line-height: 1.4;
}

.message-row--focused {
    background: color-mix(
        in srgb,
        var(--chat-accent-soft) 82%,
        var(--chat-panel-bg)
    );
    box-shadow:
        inset 0 0 0 1px color-mix(in srgb, var(--chat-accent) 22%, transparent),
        0 10px 24px color-mix(in srgb, var(--chat-accent) 10%, transparent);
}

.message-bubble {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: auto;
    min-width: 0;
    max-width: min(100%, 560px);
    padding: 12px 14px;
    border-radius: 18px 18px 18px 6px;
    background: var(--chat-message-bg);
    color: var(--chat-text-primary);
    writing-mode: horizontal-tb;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.1);
    transition:
        transform 0.18s ease,
        box-shadow 0.18s ease,
        filter 0.18s ease,
        background-color 0.18s ease;
}

.message-bubble--asset {
    padding: 10px;
    overflow: hidden;
}

.message-bubble__text {
    min-width: 0;
    writing-mode: horizontal-tb;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    line-height: 1.6;
}

.message-bubble__sender {
    padding: 0 2px;
    padding-top: 2px;
    font-size: 12px;
    color: var(--chat-text-secondary);
    line-height: 1.2;
}

.message-bubble--interactive {
    cursor: pointer;
}

.message-bubble:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 30px rgba(15, 23, 42, 0.14);
}

.message-bubble.self:hover {
    filter: brightness(1.03);
}

.message-bubble__time {
    flex: 0 0 auto;
    min-width: 44px;
    font-size: 12px;
    color: var(--chat-text-secondary);
    opacity: 0;
    transform: translateX(6px);
    transition:
        opacity 0.2s ease 0.5s,
        transform 0.2s ease 0.5s;
}

.message-bubble__time.self {
    transform: translateX(-6px);
}

.message-row:hover .message-bubble__time {
    opacity: 1;
    transform: translateX(0);
}

.attachment-bubble {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(360px, 100%);
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
}

.attachment-bubble--media {
    gap: 0;
}

.attachment-bubble__media-shell {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 140px;
    min-height: 96px;
    max-width: min(var(--attachment-preview-width, 320px), 80vw);
    max-height: var(--attachment-preview-height, 220px);
    margin: 0 auto;
    background: #f3f4f6;
    overflow: hidden;
    border-radius: 14px;
}

.attachment-bubble__preview {
    display: block;
    width: auto;
    height: auto;
    max-width: min(var(--attachment-preview-width, 320px), 80vw);
    max-height: var(--attachment-preview-height, 220px);
    object-fit: contain;
    border-radius: 14px;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
    background: #f3f4f6;
}

.attachment-bubble__preview--video {
    background: #111827;
}

.attachment-bubble__overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.28);
}

.attachment-bubble__progress-ring,
.attachment-bubble__play-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 50px;
    height: 50px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.92);
    color: #111827;
    font-size: 18px;
    font-weight: 700;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.2);
}

.attachment-bubble__play-button {
    border: 0;
    cursor: pointer;
}

.attachment-bubble__play-button :deep(svg) {
    font-size: 28px;
    transform: translateX(2px);
}

.attachment-bubble__body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    padding: 12px 14px;
    border-radius: 14px;
    background: #eef1f4;
    color: #2f3945;
    box-shadow: inset 0 0 0 1px rgba(47, 57, 69, 0.08);
    box-sizing: border-box;
}

.attachment-bubble__name {
    font-weight: 600;
    line-height: 1.5;
    word-break: break-word;
}

.attachment-bubble__size {
    font-size: 12px;
    color: rgba(47, 57, 69, 0.62);
}

.attachment-file-card {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-width: 0;
    padding: 12px 14px;
    border-radius: 14px;
    background: #eef1f4;
    color: #2f3945;
    box-shadow: inset 0 0 0 1px rgba(47, 57, 69, 0.08);
    box-sizing: border-box;
}

.attachment-file-card__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: rgba(47, 57, 69, 0.1);
    font-size: 20px;
}

.attachment-file-card__body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
}

.attachment-file-card__name {
    font-weight: 600;
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.attachment-file-card__size {
    font-size: 12px;
    color: rgba(47, 57, 69, 0.62);
}

.attachment-bubble__link {
    width: fit-content;
    font-size: 12px;
    color: inherit;
    opacity: 0.82;
    text-decoration: underline;
}

.attachment-bubble__link:hover {
    opacity: 1;
}

.message-bubble.self {
    border-radius: 18px 18px 6px 18px;
    background: var(--chat-message-self-bg);
    color: var(--chat-message-self-text);
}

.message-status {
    display: flex;
    justify-content: flex-start;
}

.message-status--inline {
    align-self: flex-end;
    margin-bottom: 4px;
}

.message-status__spinner {
    width: 14px;
    height: 14px;
    border: 2px solid color-mix(in srgb, var(--chat-accent) 24%, transparent);
    border-top-color: var(--chat-accent);
    border-radius: 999px;
    animation: chat-spin 0.8s linear infinite;
}

.message-status__failed {
    width: 18px;
    height: 18px;
    border: 0;
    border-radius: 999px;
    background: #ef4444;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
    cursor: pointer;
}

.message-failure-hint {
    margin-top: 6px;
    padding-right: 24px;
    font-size: 12px;
    line-height: 1.4;
    color: #dc2626;
    text-align: right;
}

.system-bubble {
    padding: 8px 12px;
    border-radius: 999px;
    background: var(--chat-system-bg);
    font-size: 12px;
}

.chat-main__composer {
    border-top: 1px solid var(--chat-panel-border);
    background: color-mix(
        in srgb,
        var(--chat-panel-bg-strong) 76%,
        transparent
    );
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
}

.chat-main__composer--disabled {
    user-select: none;
}

.chat-main__composer--disabled .chat-main__composer-input {
    pointer-events: none;
    user-select: none;
}

.chat-main__composer-actions {
    justify-content: flex-end;
}

.chat-main__composer-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-start;
}

.chat-main__composer-trigger {
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: 12px;
}

.chat-main__composer-input {
    flex: 1 1 auto;
    min-height: 0;
}

.chat-main__composer-input :deep(textarea) {
    min-height: 96px !important;
    height: 100% !important;
    resize: none !important;
}

.chat-main__composer-input :deep(.ant-input) {
    resize: none !important;
}

.chat-main__composer-input :deep(textarea::-webkit-resizer) {
    display: none;
}

.chat-main__composer-resizer {
    position: relative;
    height: 2px;
    margin-top: 8px;
    background: color-mix(in srgb, var(--chat-panel-border) 88%, transparent);
    cursor: row-resize;
    z-index: 2;
}

.chat-main__composer-resizer::before {
    content: none;
}

.chat-main__composer-resizer:hover {
    background: color-mix(
        in srgb,
        var(--chat-accent) 72%,
        var(--chat-panel-border)
    );
}

.chat-main__selection-bar {
    position: sticky;
    top: 0;
    z-index: 4;
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: color-mix(
        in srgb,
        var(--chat-accent-soft) 76%,
        var(--chat-panel-bg-strong)
    );
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(8px);
    color: var(--chat-text-primary);
}

.chat-main__quote-bar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 12px;
    background: color-mix(
        in srgb,
        var(--chat-accent-soft) 72%,
        var(--chat-panel-bg-strong)
    );
}

.chat-main__quote-title {
    font-size: 12px;
    color: var(--chat-text-secondary);
}

.chat-main__quote-content {
    margin-top: 4px;
    color: var(--chat-text-primary);
    word-break: break-word;
}

.chat-main__quote-close {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--chat-accent);
    cursor: pointer;
}

.message-bubble__reply {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    margin-bottom: 10px;
    padding: 10px 12px;
    border: 0;
    border-radius: 12px;
    background: color-mix(
        in srgb,
        var(--chat-subtle-bg) 86%,
        var(--chat-panel-bg-strong)
    );
    box-shadow: inset 0 0 0 1px
        color-mix(in srgb, var(--chat-panel-border) 82%, transparent);
    text-align: left;
    cursor: pointer;
}

.message-bubble__reply:hover {
    background: color-mix(
        in srgb,
        var(--chat-accent-soft) 52%,
        var(--chat-panel-bg-strong)
    );
}

.message-bubble__reply:disabled {
    cursor: default;
    opacity: 0.78;
}

.message-bubble__reply:disabled:hover {
    background: color-mix(
        in srgb,
        var(--chat-subtle-bg) 86%,
        var(--chat-panel-bg-strong)
    );
}

.message-bubble.self .message-bubble__reply {
    background: rgba(255, 255, 255, 0.24);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
}

.message-bubble.self .message-bubble__reply:hover {
    background: rgba(255, 255, 255, 0.3);
}

.message-bubble__reply-arrow {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    color: var(--chat-accent);
}

.message-bubble.self .message-bubble__reply-arrow {
    color: rgba(255, 255, 255, 0.92);
}

.message-bubble__reply-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.message-bubble__reply-sender {
    font-size: 12px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.message-bubble__reply-content {
    color: var(--chat-text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
}

.message-bubble.self .message-bubble__reply-sender,
.message-bubble.self .message-bubble__reply-content,
.message-bubble.self .group-invitation-card__meta,
.message-bubble.self .group-invitation-card__desc,
.message-bubble.self .group-invitation-card__footer {
    color: rgba(255, 255, 255, 0.9);
}

.group-invitation-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: min(300px, 100%);
    max-width: 100%;
    padding: 12px 14px;
    border: 0;
    border-radius: 14px;
    background: #eef1f4;
    color: #2f3945;
    box-shadow: inset 0 0 0 1px rgba(47, 57, 69, 0.08);
    text-align: left;
    cursor: pointer;
}

.group-invitation-card.self {
    background: rgba(255, 255, 255, 0.18);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
    color: #fff;
}

.group-invitation-card__header {
    font-size: 12px;
    font-weight: 700;
}

.group-invitation-card__main,
.group-invitation-modal__summary,
.group-invitation-modal__actions {
    display: flex;
    align-items: center;
    gap: 12px;
}

.group-invitation-card__body,
.group-invitation-modal__body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.group-invitation-card__name,
.group-invitation-modal__name {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.3;
}

.group-invitation-card__meta,
.group-invitation-modal__meta,
.group-invitation-modal__desc,
.group-invitation-card__desc,
.group-invitation-card__footer {
    font-size: 12px;
    color: rgba(47, 57, 69, 0.72);
}

.group-invitation-card__meta {
    display: flex;
    align-items: center;
    gap: 6px;
}

.group-invitation-card__footer,
.group-invitation-modal__actions {
    justify-content: space-between;
}

.group-invitation-modal {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.asset-preview-modal {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 320px;
    border-radius: 14px;
    overflow: hidden;
}

.asset-preview-modal__image,
.asset-preview-modal__video {
    display: block;
    max-width: 100%;
    max-height: min(72vh, 720px);
    border-radius: 14px;
    background: #0f172a;
}

.target-modal-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}

.target-modal-toolbar__breadcrumb {
    min-width: 0;
    overflow: hidden;
}

.target-modal-toolbar__inline {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}

.save-asset-folder-button {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--chat-accent);
    cursor: pointer;
}

.group-invitation-modal__summary {
    align-items: flex-start;
}

.settings-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 12px;
    padding: 12px 14px;
    border: 1px solid
        color-mix(in srgb, var(--chat-panel-border) 84%, rgba(15, 23, 42, 0.14));
    border-radius: 18px;
    background: transparent;
    box-shadow: inset 0 0 0 1px
        color-mix(in srgb, var(--chat-panel-border) 72%, transparent);
}

.settings-section--danger {
    margin-bottom: 0;
}

.drawer-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.settings-section__title {
    font-size: 16px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.settings-section__desc,
.settings-section__link,
.member-preview__meta {
    color: var(--chat-text-secondary);
    font-size: 12px;
}

.settings-section__header-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0;
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
}

.settings-section__link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.settings-section__header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.settings-section__link-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--chat-text-secondary);
    cursor: pointer;
}

.group-basic-panel {
    display: flex;
    gap: 18px;
}

.group-basic-panel__fields {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.group-summary-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 14px;
    background: var(--chat-panel-bg-strong);
}

.group-summary-card__avatar {
    padding: 0;
    border: 0;
    background: transparent;
    cursor: default;
}

.group-summary-card__avatar--editable {
    cursor: pointer;
}

.group-summary-card__body {
    flex: 1;
    min-width: 0;
}

.group-summary-card__top {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.group-summary-card__name {
    min-width: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--chat-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.group-summary-card__meta {
    margin-top: 4px;
    font-size: 12px;
    color: var(--chat-text-secondary);
}

.group-summary-card__edit {
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 8px;
    background: var(--chat-accent-soft);
    color: var(--chat-accent);
    cursor: pointer;
}

.group-summary-card__input {
    max-width: 240px;
}

.group-summary-card__input--editing,
.friend-remark-editor__input {
    animation: chat-field-focus-in 0.18s ease;
}

.group-switch-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.group-config-field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: var(--chat-text-secondary);
}

.group-config-field--inline {
    align-items: center;
}

.drawer-list-item {
    padding: 12px 14px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: var(--chat-panel-bg-strong);
}

.drawer-list-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.request-item,
.member-item {
    align-items: center;
}

.member-item__main {
    justify-content: flex-start;
    min-width: 0;
    flex: 1 1 0;
}

.member-item__avatar {
    flex: 0 0 40px;
    min-width: 40px;
    width: 40px;
    height: 40px;
}

.member-item__body {
    min-width: 0;
    flex: 1 1 auto;
}

.member-item__alias {
    color: var(--chat-text-secondary);
    font-size: 12px;
    font-weight: 500;
}

.member-item__main :deep(.ant-avatar) {
    flex: 0 0 40px;
}

.member-item__mute {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    min-width: 0;
    flex: 0 1 220px;
    font-size: 12px;
    color: var(--chat-text-secondary);
    white-space: nowrap;
}

.member-item__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex: 0 0 auto;
    align-self: center;
}

.member-item__menu-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 22px;
    padding: 0;
}

.member-item__menu-trigger :deep(.anticon) {
    font-size: 18px;
    line-height: 1;
}

.entity-modal {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.entity-modal__search {
    display: flex;
    align-items: center;
    gap: 10px;
}

.entity-modal__list {
    min-height: 380px;
    margin-top: 10px;
}

.entity-modal__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 4px;
}

.entity-modal__selection {
    font-size: 12px;
    color: var(--chat-text-secondary);
}

.invite-item {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
}

.invite-item__check {
    display: inline-flex;
    align-items: center;
    align-self: stretch;
}

.invite-item__main {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
}

.invite-item__check :deep(.ant-checkbox-inner) {
    width: 18px;
    height: 18px;
    border-radius: 999px;
}

.invite-item__check :deep(.ant-checkbox-checked .ant-checkbox-inner::after) {
    inset-inline-start: 24%;
}

.member-preview-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;
}

.member-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 40px;
    padding: 0;
    border: 0;
    background: transparent;
}

.member-preview--add {
    width: 40px;
    height: 40px;
    border: 2px dashed color-mix(in srgb, var(--chat-accent) 34%, transparent);
    border-radius: 50%;
    cursor: pointer;
}

.member-preview__plus {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: transparent;
    color: var(--chat-accent);
}

.setting-switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: var(--chat-text-primary);
}

.nickname-editor {
    justify-content: flex-start;
    gap: 10px;
    flex-wrap: wrap;
}

.nickname-editor--card {
    display: block;
}

.nickname-editor--card .group-summary-card__top {
    width: 100%;
}

.nickname-editor :deep(.ant-input) {
    flex: 1;
    min-width: 180px;
}

.nickname-editor__label,
.nickname-editor__preview {
    font-size: 12px;
    color: var(--chat-text-secondary);
}

.friend-remark-editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.friend-remark-editor__top {
    display: flex;
    align-items: center;
    gap: 8px;
}

.friend-remark-editor__top :deep(.ant-input) {
    flex: 1;
}

.friend-remark-editor__value {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--chat-text-primary);
}

@keyframes chat-field-focus-in {
    from {
        opacity: 0;
        transform: translateY(2px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.direct-profile-card {
    gap: 18px;
}

.group-leave-btn {
    margin-top: 0;
}

.failed-menu {
    position: fixed;
    z-index: 40;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 120px;
    padding: 6px;
    background: var(--chat-panel-bg-strong);
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    box-shadow: var(--chat-panel-shadow);
}

.failed-menu__hint {
    padding: 10px 12px 8px;
    border-bottom: 1px solid color-mix(in srgb, #ef4444 16%, transparent);
    color: #b91c1c;
    background: color-mix(in srgb, #ef4444 10%, var(--chat-panel-bg-strong));
    font-size: 12px;
    line-height: 1.4;
}

.failed-menu__hint-title {
    font-weight: 600;
}

.failed-menu__hint-detail {
    margin-top: 4px;
    color: color-mix(in srgb, #7f1d1d 82%, var(--chat-text-secondary));
    word-break: break-word;
}

.failed-menu__item {
    width: 100%;
    padding: 8px 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--chat-text-primary);
    text-align: left;
    cursor: pointer;
}

.failed-menu__item:hover {
    background: var(--chat-accent-soft);
}

.message-menu-fade-enter-active,
.message-menu-fade-leave-active {
    transition:
        opacity 0.18s ease,
        transform 0.18s ease;
}

.message-menu-fade-enter-from,
.message-menu-fade-leave-to {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
}

@keyframes chat-spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

@media (max-width: 960px) {
    .chat-main {
        min-height: 70vh;
    }

    .message-bubble-wrap {
        max-width: 88%;
    }

    .attachment-bubble,
    .group-invitation-card {
        min-width: 100%;
    }

    .group-basic-panel {
        flex-direction: column;
    }

    .member-preview-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
    }
}

:deep(.ant-modal-body) {
    border-radius: 14px;
    overflow: hidden;
}
</style>
