import { Modal, message } from "ant-design-vue";
import { computed, ref, type ComputedRef, type Ref } from "vue";
import { getMessageFailureToast } from "@/stores/chat/messageFailure";
import type {
    ChatMessageAssetPayload,
    ChatMessageItem,
    ChatMessageRecordPayload,
} from "@/types/chat";
import { getErrorMessage } from "@/utils/error";
import { formatFileSize } from "@/utils/fileFormatter";
import { buildComposerAttachmentToken } from "@/modules/chat-center/composables/useMessageWorkspaceComposerScene";
import type { RichMessageComposerExpose } from "@/views/Chat/components/RichMessageComposer.vue";

const MESSAGE_MENU_WIDTH = 156;
const MESSAGE_MENU_MIN_HEIGHT = 188;
const MESSAGE_MENU_VIEWPORT_PADDING = 12;

type UseMessageWorkspaceMessageMenuSceneOptions = {
    chatConversationState: {
        activeConversation: {
            access_mode?: string;
        } | null;
    };
    chatMessage: {
        retryMessage: (...args: any[]) => Promise<unknown>;
        revokeMessage: (...args: any[]) => Promise<unknown>;
        deleteMessage: (...args: any[]) => Promise<{ detail?: string }>;
        restoreRevokedDraft: (...args: any[]) => Promise<{ draft: any; detail?: string }>;
    };
    composerRef: Ref<RichMessageComposerExpose | null>;
    quotedMessage: Ref<ChatMessageItem | null>;
    canDeleteAnyMessage: ComputedRef<boolean>;
    canForwardMessage: ComputedRef<boolean>;
    canRevokeAnyMessage: ComputedRef<boolean>;
    canRestoreRevokedDraft: ComputedRef<boolean>;
    isSelfMessage: (messageItem: ChatMessageItem) => boolean;
    buildChatRecordPlainText: (
        payload: ChatMessageRecordPayload | null,
    ) => string;
    beginForwardSelection: (messageIds: number[]) => void;
    getAssetDisplayName: (messageItem: ChatMessageItem) => string;
    getAssetMessagePayload: (
        messageItem: ChatMessageItem,
    ) => ChatMessageAssetPayload | null;
    getChatRecordPayload: (
        messageItem: ChatMessageItem,
    ) => ChatMessageRecordPayload | null;
    isAssetMessage: (messageItem: ChatMessageItem) => boolean;
    isChatRecordMessage: (messageItem: ChatMessageItem) => boolean;
    isRevokedMessage: (messageItem: ChatMessageItem) => boolean;
    openSaveAssetDialog: (messageItem: ChatMessageItem) => Promise<boolean>;
    triggerAssetDownload: (messageItem: ChatMessageItem) => void;
};

