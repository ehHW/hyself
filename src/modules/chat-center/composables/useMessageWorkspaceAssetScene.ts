import { message } from "ant-design-vue";
import { computed, ref, type ComputedRef } from "vue";
import type { FileEntryItem } from "@/api/upload";
import { applyGroupInvitationApi } from "@/api/chat";
import {
    createFolderApi,
    getFileEntriesApi,
    saveChatAttachmentToResourceApi,
} from "@/api/upload";
import type {
    ChatGroupInvitationPayload,
    ChatMessageAssetPayload,
    ChatMessageItem,
    ChatMessageRecordPayload,
} from "@/types/chat";
import { getErrorMessage } from "@/utils/error";
import { formatFileSize } from "@/utils/fileFormatter";
import { trimText } from "@/validators/common";

type UseMessageWorkspaceAssetSceneOptions = {
    canCreateFolderInResource: ComputedRef<boolean>;
    canSaveChatAttachmentToResource: ComputedRef<boolean>;
    chatConversation: {
        loadConversations: () => Promise<void>;
        loadContactGroupConversations: () => Promise<void>;
        selectConversation: (conversationId: number) => Promise<void>;
    };
    getChatRecordPayload: (
        messageItem: ChatMessageItem,
    ) => ChatMessageRecordPayload | null;
    openChatRecordViewerFromMessage: (messageItem: ChatMessageItem) => void;
};

