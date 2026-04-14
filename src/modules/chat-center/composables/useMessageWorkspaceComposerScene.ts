import { message } from "ant-design-vue";
import { ref, type ComputedRef, type Ref } from "vue";
import type { FileEntryItem, SearchFileEntryItem } from "@/api/upload";
import type {
    ChatComposerAttachmentToken,
    ChatMessageItem,
} from "@/types/chat";
import {
    buildAttachmentSendPayloadFromEntry,
    buildAttachmentSendPayloadFromUploadResult,
} from "@/utils/chatAttachment";
import { getErrorMessage } from "@/utils/error";
import { uploadFileWithCategory } from "@/utils/fileUploader";
import type { RichMessageComposerExpose } from "@/views/Chat/components/RichMessageComposer.vue";

export function buildComposerAttachmentToken(options: {
    sourceAssetReferenceId?: number;
    displayName: string;
    mediaType: string;
    mimeType?: string;
    fileSize?: number;
    url?: string;
    streamUrl?: string;
    thumbnailUrl?: string;
    processingStatus?: string;
    localUploadId?: string;
}): ChatComposerAttachmentToken {
    return {
        token_id: `composer_attachment_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        source_asset_reference_id: options.sourceAssetReferenceId,
        display_name: options.displayName,
        media_type: options.mediaType,
        mime_type: options.mimeType || "",
        file_size: options.fileSize,
        url: options.url || "",
        stream_url: options.streamUrl || "",
        thumbnail_url: options.thumbnailUrl || "",
        processing_status: options.processingStatus || "",
        local_upload_id: options.localUploadId,
    };
}

type UseMessageWorkspaceComposerSceneOptions = {
    authAccessToken: ComputedRef<string | undefined>;
    chatConversationState: {
        activeConversationId: number | null;
        activeConversation: {
            type: "direct" | "group";
            direct_target?: { id: number } | null;
        } | null;
    };
    chatMessage: {
        sendAttachmentMessage: (...args: any[]) => Promise<unknown>;
        sendTextMessage: (...args: any[]) => Promise<unknown>;
        sendTyping: (isTyping: boolean) => void;
    };
    composerBlockedReason: ComputedRef<string>;
    composerDisabled: ComputedRef<boolean>;
    canSendAttachment: ComputedRef<boolean>;
    isDirectFriend: ComputedRef<boolean>;
    quotedMessage: Ref<ChatMessageItem | null>;
};

export function useMessageWorkspaceComposerScene(
    options: UseMessageWorkspaceComposerSceneOptions,
) {
    const assetPickerOpen = ref(false);
    const composerRef = ref<RichMessageComposerExpose | null>(null);
    const attachmentInputRef = ref<HTMLInputElement | null>(null);
    const attachmentUploading = ref(false);
    const typingStopTimer = ref<number | null>(null);
    const localAttachmentFiles = new Map<string, { file: File; objectUrl: string }>();

    const getAttachmentSendGuardMessage = () => {
        const activeConversation = options.chatConversationState.activeConversation;
        if (options.composerBlockedReason.value) {
            return options.composerBlockedReason.value;
        }
        if (!options.canSendAttachment.value) {
            return "当前角色无发送附件权限";
        }
        if (activeConversation?.type === "direct" && !options.isDirectFriend.value) {
            return "你们还不是好友，当前私聊暂不支持发送附件";
        }
        return "";
    };

    const rememberLocalAttachmentFile = (file: File) => {
        const localUploadId = `local_upload_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const objectUrl = URL.createObjectURL(file);
        localAttachmentFiles.set(localUploadId, { file, objectUrl });
        return { localUploadId, objectUrl };
    };

    const releaseLocalAttachmentFile = (localUploadId?: string) => {
        if (!localUploadId) {
            return;
        }
        const target = localAttachmentFiles.get(localUploadId);
        if (!target) {
            return;
        }
        URL.revokeObjectURL(target.objectUrl);
        localAttachmentFiles.delete(localUploadId);
    };

    const insertAttachmentToken = (token: ChatComposerAttachmentToken) => {
        composerRef.value?.insertAttachment(token);
    };

    const insertLocalFilesIntoComposer = (files: File[]) => {
        for (const file of files) {
            const { localUploadId, objectUrl } = rememberLocalAttachmentFile(file);
            insertAttachmentToken(
                buildComposerAttachmentToken({
                    displayName: file.name,
                    mediaType: file.type.startsWith("video/")
                        ? "video"
                        : file.type.startsWith("image/")
                            ? "image"
                            : "file",
                    mimeType: file.type || "",
                    fileSize: file.size,
                    url: objectUrl,
                    localUploadId,
                }),
            );
        }
    };

    const handleComposerPasteFiles = async (files: File[]) => {
        const guardMessage = getAttachmentSendGuardMessage();
        if (guardMessage) {
            message.warning(guardMessage);
            return;
        }
        if (!files.length) {
            return;
        }
        insertLocalFilesIntoComposer(files);
    };

    const handleSendMessage = async () => {
        if (options.composerDisabled.value) {
            if (options.composerBlockedReason.value) {
                message.warning(options.composerBlockedReason.value);
            }
            return;
        }
        const segments = composerRef.value?.getSegments() || [];
        if (!segments.length) {
            message.warning("消息不能为空");
            return;
        }
        const quotedMessageId = options.quotedMessage.value?.id;
        try {
            for (const segment of segments) {
                if (segment.kind === "text") {
                    await options.chatMessage.sendTextMessage(segment.text, quotedMessageId);
                    continue;
                }
                const localUploadId = segment.attachment.local_upload_id;
                if (localUploadId) {
                    const pendingLocalAttachment = localAttachmentFiles.get(localUploadId);
                    if (!pendingLocalAttachment) {
                        throw new Error("本地附件已失效，请重新选择后再发送");
                    }
                    await options.chatMessage.sendAttachmentMessage({
                        displayName: segment.attachment.display_name,
                        mediaType: segment.attachment.media_type,
                        mimeType: segment.attachment.mime_type,
                        fileSize: segment.attachment.file_size,
                        url: pendingLocalAttachment.objectUrl,
                        quotedMessageId,
                        uploadBeforeSend: async (updateProgress: (payload: Record<string, unknown>) => void) => {
                            if (!options.authAccessToken.value) {
                                throw new Error("登录状态无效，无法发送附件");
                            }
                            const result = await uploadFileWithCategory({
                                file: pendingLocalAttachment.file,
                                category: "chat",
                                token: options.authAccessToken.value,
                                onHashProgress: (progress) => {
                                    updateProgress({
                                        upload_progress: Math.floor(progress * 0.2),
                                        upload_phase: "uploading",
                                    });
                                },
                                onChunkProgress: (progress) => {
                                    updateProgress({
                                        upload_progress: 20 + Math.floor(progress * 0.5),
                                        upload_phase: "uploading",
                                    });
                                },
                                onMergeProgress: (progress) => {
                                    updateProgress({
                                        upload_progress: 70 + Math.floor(progress * 0.3),
                                        upload_phase: "uploading",
                                    });
                                },
                            });
                            const payload = buildAttachmentSendPayloadFromUploadResult(
                                result,
                                pendingLocalAttachment.file,
                            );
                            releaseLocalAttachmentFile(localUploadId);
                            return {
                                sourceAssetReferenceId: payload.sourceAssetReferenceId,
                                displayName: payload.displayName,
                                mediaType: payload.mediaType,
                                mimeType: payload.mimeType,
                                fileSize: payload.fileSize,
                                url: payload.url,
                                streamUrl: payload.streamUrl,
                                thumbnailUrl: payload.thumbnailUrl,
                                processingStatus: payload.processingStatus,
                            };
                        },
                    });
                    continue;
                }
                await options.chatMessage.sendAttachmentMessage({
                    sourceAssetReferenceId: segment.attachment.source_asset_reference_id,
                    displayName: segment.attachment.display_name,
                    mediaType: segment.attachment.media_type,
                    mimeType: segment.attachment.mime_type,
                    fileSize: segment.attachment.file_size,
                    url: segment.attachment.url,
                    streamUrl: segment.attachment.stream_url,
                    thumbnailUrl: segment.attachment.thumbnail_url,
                    processingStatus: segment.attachment.processing_status,
                    quotedMessageId,
                });
            }
            composerRef.value?.clear();
            options.quotedMessage.value = null;
        } catch (error: unknown) {
            message.error(getErrorMessage(error, "发送消息失败"));
        } finally {
            options.chatMessage.sendTyping(false);
        }
    };

    const triggerAttachmentSelect = () => {
        const guardMessage = getAttachmentSendGuardMessage();
        if (guardMessage || attachmentUploading.value) {
            if (guardMessage) {
                message.warning(guardMessage);
            }
            return;
        }
        attachmentInputRef.value?.click();
    };

    const openResourceAttachmentPicker = async () => {
        const guardMessage = getAttachmentSendGuardMessage();
        if (guardMessage) {
            message.warning(guardMessage);
            return;
        }
        if (!options.chatConversationState.activeConversationId) {
            message.warning("请先选择会话");
            return;
        }
        assetPickerOpen.value = true;
    };

    const handleAssetPickerSelect = async (item: FileEntryItem | SearchFileEntryItem) => {
        try {
            const payload = buildAttachmentSendPayloadFromEntry(item);
            insertAttachmentToken(
                buildComposerAttachmentToken({
                    sourceAssetReferenceId: payload.sourceAssetReferenceId,
                    displayName: payload.displayName,
                    mediaType: payload.mediaType,
                    mimeType: payload.mimeType,
                    fileSize: payload.fileSize,
                    url: payload.url,
                    streamUrl: payload.streamUrl,
                    thumbnailUrl: payload.thumbnailUrl,
                    processingStatus: payload.processingStatus,
                }),
            );
            message.success("附件已加入输入框");
        } catch (error: unknown) {
            assetPickerOpen.value = true;
            message.error(getErrorMessage(error, "加入附件失败"));
        }
    };

    const handleComposerMenuClick = ({ key }: { key: string }) => {
        if (key === "attachment") {
            triggerAttachmentSelect();
            return;
        }
        if (key === "asset-picker") {
            void openResourceAttachmentPicker();
        }
    };

    const handleAttachmentSelection = async (event: Event) => {
        const input = event.target as HTMLInputElement | null;
        const files = Array.from(input?.files || []);
        if (input) {
            input.value = "";
        }
        if (!files.length) {
            return;
        }
        const guardMessage = getAttachmentSendGuardMessage();
        if (guardMessage) {
            message.warning(guardMessage);
            return;
        }
        insertLocalFilesIntoComposer(files);
        message.success(files.length === 1 ? "附件已加入输入框" : `已加入 ${files.length} 个附件`);
    };

    const stopTypingSoon = () => {
        if (typingStopTimer.value) {
            window.clearTimeout(typingStopTimer.value);
        }
        typingStopTimer.value = window.setTimeout(() => {
            options.chatMessage.sendTyping(false);
        }, 1200);
    };

    const handleComposerTypingChange = (hasContent: boolean) => {
        if (options.chatConversationState.activeConversation?.type !== "direct") {
            return;
        }
        options.chatMessage.sendTyping(hasContent);
        stopTypingSoon();
    };

    const disposeComposerScene = () => {
        if (typingStopTimer.value) {
            window.clearTimeout(typingStopTimer.value);
        }
        localAttachmentFiles.forEach((item) => {
            URL.revokeObjectURL(item.objectUrl);
        });
        localAttachmentFiles.clear();
    };

    return {
        assetPickerOpen,
        composerRef,
        attachmentInputRef,
        attachmentUploading,
        insertAttachmentToken,
        handleComposerPasteFiles,
        handleSendMessage,
        triggerAttachmentSelect,
        openResourceAttachmentPicker,
        handleAssetPickerSelect,
        handleComposerMenuClick,
        handleAttachmentSelection,
        handleComposerTypingChange,
        disposeComposerScene,
    };
}