export function useMessageWorkspaceMessageMenuScene(
    options: UseMessageWorkspaceMessageMenuSceneOptions,
) {
    const messageMenuOpen = ref(false);
    const messageMenuMessage = ref<ChatMessageItem | null>(null);
    const messageMenuPosition = ref({ x: 0, y: 0 });
    const messageSelectionMode = ref(false);
    const selectedMessageIds = ref<number[]>([]);

    const messageMenuStyle = computed(() => ({
        left: `${messageMenuPosition.value.x}px`,
        top: `${messageMenuPosition.value.y}px`,
    }));

    const canRevokeMessage = (messageItem: ChatMessageItem | null) => {
        if (
            !messageItem
            || messageItem.is_system
            || !options.isSelfMessage(messageItem)
            || messageItem.local_status === "failed"
            || options.isRevokedMessage(messageItem)
        ) {
            return false;
        }
        if (!options.canRevokeAnyMessage.value) {
            return false;
        }
        const createdAt = new Date(messageItem.created_at).getTime();
        if (!createdAt) {
            return false;
        }
        return Date.now() - createdAt <= 120000;
    };

    const canDeleteMessage = (messageItem: ChatMessageItem | null) => {
        if (
            !messageItem
            || messageItem.is_system
            || messageItem.local_status === "failed"
        ) {
            return false;
        }
        return (
            options.canDeleteAnyMessage.value
            && options.chatConversationState.activeConversation?.access_mode
            === "member"
        );
    };

    const isMessageSelected = (messageId: number) =>
        selectedMessageIds.value.includes(messageId);

    const toggleMessageSelected = (messageId: number) => {
        selectedMessageIds.value = isMessageSelected(messageId)
            ? selectedMessageIds.value.filter((item) => item !== messageId)
            : [...selectedMessageIds.value, messageId];
    };

    const handleMessageRowClick = (
        messageItem: ChatMessageItem,
        event: MouseEvent,
    ) => {
        if (!messageSelectionMode.value || messageItem.is_system) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        toggleMessageSelected(messageItem.id);
    };

    const clearMessageSelection = () => {
        selectedMessageIds.value = [];
        messageSelectionMode.value = false;
    };

    const closeMessageMenu = () => {
        messageMenuOpen.value = false;
        messageMenuMessage.value = null;
    };

    const openMessageMenu = (event: MouseEvent, messageItem: ChatMessageItem) => {
        const preferLeft =
            event.clientX + MESSAGE_MENU_WIDTH + MESSAGE_MENU_VIEWPORT_PADDING
            > window.innerWidth;
        const preferTop =
            event.clientY
            + MESSAGE_MENU_MIN_HEIGHT
            + MESSAGE_MENU_VIEWPORT_PADDING > window.innerHeight;
        messageMenuPosition.value = {
            x: preferLeft
                ? Math.max(
                    MESSAGE_MENU_VIEWPORT_PADDING,
                    event.clientX - MESSAGE_MENU_WIDTH,
                )
                : event.clientX,
            y: preferTop
                ? Math.max(
                    MESSAGE_MENU_VIEWPORT_PADDING,
                    event.clientY - MESSAGE_MENU_MIN_HEIGHT,
                )
                : event.clientY,
        };
        messageMenuMessage.value = messageItem;
        messageMenuOpen.value = true;
    };

    const handleDocumentClick = () => {
        closeMessageMenu();
    };

    const handleRetryMessage = async () => {
        if (!messageMenuMessage.value) {
            return;
        }
        try {
            await options.chatMessage.retryMessage(messageMenuMessage.value);
        } catch (error: unknown) {
            message.error(getMessageFailureToast(error));
        } finally {
            closeMessageMenu();
        }
    };

    const buildAttachmentClipboardHtml = (messageItem: ChatMessageItem) => {
        const payload = options.getAssetMessagePayload(messageItem);
        if (!payload) {
            return "";
        }
        const fileSizeText = payload.file_size
            ? formatFileSize(payload.file_size)
            : "大小未知";
        return `<span class="composer-attachment-chip" contenteditable="false" data-solbot-attachment="1" data-token-id="copied_${messageItem.id}" data-source-asset-reference-id="${payload.source_asset_reference_id || payload.asset_reference_id}" data-display-name="${escapeHtml(options.getAssetDisplayName(messageItem))}" data-media-type="${escapeHtml(payload.media_type || messageItem.message_type)}" data-mime-type="${escapeHtml(payload.mime_type || "")}" data-file-size="${payload.file_size || ""}" data-url="${escapeHtml(payload.url || "")}"><span class="composer-attachment-chip__icon">F</span><span class="composer-attachment-chip__body"><span class="composer-attachment-chip__name">${escapeHtml(options.getAssetDisplayName(messageItem))}</span><span class="composer-attachment-chip__size">${escapeHtml(fileSizeText)}</span></span></span>`;
    };

    const handleCopyMessage = async () => {
        if (!messageMenuMessage.value) {
            return;
        }
        try {
            const selectedText = window.getSelection()?.toString().trim() || "";
            if (selectedText) {
                await navigator.clipboard.writeText(selectedText);
                message.success("已复制选中文本");
                closeMessageMenu();
                return;
            }
            if (
                options.isAssetMessage(messageMenuMessage.value)
                && "ClipboardItem" in window
                && navigator.clipboard.write
            ) {
                const html = buildAttachmentClipboardHtml(messageMenuMessage.value);
                const text = [
                    options.getAssetDisplayName(messageMenuMessage.value),
                    options.getAssetMessagePayload(messageMenuMessage.value)?.url || "",
                ]
                    .filter(Boolean)
                    .join("\n");
                await navigator.clipboard.write([
                    new ClipboardItem({
                        "text/plain": new Blob([text], { type: "text/plain" }),
                        "text/html": new Blob([html], { type: "text/html" }),
                    }),
                ]);
                message.success("消息已复制");
                closeMessageMenu();
                return;
            }
            if (options.isChatRecordMessage(messageMenuMessage.value)) {
                await navigator.clipboard.writeText(
                    options.buildChatRecordPlainText(
                        options.getChatRecordPayload(messageMenuMessage.value),
                    ),
                );
                message.success("聊天记录已复制");
                closeMessageMenu();
                return;
            }
            const content = options.isAssetMessage(messageMenuMessage.value)
                ? [
                    options.getAssetDisplayName(messageMenuMessage.value),
                    options.getAssetMessagePayload(messageMenuMessage.value)?.url || "",
                ]
                    .filter(Boolean)
                    .join("\n")
                : messageMenuMessage.value.content;
            await navigator.clipboard.writeText(content);
            message.success("消息已复制");
        } catch {
            message.error("复制失败");
        } finally {
            closeMessageMenu();
        }
    };

    const handleForwardMessage = () => {
        if (!messageMenuMessage.value) {
            return;
        }
        options.beginForwardSelection([messageMenuMessage.value.id]);
        closeMessageMenu();
    };

    const handleForwardSelection = () => {
        if (!selectedMessageIds.value.length) {
            message.warning("请先选择消息");
            return;
        }
        options.beginForwardSelection(selectedMessageIds.value);
    };

    const handleQuoteMessage = () => {
        if (!messageMenuMessage.value) {
            return;
        }
        if (options.isRevokedMessage(messageMenuMessage.value)) {
            message.warning("已撤回的消息不能引用");
            closeMessageMenu();
            return;
        }
        options.quotedMessage.value = messageMenuMessage.value;
        closeMessageMenu();
    };

    const enableMessageSelection = (messageItem: ChatMessageItem) => {
        messageSelectionMode.value = true;
        if (
            !options.isRevokedMessage(messageItem)
            && !isMessageSelected(messageItem.id)
        ) {
            selectedMessageIds.value = [...selectedMessageIds.value, messageItem.id];
        }
        closeMessageMenu();
    };

    const handleMenuDownloadAssetMessage = () => {
        if (!messageMenuMessage.value || !options.isAssetMessage(messageMenuMessage.value)) {
            return;
        }
        options.triggerAssetDownload(messageMenuMessage.value);
        closeMessageMenu();
    };

    const handleMenuSaveAssetToResource = async () => {
        if (!messageMenuMessage.value || !options.isAssetMessage(messageMenuMessage.value)) {
            return;
        }
        const opened = await options.openSaveAssetDialog(messageMenuMessage.value);
        if (opened) {
            closeMessageMenu();
        }
    };

    const handleRevokeMessage = async () => {
        const currentMessage = messageMenuMessage.value;
        if (!currentMessage || !canRevokeMessage(currentMessage)) {
            closeMessageMenu();
            return;
        }
        try {
            await options.chatMessage.revokeMessage(currentMessage.id);
            if (options.quotedMessage.value?.id === currentMessage.id) {
                options.quotedMessage.value = null;
            }
            selectedMessageIds.value = selectedMessageIds.value.filter(
                (item) => item !== currentMessage.id,
            );
            if (!selectedMessageIds.value.length) {
                messageSelectionMode.value = false;
            }
            message.success("消息已撤回");
        } catch (error: unknown) {
            message.error(getErrorMessage(error, "撤回消息失败"));
        } finally {
            closeMessageMenu();
        }
    };

    const handleDeleteMessage = async () => {
        const currentMessage = messageMenuMessage.value;
        if (!currentMessage || !canDeleteMessage(currentMessage)) {
            closeMessageMenu();
            return;
        }
        Modal.confirm({
            title: "确认删除这条消息？",
            content: "删除后，这条消息只会从你的视角中隐藏。",
            okText: "删除",
            okButtonProps: { danger: true },
            cancelText: "取消",
            async onOk() {
                try {
                    const { detail } = await options.chatMessage.deleteMessage(
                        currentMessage.id,
                    );
                    if (options.quotedMessage.value?.id === currentMessage.id) {
                        options.quotedMessage.value = null;
                    }
                    selectedMessageIds.value = selectedMessageIds.value.filter(
                        (item) => item !== currentMessage.id,
                    );
                    if (!selectedMessageIds.value.length) {
                        messageSelectionMode.value = false;
                    }
                    message.success(detail || "消息已删除");
                } catch (error: unknown) {
                    message.error(getErrorMessage(error, "删除消息失败"));
                    throw error;
                } finally {
                    closeMessageMenu();
                }
            },
            onCancel() {
                closeMessageMenu();
            },
        });
    };

    const handleRestoreRevokedMessage = async (messageItem: ChatMessageItem) => {
        try {
            const { draft, detail } = await options.chatMessage.restoreRevokedDraft(
                messageItem.id,
            );
            const draftPayload = (draft.payload || {}) as Partial<ChatMessageAssetPayload>;
            if (draft.message_type === "text" && draft.content) {
                options.composerRef.value?.insertText(draft.content);
            } else if (
                (draft.message_type === "image" || draft.message_type === "file")
                && Number(
                    draftPayload.source_asset_reference_id
                    || draftPayload.asset_reference_id
                    || 0,
                )
            ) {
                options.composerRef.value?.insertAttachment(
                    buildComposerAttachmentToken({
                        sourceAssetReferenceId: Number(
                            draftPayload.source_asset_reference_id
                            || draftPayload.asset_reference_id
                            || 0,
                        ),
                        displayName: String(
                            draftPayload.display_name || messageItem.content || "附件",
                        ),
                        mediaType: String(
                            draftPayload.media_type || draft.message_type || "file",
                        ),
                        mimeType: String(draftPayload.mime_type || ""),
                        fileSize: Number(draftPayload.file_size || 0) || undefined,
                        url: String(draftPayload.url || ""),
                    }),
                );
            }
            options.composerRef.value?.focus();
            message.success(detail || "已恢复到输入框");
        } catch (error: unknown) {
            message.error(getErrorMessage(error, "恢复撤回内容失败"));
        }
    };

    return {
        messageMenuOpen,
        messageMenuMessage,
        messageSelectionMode,
        selectedMessageIds,
        quotedMessage: options.quotedMessage,
        messageMenuStyle,
        canRevokeMessage,
        canDeleteMessage,
        isMessageSelected,
        handleMessageRowClick,
        clearMessageSelection,
        closeMessageMenu,
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
    };
}

function escapeHtml(value: string) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}