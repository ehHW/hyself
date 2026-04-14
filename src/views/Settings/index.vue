<template>
    <a-card>
        <div class="settings-page__toolbar">
            <span class="save-status" :class="`save-status--${saveStatus}`">{{
                saveStatusText
            }}</span>
        </div>
        <a-form layout="vertical" :model="formState">
            <a-divider orientation="left">基础设置</a-divider>
            <a-form-item label="系统标题">
                <a-input
                    v-model:value="formState.systemTitle"
                    placeholder="请输入系统标题"
                    @blur="handleSystemTitleBlur"
                    @press-enter="handleSystemTitleEnter"
                />
            </a-form-item>
            <a-alert
                message="主题切换已移动到页面顶部右侧工具区，可直接点击太阳/月亮图标切换。"
                type="info"
                show-icon
                style="margin-bottom: 16px"
            />

            <a-divider orientation="left">聊天偏好</a-divider>
            <a-form-item label="接收聊天通知">
                <a-switch
                    v-model:checked="formState.chatReceiveNotification"
                    checked-children="开启"
                    un-checked-children="关闭"
                    @change="handleChatReceiveNotificationChange"
                />
            </a-form-item>
            <a-form-item label="聊天列表排序">
                <a-segmented
                    v-model:value="formState.chatListSortMode"
                    :options="chatSortOptions"
                    @change="handleChatSortModeChange"
                />
            </a-form-item>
            <a-space>
                <a-button :loading="saving" @click="resetSettings"
                    >恢复默认</a-button
                >
            </a-space>
        </a-form>
    </a-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { message } from "ant-design-vue";
import { useSettingsStore } from "@/stores/settings";
import { getErrorMessage } from "@/utils/error";

const settingsStore = useSettingsStore();
const saving = ref(false);
const skipNextSystemTitleBlur = ref(false);
const saveStatus = ref<"idle" | "saving" | "saved" | "error">("idle");
let saveStatusTimer: ReturnType<typeof setTimeout> | null = null;

const formState = reactive({
    systemTitle: "",
    chatReceiveNotification: true,
    chatListSortMode: "recent" as "recent" | "unread",
});

const saveStatusText = computed(() => {
    if (saveStatus.value === "saving") {
        return "正在保存...";
    }
    if (saveStatus.value === "saved") {
        return "已保存";
    }
    if (saveStatus.value === "error") {
        return "保存失败";
    }
    return "自动保存";
});

const chatSortOptions = [
    { label: "按最近消息", value: "recent" },
    { label: "按未读优先", value: "unread" },
];

const syncFromStore = () => {
    formState.systemTitle = settingsStore.settings.systemTitle;
    formState.chatReceiveNotification =
        settingsStore.settings.chatReceiveNotification;
    formState.chatListSortMode = settingsStore.settings.chatListSortMode;
};

const normalizedSystemTitle = () =>
    formState.systemTitle.trim() || "Hyself 管理后台";

const markSaveStatus = (status: "idle" | "saving" | "saved" | "error") => {
    if (saveStatusTimer) {
        clearTimeout(saveStatusTimer);
        saveStatusTimer = null;
    }
    saveStatus.value = status;
    if (status === "saved") {
        saveStatusTimer = setTimeout(() => {
            saveStatus.value = "idle";
            saveStatusTimer = null;
        }, 1400);
    }
};

const saveLocalSettings = async () => {
    const nextSystemTitle = normalizedSystemTitle();
    if (nextSystemTitle === settingsStore.settings.systemTitle) {
        formState.systemTitle = nextSystemTitle;
        return;
    }
    markSaveStatus("saving");
    settingsStore.save({
        systemTitle: nextSystemTitle,
    });
    syncFromStore();
    markSaveStatus("saved");
};

const saveChatSettings = async () => {
    saving.value = true;
    markSaveStatus("saving");
    try {
        await settingsStore.saveChatPreferences({
            chatReceiveNotification: formState.chatReceiveNotification,
            chatListSortMode: formState.chatListSortMode,
        });
        syncFromStore();
        markSaveStatus("saved");
    } catch (error: unknown) {
        syncFromStore();
        markSaveStatus("error");
        message.error(getErrorMessage(error, "保存设置失败"));
    } finally {
        saving.value = false;
    }
};

const handleSystemTitleBlur = async () => {
    if (skipNextSystemTitleBlur.value) {
        skipNextSystemTitleBlur.value = false;
        return;
    }
    await saveLocalSettings();
};

const handleSystemTitleEnter = async (event: KeyboardEvent) => {
    event.preventDefault();
    skipNextSystemTitleBlur.value = true;
    (event.target as HTMLInputElement | null)?.blur();
    await saveLocalSettings();
};

const handleChatReceiveNotificationChange = async () => {
    await saveChatSettings();
};

const handleChatSortModeChange = async () => {
    await saveChatSettings();
};

const resetSettings = async () => {
    markSaveStatus("saving");
    const chatStealthInspectEnabled = settingsStore.chatStealthInspectEnabled;
    settingsStore.reset();
    settingsStore.save({ chatStealthInspectEnabled });
    syncFromStore();
    await saveChatSettings();
    await saveLocalSettings();
    markSaveStatus("saved");
};

onMounted(() => {
    syncFromStore();
    settingsStore
        .loadChatPreferences()
        .then(syncFromStore)
        .catch(() => undefined);
});

onBeforeUnmount(() => {
    if (saveStatusTimer) {
        clearTimeout(saveStatusTimer);
        saveStatusTimer = null;
    }
});
</script>

<style scoped>
.ant-card {
    min-height: 100%;
}

.settings-page__toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 8px;
}

.save-status {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 12px;
    line-height: 1;
    transition:
        color 0.18s ease,
        background-color 0.18s ease;
}

.save-status--idle {
    color: var(--text-secondary);
    background: rgba(148, 163, 184, 0.12);
}

.save-status--saving {
    color: #1677ff;
    background: rgba(22, 119, 255, 0.1);
}

.save-status--saved {
    color: #16a34a;
    background: rgba(22, 163, 74, 0.1);
}

.save-status--error {
    color: #dc2626;
    background: rgba(220, 38, 38, 0.1);
}
</style>
