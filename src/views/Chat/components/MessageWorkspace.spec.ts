import { shallowMount, type VueWrapper } from "@vue/test-utils";
import {
    computed,
    defineComponent,
    h,
    nextTick,
    ref,
} from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routeState = ref({ name: "ChatMessages" });
const stealthAuditEnabled = ref(false);
const routerReplace = vi.fn(async () => undefined);
const routerPush = vi.fn(async () => undefined);

const activeConversation = {
    id: 12,
    type: "direct",
    name: "测试会话",
    access_mode: "member",
    unread_count: 0,
    direct_target: { id: 9, username: "peer", display_name: "Peer", avatar: "" },
    member_count: 2,
};
const activeMessage = {
    id: 101,
    sequence: 5,
    message_type: "text",
    content: "hello",
    payload: {},
    is_system: false,
    sender: { id: 9, username: "peer", display_name: "Peer", avatar: "" },
    created_at: "2026-01-01T00:00:00Z",
    local_status: null,
    local_error: null,
};

const chatStoreState = {
    conversationState: {
        activeConversationId: 12,
        activeConversation,
        conversations: [activeConversation],
        focusedSequenceMap: {},
    },
    messageState: {
        activeMessages: [activeMessage],
        loadingMessages: false,
    },
    friendshipState: {},
    groupState: {
        activeMembers: [],
    },
};

const chatStore = {
    state: chatStoreState,
    conversation: {
        selectConversation: vi.fn(async () => undefined),
        clearFocusedSequence: vi.fn(),
        loadConversations: vi.fn(async () => undefined),
        loadContactGroupConversations: vi.fn(async () => undefined),
    },
    message: {
        loadMessages: vi.fn(async () => undefined),
        loadOlderMessages: vi.fn(async () => undefined),
        markConversationRead: vi.fn(async () => undefined),
        sendTyping: vi.fn(),
        loadJoinRequests: vi.fn(async () => undefined),
        retryMessage: vi.fn(async () => undefined),
        revokeMessage: vi.fn(async () => undefined),
        deleteMessage: vi.fn(async () => ({ detail: "ok" })),
        restoreRevokedDraft: vi.fn(async () => ({ draft: activeMessage, detail: "ok" })),
        sendTextMessage: vi.fn(async () => undefined),
        sendAttachmentMessage: vi.fn(async () => undefined),
    },
    friendship: {
        loadFriends: vi.fn(async () => undefined),
    },
    group: {
        loadMembers: vi.fn(async () => undefined),
    },
};

const composerRef = ref(null);
const attachmentInputRef = ref(null);
const composerHandleSendMessage = vi.fn(async () => undefined);
const composerHandlePasteFiles = vi.fn(async () => undefined);
const composerHandleTypingChange = vi.fn();
const composerHandleMenuClick = vi.fn();
const composerHandleAttachmentSelection = vi.fn(async () => undefined);
const composerHandleAssetPickerSelect = vi.fn(async () => undefined);
const composerDispose = vi.fn();

const assetHandleMessageBubbleClick = vi.fn();
const assetTriggerDownload = vi.fn();
const assetOpenSaveDialog = vi.fn(async () => true);
const assetHandleApplyInvitation = vi.fn(async () => undefined);

const menuOpenMessageMenu = vi.fn();
const menuHandleDocumentClick = vi.fn();
const menuHandleRetryMessage = vi.fn(async () => undefined);
const menuHandleCopyMessage = vi.fn(async () => undefined);
const menuHandleForwardMessage = vi.fn();
const menuHandleForwardSelection = vi.fn();
const menuHandleQuoteMessage = vi.fn();
const menuEnableMessageSelection = vi.fn();
const menuHandleDownloadAssetMessage = vi.fn();
const menuHandleSaveAssetToResource = vi.fn(async () => undefined);
const menuHandleRevokeMessage = vi.fn(async () => undefined);
const menuHandleDeleteMessage = vi.fn(async () => undefined);
const menuHandleRestoreRevokedMessage = vi.fn(async () => undefined);
const menuHandleRowClick = vi.fn();
const menuClearSelection = vi.fn();
const menuCloseMessageMenu = vi.fn();

const ImportedSimpleStub = defineComponent({
    setup(_, { slots }) {
        return () => h("div", slots.default?.());
    },
});

const ImportedRichMessageComposerStub = defineComponent({
    name: "RichMessageComposer",
    emits: ["typing-change", "paste-files", "request-submit"],
    setup(_, { emit }) {
        return () =>
            h("div", { class: "rich-composer-stub" }, [
                h(
                    "button",
                    {
                        class: "emit-submit",
                        onClick: () => emit("request-submit"),
                    },
                    "submit",
                ),
                h(
                    "button",
                    {
                        class: "emit-paste",
                        onClick: () => emit("paste-files", [new File(["x"], "demo.txt")]),
                    },
                    "paste",
                ),
            ]);
    },
});