export function useMessageWorkspaceAssetScene(
    options: UseMessageWorkspaceAssetSceneOptions,
) {
    const assetPreviewOpen = ref(false);
    const previewingAssetMessage = ref<ChatMessageItem | null>(null);
    const groupInvitationModalOpen = ref(false);
    const activeInvitationMessage = ref<ChatMessageItem | null>(null);
    const groupInvitationApplying = ref(false);
    const saveAssetDialogOpen = ref(false);
    const saveAssetPendingMessage = ref<ChatMessageItem | null>(null);
    const saveAssetLoading = ref(false);
    const saveAssetSaving = ref(false);
    const saveAssetCreateFolderOpen = ref(false);
    const saveAssetFolderName = ref("");
    const saveAssetCurrentParentId = ref<number | null>(null);
    const saveAssetFolderEntries = ref<FileEntryItem[]>([]);
    const saveAssetBreadcrumbs = ref<Array<{ id: number | null; name: string }>>([
        { id: null, name: "我的文件" },
    ]);

    const getAssetMessagePayload = (
        messageItem: ChatMessageItem,
    ): ChatMessageAssetPayload | null => {
        if (
            messageItem.message_type !== "image"
            && messageItem.message_type !== "file"
        ) {
            return null;
        }
        const payload = messageItem.payload as Partial<ChatMessageAssetPayload>;
        if (
            !payload
            || (!payload.asset_reference_id
                && !payload.source_asset_reference_id
                && !payload.url
                && !payload.local_upload_id)
        ) {
            return null;
        }
        return payload as ChatMessageAssetPayload;
    };

    const getAssetDisplayName = (messageItem: ChatMessageItem) =>
        getAssetMessagePayload(messageItem)?.display_name
        || messageItem.content
        || "附件";

    const isAssetMessage = (messageItem: ChatMessageItem) =>
        Boolean(getAssetMessagePayload(messageItem));

    const canPreviewImage = (messageItem: ChatMessageItem) =>
        messageItem.message_type === "image"
        && Boolean(getAssetMessagePayload(messageItem)?.url);

    const canPreviewVideo = (messageItem: ChatMessageItem) => {
        if (messageItem.message_type !== "file") {
            return false;
        }
        const payload = getAssetMessagePayload(messageItem);
        const mediaType = String(payload?.media_type || "")
            .trim()
            .toLowerCase();
        const mimeType = String(payload?.mime_type || "")
            .trim()
            .toLowerCase();
        return (
            Boolean(payload?.url || payload?.stream_url)
            && (mediaType === "video" || mimeType.startsWith("video/"))
        );
    };

    const getVideoPosterUrl = (messageItem: ChatMessageItem) => {
        const payload = getAssetMessagePayload(messageItem);
        return payload?.thumbnail_url || "";
    };

    const normalizeMediaDimension = (value: unknown) => {
        const numberValue = Number(value);
        return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
    };

    const getAssetPreviewDimensions = (messageItem: ChatMessageItem) => {
        const payload = getAssetMessagePayload(messageItem);
        const rawPayload = payload as
            | (Record<string, unknown> & {
                extra_metadata?: {
                    video_processing?: {
                        width?: number | null;
                        height?: number | null;
                    };
                };
            })
            | null;
        const width =
            normalizeMediaDimension(rawPayload?.width)
            || normalizeMediaDimension(
                rawPayload?.extra_metadata?.video_processing?.width,
            );
        const height =
            normalizeMediaDimension(rawPayload?.height)
            || normalizeMediaDimension(
                rawPayload?.extra_metadata?.video_processing?.height,
            );
        return { width, height };
    };

    const getAssetPreviewBoxStyle = (messageItem: ChatMessageItem) => {
        const { width, height } = getAssetPreviewDimensions(messageItem);
        if (!width || !height) {
            return undefined;
        }
        const scale = Math.min(320 / width, 220 / height, 1);
        return {
            "--attachment-preview-width": `${Math.round(width * scale)}px`,
            "--attachment-preview-height": `${Math.round(height * scale)}px`,
        };
    };

    const getAssetPreviewImageUrl = (messageItem: ChatMessageItem) =>
        getAssetMessagePayload(messageItem)?.url || "";

    const getAssetUploadProgress = (messageItem: ChatMessageItem) => {
        const progress = Number(
            getAssetMessagePayload(messageItem)?.upload_progress || 0,
        );
        return Math.min(100, Math.max(0, Math.round(progress)));
    };

    const isAssetUploading = (messageItem: ChatMessageItem) => {
        const payload = getAssetMessagePayload(messageItem);
        return (
            messageItem.local_status === "sending"
            && payload?.upload_phase === "uploading"
        );
    };

    const showVideoPlayOverlay = (messageItem: ChatMessageItem) =>
        canPreviewVideo(messageItem) && !isAssetUploading(messageItem);

    const formatAssetFileSize = (messageItem: ChatMessageItem) => {
        const fileSize = Number(
            getAssetMessagePayload(messageItem)?.file_size || 0,
        );
        return fileSize > 0 ? formatFileSize(fileSize) : "大小未知";
    };

    const getGroupInvitationPayload = (messageItem: ChatMessageItem) => {
        const payload = messageItem.payload as {
            group_invitation?: ChatGroupInvitationPayload;
        };
        return payload.group_invitation || null;
    };

    const activeGroupInvitation = computed(() =>
        activeInvitationMessage.value
            ? getGroupInvitationPayload(activeInvitationMessage.value)
            : null,
    );

    const assetPreviewTitle = computed(() =>
        previewingAssetMessage.value
            ? getAssetDisplayName(previewingAssetMessage.value)
            : "媒体预览",
    );

    const hasAssetUrl = (messageItem: ChatMessageItem) =>
        Boolean(getAssetMessagePayload(messageItem)?.url);

    const hasAssetPlaybackSource = (messageItem: ChatMessageItem) =>
        Boolean(
            getAssetMessagePayload(messageItem)?.stream_url
            || getAssetMessagePayload(messageItem)?.url,
        );

    const hasMessageBubbleAction = (messageItem: ChatMessageItem) =>
        Boolean(
            getGroupInvitationPayload(messageItem)
            || hasAssetUrl(messageItem)
            || options.getChatRecordPayload(messageItem),
        );

    const isChatRecordMessage = (messageItem: ChatMessageItem) =>
        Boolean(options.getChatRecordPayload(messageItem));

    const isPreviewableAssetMessage = (messageItem: ChatMessageItem) => {
        if (messageItem.message_type === "image") {
            return true;
        }
        const payload = getAssetMessagePayload(messageItem);
        const mediaType = String(payload?.media_type || "")
            .trim()
            .toLowerCase();
        const mimeType = String(payload?.mime_type || "")
            .trim()
            .toLowerCase();
        return (
            mediaType === "video"
            || mediaType === "audio"
            || mimeType.startsWith("video/")
            || mimeType.startsWith("audio/")
        );
    };

    const triggerAssetDownload = (messageItem: ChatMessageItem) => {
        const url = getAssetMessagePayload(messageItem)?.url || "";
        if (!url) {
            return;
        }
        const link = document.createElement("a");
        link.href = url;
        link.download = getAssetDisplayName(messageItem);
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const loadSaveAssetFolders = async (parentId?: number | null) => {
        saveAssetLoading.value = true;
        try {
            const { data } = await getFileEntriesApi(parentId ?? null);
            saveAssetCurrentParentId.value = parentId ?? null;
            saveAssetBreadcrumbs.value = data.breadcrumbs;
            saveAssetFolderEntries.value = data.items.filter(
                (item) => item.is_dir && !item.is_recycle_bin,
            );
        } finally {
            saveAssetLoading.value = false;
        }
    };

    const openPreviewableAsset = (messageItem: ChatMessageItem) => {
        previewingAssetMessage.value = messageItem;
        assetPreviewOpen.value = true;
    };

    const openAssetMessage = (messageItem: ChatMessageItem) => {
        if (!hasAssetPlaybackSource(messageItem)) {
            return;
        }
        if (!isPreviewableAssetMessage(messageItem)) {
            triggerAssetDownload(messageItem);
            return;
        }
        openPreviewableAsset(messageItem);
    };

    const openGroupInvitationModal = (messageItem: ChatMessageItem) => {
        if (!getGroupInvitationPayload(messageItem)) {
            return;
        }
        activeInvitationMessage.value = messageItem;
        groupInvitationModalOpen.value = true;
    };

    const handleMessageBubbleClick = (messageItem: ChatMessageItem) => {
        if (getGroupInvitationPayload(messageItem)) {
            openGroupInvitationModal(messageItem);
            return;
        }
        if (options.getChatRecordPayload(messageItem)) {
            options.openChatRecordViewerFromMessage(messageItem);
            return;
        }
        openAssetMessage(messageItem);
    };

    const toggleSaveAssetFolderInline = () => {
        if (!options.canCreateFolderInResource.value) {
            message.warning("当前角色无创建目录权限");
            return;
        }
        saveAssetCreateFolderOpen.value = !saveAssetCreateFolderOpen.value;
        if (!saveAssetCreateFolderOpen.value) {
            saveAssetFolderName.value = "";
        }
    };

    const openSaveAssetBreadcrumb = async (id: number | null) => {
        try {
            await loadSaveAssetFolders(id);
        } catch (error: unknown) {
            message.error(getErrorMessage(error, "打开目录失败"));
        }
    };

    const enterSaveAssetFolder = async (folder: FileEntryItem) => {
        try {
            await loadSaveAssetFolders(folder.id);
        } catch (error: unknown) {
            message.error(getErrorMessage(error, "进入目录失败"));
        }
    };

    const handleCreateSaveAssetFolder = async () => {
        if (!options.canCreateFolderInResource.value) {
            message.warning("当前角色无创建目录权限");
            return;
        }
        const folderName = trimText(saveAssetFolderName.value);
        if (!folderName) {
            message.warning("请输入目录名称");
            return;
        }
        saveAssetSaving.value = true;
        try {
            await createFolderApi({
                name: folderName,
                parent_id: saveAssetCurrentParentId.value,
            });
            saveAssetFolderName.value = "";
            saveAssetCreateFolderOpen.value = false;
            await loadSaveAssetFolders(saveAssetCurrentParentId.value);
            message.success("目录已创建");
        } catch (error: unknown) {
            message.error(getErrorMessage(error, "创建目录失败"));
        } finally {
            saveAssetSaving.value = false;
        }
    };

    const openSaveAssetDialog = async (messageItem: ChatMessageItem) => {
        if (!options.canSaveChatAttachmentToResource.value) {
            message.warning("当前角色无保存聊天附件权限");
            return false;
        }
        if (!isAssetMessage(messageItem)) {
            return false;
        }
        saveAssetPendingMessage.value = messageItem;
        saveAssetDialogOpen.value = true;
        saveAssetCreateFolderOpen.value = false;
        saveAssetFolderName.value = "";
        try {
            await loadSaveAssetFolders(null);
            return true;
        } catch (error: unknown) {
            saveAssetDialogOpen.value = false;
            saveAssetPendingMessage.value = null;
            message.error(getErrorMessage(error, "加载目录失败"));
            return false;
        }
    };

    const confirmSaveAssetToResource = async () => {
        if (!options.canSaveChatAttachmentToResource.value) {
            message.warning("当前角色无保存聊天附件权限");
            return;
        }
        const currentMessage = saveAssetPendingMessage.value;
        if (!currentMessage) {
            saveAssetDialogOpen.value = false;
            return;
        }
        const payload = getAssetMessagePayload(currentMessage);
        const sourceAssetReferenceId = Number(
            payload?.asset_reference_id || payload?.source_asset_reference_id || 0,
        );
        if (!sourceAssetReferenceId) {
            message.warning("当前附件暂不支持保存到资源中心");
            return;
        }
        saveAssetSaving.value = true;
        try {
            await saveChatAttachmentToResourceApi({
                source_asset_reference_id: sourceAssetReferenceId,
                parent_id: saveAssetCurrentParentId.value,
                display_name:
                    payload?.display_name || currentMessage.content || undefined,
            });
            saveAssetDialogOpen.value = false;
            saveAssetPendingMessage.value = null;
            message.success("已保存到资源中心");
        } catch (error: unknown) {
            message.error(getErrorMessage(error, "保存附件失败"));
        } finally {
            saveAssetSaving.value = false;
        }
    };

    const handleApplyGroupInvitation = async () => {
        const invitation = activeGroupInvitation.value;
        if (!invitation) {
            return;
        }
        groupInvitationApplying.value = true;
        try {
            const { data } = await applyGroupInvitationApi({
                conversation_id: invitation.conversation_id,
                inviter_user_id: invitation.inviter.id,
            });
            await Promise.all([
                options.chatConversation.loadConversations(),
                options.chatConversation.loadContactGroupConversations(),
            ]);
            if (data.mode === "joined" && data.conversation?.id) {
                await options.chatConversation.selectConversation(data.conversation.id);
            }
            groupInvitationModalOpen.value = false;
            message.success(data.detail || "申请已提交");
        } catch (error: unknown) {
            message.error(getErrorMessage(error, "申请入群失败"));
        } finally {
            groupInvitationApplying.value = false;
        }
    };

    return {
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
        openPreviewableAsset,
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
    };
}