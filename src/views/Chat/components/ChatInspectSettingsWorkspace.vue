<template>
    <section class="chat-workspace">
        <a-card :bordered="false" class="inspect-card">
            <div class="inspect-card__header">
                <div class="inspect-card__title">隐身巡检</div>
                <div class="inspect-card__desc">
                    开启后，可直接在聊天室主界面搜索全局会话，并查看已删除、已撤回消息。
                </div>
            </div>

            <a-form layout="vertical">
                <a-form-item label="隐身巡检模式">
                    <a-switch
                        :checked="settingsStore.chatStealthInspectEnabled"
                        checked-children="开启"
                        un-checked-children="关闭"
                        @change="handleInspectChange"
                    />
                </a-form-item>
            </a-form>
        </a-card>
    </section>
</template>

<script setup lang="ts">
import { message } from "ant-design-vue";
import { useRoute } from "vue-router";
import { getErrorMessage } from "@/utils/error";
import { emitAppRefresh } from "@/utils/appRefresh";
import { useChatShell } from "@/views/Chat/useChatShell";

const { settingsStore } = useChatShell();
const route = useRoute();

const handleInspectChange = async (checked: boolean) => {
    try {
        await settingsStore.saveChatPreferences({
            chatStealthInspectEnabled: checked,
        });
        await emitAppRefresh({
            source: "chat-inspect-settings",
            routePath: route.path,
        });
        message.success(checked ? "已开启隐身巡检" : "已关闭隐身巡检");
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "保存巡检设置失败"));
    }
};
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

.inspect-card {
    background: var(--chat-panel-bg-strong);
}

.inspect-card__header {
    margin-bottom: 18px;
}

.inspect-card__title {
    font-size: 20px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.inspect-card__desc {
    margin-top: 8px;
    color: var(--chat-text-secondary);
    line-height: 1.7;
}
</style>