vi.mock("vue-router", () => ({
    useRoute: () => routeState.value,
    useRouter: () => ({
        replace: routerReplace,
        push: routerPush,
    }),
}));

vi.mock("ant-design-vue", () => ({
    Modal: {
        confirm: vi.fn(),
    },
    message: {
        warning: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock("@/stores/auth", () => ({
    useAuthStore: () => ({
        accessToken: "token",
    }),
}));

vi.mock("@/stores/user", () => ({
    useUserStore: () => ({
        user: { id: 1, username: "me", display_name: "Me" },
    }),
}));

vi.mock("@/components/AvatarCropModal.vue", () => ({
    default: ImportedSimpleStub,
}));

vi.mock("@/components/assets/AssetPickerDialog.vue", () => ({
    default: ImportedSimpleStub,
}));

vi.mock("@/modules/chat-center/components/ChatWorkspaceForwardDialogs.vue", () => ({
    default: ImportedSimpleStub,
}));

vi.mock("@/modules/chat-center/components/ChatWorkspaceRecordModals.vue", () => ({
    default: ImportedSimpleStub,
}));

vi.mock("@/views/Chat/components/ChatRecordCard.vue", () => ({
    default: ImportedSimpleStub,
}));

vi.mock("@/views/Chat/components/ChatVideoPlayer.vue", () => ({
    default: ImportedSimpleStub,
}));

vi.mock("@/views/Chat/components/VideoAttachmentThumbnail.vue", () => ({
    default: ImportedSimpleStub,
}));

vi.mock("@/views/Chat/components/RichMessageComposer.vue", () => ({
    default: ImportedRichMessageComposerStub,
}));

vi.mock("@/views/Chat/useChatShell", () => ({
    useChatShell: () => ({
        avatarText: (value: string) => String(value || "?").slice(0, 1),
        canEditRoles: computed(() => false),
        canLoadOlderMessages: false,
        chatStore,
        formatDateTime: (value: string) => value,
        isSelfMessage: (messageItem: typeof activeMessage) => messageItem.sender?.id === 1,
        isStealthAuditEnabled: computed(() => stealthAuditEnabled.value),
        messageRowClass: () => "",
        settingsStore: {
            chatSendHotkey: "enter",
            chatLayout: { composerHeight: 200 },
            save: vi.fn(),
            saveChatPreferences: vi.fn(async () => undefined),
        },
        typingText: "",
    }),
}));

vi.mock("@/modules/chat-center/composables/useConversationWorkspaceScene", () => ({
    useConversationWorkspaceScene: () => ({
        availableInviteFriends: computed(() => []),
        canAddFriend: computed(() => false),
        canCreateFolderInResource: computed(() => true),
        canDeleteAnyMessage: computed(() => true),
        canDeleteFriend: computed(() => false),
        canForwardMessage: computed(() => true),
        canInviteGroupMembers: computed(() => false),
        canManageGroupPermission: computed(() => false),
        canPinConversationPermission: computed(() => false),
        canRestoreRevokedDraft: computed(() => true),
        canRevokeAnyMessage: computed(() => true),
        canSaveChatAttachmentToResource: computed(() => true),
        canSendAttachment: computed(() => true),
        canSendTextMessage: computed(() => true),
        composerBlockedReason: computed(() => ""),
        composerDisabled: computed(() => false),
        currentConversationMember: computed(() => null),
        currentFriendship: computed(() => null),
        directConversationTitle: computed(() => "测试会话"),
        directTargetUser: computed(() => activeConversation.direct_target),
        isDirectFriend: computed(() => true),
        isSelfDirectConversation: computed(() => false),
        settingsDrawerTitle: computed(() => "设置"),
        showDirectActions: computed(() => false),
        showSettingsTrigger: computed(() => false),
    }),
}));

vi.mock("@/modules/chat-center/composables/useMessageWorkspaceSettingsScene", () => ({
    useMessageWorkspaceSettingsScene: () => ({
        groupDrawerOpen: ref(false),
        groupConfigSaving: ref(false),
        groupAvatarUploading: ref(false),
        groupNameEditing: ref(false),
        groupNicknameEditing: ref(false),
        directRemarkEditing: ref(false),
        groupNameInputRef: ref(null),
        groupNicknameInputRef: ref(null),
        directRemarkInputRef: ref(null),
        muteNotifications: ref(false),
        pinnedConversation: ref(false),
        groupNicknameInput: ref(""),
        directRemark: ref(""),
        avatarCropOpen: ref(false),
        avatarCropImageUrl: ref(""),
        groupConfigForm: { name: "测试会话", avatar: "", max_members: null, join_approval_required: false, allow_member_invite: false, mute_all: false },
        openSettingsDrawer: vi.fn(),
        handleGroupAvatarUpload: vi.fn(),
        handleAvatarCropCancel: vi.fn(),
        handleAvatarCropConfirm: vi.fn(),
        handleSaveGroupConfig: vi.fn(),
        toggleGroupNameEditing: vi.fn(),
        handleGroupNameBlur: vi.fn(),
        handleGroupNameEnter: vi.fn(),
        handleGroupNameEscape: vi.fn(),
        handleGroupMaxMembersBlur: vi.fn(),
        handleGroupSwitchChange: vi.fn(),
        handlePinChange: vi.fn(),
        handleMuteNotificationChange: vi.fn(),
        toggleGroupNicknameEditing: vi.fn(),
        handleGroupNicknameBlur: vi.fn(),
        handleGroupNicknameEnter: vi.fn(),
        handleGroupNicknameEscape: vi.fn(),
        toggleDirectRemarkEditing: vi.fn(),
        handleDirectRemarkBlur: vi.fn(),
        handleDirectRemarkEnter: vi.fn(),
        handleDirectRemarkEscape: vi.fn(),
        handleLeaveConversation: vi.fn(),
        handleAddFriend: vi.fn(),
        handleDeleteCurrentFriend: vi.fn(),
    }),
}));

vi.mock("@/modules/chat-center/composables/useMessageWorkspaceMemberScene", () => ({
    useMessageWorkspaceMemberScene: () => ({
        memberModalOpen: ref(false),
        inviteModalOpen: ref(false),
        selectedInviteUserIds: ref([]),
        memberSearchKeyword: ref(""),
        inviteSearchKeyword: ref(""),
        previewMembers: computed(() => []),
        filteredGroupMembers: computed(() => []),
        filteredAvailableInviteFriends: computed(() => []),
        memberRoleLabel: () => "member",
        memberDisplayName: () => "member",
        memberRemarkHint: () => "",
        isMuteActive: () => false,
        showMemberActionMenu: () => false,
        openMemberModal: vi.fn(),
        openInviteModal: vi.fn(),
        toggleInviteUser: vi.fn(),
        handleInviteMembers: vi.fn(async () => undefined),
        handleMemberActionMenuClick: vi.fn(async () => undefined),
        handleMemberDoubleClick: vi.fn(async () => undefined),
        handleDisbandConversation: vi.fn(async () => undefined),
        handleJoinRequestAction: vi.fn(async () => undefined),
        resetMemberManagementState: vi.fn(),
    }),
}));

vi.mock("@/modules/chat-center/composables/useChatWorkspaceForwarding", () => ({
    useChatWorkspaceForwarding: () => ({
        forwardModalOpen: ref(false),
        forwardModeModalOpen: ref(false),
        forwardSearchKeyword: ref(""),
        selectedForwardTargetKey: ref(""),
        forwarding: ref(false),
        forwardingMessageIds: ref<number[]>([]),
        pendingForwardTarget: ref(null),
        recentForwardTargets: computed(() => []),
        filteredForwardTargets: computed(() => []),
        buildForwardMessageSummary: () => "",
        beginForwardSelection: vi.fn(),
        handleSelectForwardTarget: vi.fn(),
        handleConfirmForwardMode: vi.fn(async () => undefined),
        resetForwardingState: vi.fn(),
    }),
}));

vi.mock("@/modules/chat-center/composables/useChatWorkspaceRecords", () => ({
    useChatWorkspaceRecords: () => ({
        chatRecordViewerStack: ref([]),
        buildChatRecordPlainText: () => "record",
        openChatRecordViewer: vi.fn(),
        openChatRecordViewerFromMessage: vi.fn(),
        closeChatRecordViewer: vi.fn(),
        removeChatRecordViewer: vi.fn(),
        handleCopyChatRecordEntry: vi.fn(),
        handleForwardChatRecordEntry: vi.fn(),
        clearChatRecordViewers: vi.fn(),
    }),
}));

vi.mock("@/modules/chat-center/composables/useMessageWorkspaceComposerScene", () => ({
    useMessageWorkspaceComposerScene: () => ({
        assetPickerOpen: ref(false),
        composerRef,
        attachmentInputRef,
        attachmentUploading: ref(false),
        handleComposerPasteFiles: composerHandlePasteFiles,
        handleSendMessage: composerHandleSendMessage,
        handleAssetPickerSelect: composerHandleAssetPickerSelect,
        handleComposerMenuClick: composerHandleMenuClick,
        handleAttachmentSelection: composerHandleAttachmentSelection,
        handleComposerTypingChange: composerHandleTypingChange,
        disposeComposerScene: composerDispose,
    }),
}));

vi.mock("@/modules/chat-center/composables/useMessageWorkspaceAssetScene", () => ({
    useMessageWorkspaceAssetScene: () => ({
        assetPreviewOpen: ref(false),
        previewingAssetMessage: ref(null),
        groupInvitationModalOpen: ref(false),
        groupInvitationApplying: ref(false),
        saveAssetDialogOpen: ref(false),
        saveAssetLoading: ref(false),
        saveAssetSaving: ref(false),
        saveAssetCreateFolderOpen: ref(false),
        saveAssetFolderName: ref(""),
        saveAssetFolderEntries: ref([]),
        saveAssetBreadcrumbs: ref([{ id: null, name: "我的文件" }]),
        assetPreviewTitle: computed(() => "媒体预览"),
        activeGroupInvitation: computed(() => null),
        getAssetMessagePayload: () => null,
        getAssetDisplayName: () => "附件",
        isAssetMessage: () => false,
        canPreviewImage: () => false,
        canPreviewVideo: () => false,
        getVideoPosterUrl: () => "",
        getAssetPreviewBoxStyle: () => undefined,
        getAssetPreviewImageUrl: () => "",
        getAssetUploadProgress: () => 0,
        isAssetUploading: () => false,
        showVideoPlayOverlay: () => false,
        formatAssetFileSize: () => "大小未知",
        getGroupInvitationPayload: () => null,
        isChatRecordMessage: () => false,
        hasMessageBubbleAction: () => false,
        handleMessageBubbleClick: assetHandleMessageBubbleClick,
        triggerAssetDownload: assetTriggerDownload,
        toggleSaveAssetFolderInline: vi.fn(),
        openSaveAssetBreadcrumb: vi.fn(async () => undefined),
        enterSaveAssetFolder: vi.fn(async () => undefined),
        handleCreateSaveAssetFolder: vi.fn(async () => undefined),
        openSaveAssetDialog: assetOpenSaveDialog,
        confirmSaveAssetToResource: vi.fn(async () => undefined),
        handleApplyGroupInvitation: assetHandleApplyInvitation,
    }),
}));

vi.mock("@/modules/chat-center/composables/useMessageWorkspaceMessageMenuScene", () => ({
    useMessageWorkspaceMessageMenuScene: () => ({
        messageMenuOpen: ref(false),
        messageMenuMessage: ref(null),
        messageSelectionMode: ref(false),
        selectedMessageIds: ref<number[]>([]),
        quotedMessage: ref(null),
        messageMenuStyle: computed(() => ({ left: "0px", top: "0px" })),
        canRevokeMessage: () => false,
        canDeleteMessage: () => false,
        isMessageSelected: () => false,
        handleMessageRowClick: menuHandleRowClick,
        clearMessageSelection: menuClearSelection,
        closeMessageMenu: menuCloseMessageMenu,
        openMessageMenu: menuOpenMessageMenu,
        handleDocumentClick: menuHandleDocumentClick,
        handleRetryMessage: menuHandleRetryMessage,
        handleCopyMessage: menuHandleCopyMessage,
        handleForwardMessage: menuHandleForwardMessage,
        handleForwardSelection: menuHandleForwardSelection,
        handleQuoteMessage: menuHandleQuoteMessage,
        enableMessageSelection: menuEnableMessageSelection,
        handleMenuDownloadAssetMessage: menuHandleDownloadAssetMessage,
        handleMenuSaveAssetToResource: menuHandleSaveAssetToResource,
        handleRevokeMessage: menuHandleRevokeMessage,
        handleDeleteMessage: menuHandleDeleteMessage,
        handleRestoreRevokedMessage: menuHandleRestoreRevokedMessage,
    }),
}));

const ButtonStub = defineComponent({
    name: "AButton",
    emits: ["click"],
    setup(_, { emit, slots, attrs }) {
        return () =>
            h(
                "button",
                {
                    ...attrs,
                    onClick: (event: MouseEvent) => emit("click", event),
                },
                slots.default?.(),
            );
    },
});

const SimpleSlotStub = defineComponent({
    setup(_, { slots }) {
        return () => h("div", slots.default?.());
    },
});

const ConditionalOpenStub = defineComponent({
    props: { open: { type: Boolean, default: false } },
    setup(props, { slots }) {
        return () => (props.open ? h("div", slots.default?.()) : null);
    },
});

const messageWorkspaceComponentPromise = import(
    "@/views/Chat/components/MessageWorkspace.vue"
);

async function mountWorkspace() {
    const component = await messageWorkspaceComponentPromise;
    const wrapper = shallowMount(component.default, {
        global: {
            stubs: {
                Transition: false,
                "a-button": ButtonStub,
                "a-space": SimpleSlotStub,
                "a-avatar": SimpleSlotStub,
                "a-tooltip": SimpleSlotStub,
                "a-dropdown": SimpleSlotStub,
                "a-menu": SimpleSlotStub,
                "a-menu-item": SimpleSlotStub,
                "a-empty": SimpleSlotStub,
                "a-modal": ConditionalOpenStub,
                "a-drawer": ConditionalOpenStub,
                "a-upload": SimpleSlotStub,
                "a-input": SimpleSlotStub,
                "a-input-number": SimpleSlotStub,
                "a-switch": SimpleSlotStub,
                "a-tag": SimpleSlotStub,
                "a-table": SimpleSlotStub,
                "a-breadcrumb": SimpleSlotStub,
                "a-breadcrumb-item": SimpleSlotStub,
                MenuOutlined: true,
                ArrowUpOutlined: true,
                CaretRightFilled: true,
                FileOutlined: true,
                RightOutlined: true,
                PlusOutlined: true,
                EditOutlined: true,
            },
        },
    });
    return wrapper;
}

describe("MessageWorkspace scene boundaries", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = "";
        stealthAuditEnabled.value = false;
        activeMessage.content = "hello";
        activeMessage.payload = {};
    });

    it("delegates message bubble context menu to the message-menu scene", async () => {
        const wrapper = await mountWorkspace();

        await wrapper.find(".message-bubble").trigger("contextmenu", {
            clientX: 40,
            clientY: 50,
        });

        expect(menuOpenMessageMenu).toHaveBeenCalledTimes(1);
        const menuCall = menuOpenMessageMenu.mock.calls[0];
        expect(menuCall?.[1]).toMatchObject({ id: 101 });
    }, 60000);

    it("delegates message bubble click to the asset scene", async () => {
        const wrapper = await mountWorkspace();

        await wrapper.find(".message-bubble").trigger("click");

        expect(assetHandleMessageBubbleClick).toHaveBeenCalledWith(
            expect.objectContaining({ id: 101 }),
        );
    }, 30000);

    it("delegates composer submit and paste events to the composer scene", async () => {
        const wrapper = await mountWorkspace();
        const composer = wrapper.findComponent(ImportedRichMessageComposerStub);

        expect(composer.exists()).toBe(true);
        composer.vm.$emit("request-submit");
        composer.vm.$emit("paste-files", [new File(["x"], "demo.txt")]);
        await nextTick();
        await wrapper.find(".chat-main__composer-actions button").trigger("click");

        expect(composerHandleSendMessage).toHaveBeenCalledTimes(2);
        expect(composerHandlePasteFiles).toHaveBeenCalledTimes(1);
        const pasteCalls = composerHandlePasteFiles.mock.calls as unknown as Array<
            [File[]]
        >;
        const pastePayload = pasteCalls[0]?.[0];
        expect(pastePayload).toHaveLength(1);
    });

    it("shows deleted marker for stealth-audit messages", async () => {
        stealthAuditEnabled.value = true;
        activeMessage.payload = {
            deleted: {
                deleted_at: "2026-01-01T00:01:00Z",
            },
        };

        const wrapper = await mountWorkspace();

        expect(wrapper.text()).toContain("已删除");
        expect(wrapper.text()).toContain("hello");
    });

    it("avoids duplicate group bootstrap requests when current history is empty", async () => {
        chatStoreState.conversationState.activeConversationId = 24;
        chatStoreState.conversationState.activeConversation = {
            ...activeConversation,
            id: 24,
            type: "group",
            access_mode: "member",
            member_count: 3,
        };
        chatStoreState.conversationState.conversations = [
            chatStoreState.conversationState.activeConversation,
        ];
        chatStoreState.messageState.activeMessages = [];
        chatStoreState.groupState.activeMembers = [];

        await mountWorkspace();
        await Promise.resolve();
        await nextTick();

        expect(chatStore.message.loadMessages).toHaveBeenCalledTimes(1);
        expect(chatStore.group.loadMembers).not.toHaveBeenCalled();
    });
});