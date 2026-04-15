<template>
    <a-modal
        :open="open"
        :title="dialogScene.title"
        :footer="null"
        :width="dialogScene.width"
        @cancel="handleCancel"
    >
        <AssetPickerWorkspace
            v-model:search-keyword="searchKeyword"
            :breadcrumbs="breadcrumbs"
            :columns="columns"
            :loading="loading"
            :scene="dialogScene.workspace"
            :search-loading="searchLoading"
            :search-options="searchOptions"
            :table-data="tableData"
            :can-select="canSelect"
            :format-path="formatPath"
            :on-enter-folder="enterFolder"
            :on-full-search="doFullSearch"
            :on-go-to-breadcrumb="goToBreadcrumb"
            :on-refresh="refresh"
            :on-reset-search="resetSearch"
            :on-search-input="onSearchInput"
            :on-search-select="onSearchSelect"
            :on-select-item="selectItem"
        />
    </a-modal>
</template>

<script setup lang="ts">
import { computed, toRef } from "vue";
import type {
    FileEntryItem,
    FileManageScope,
    SearchFileEntryItem,
} from "@/api/upload";
import AssetPickerWorkspace from "@/components/assets/AssetPickerWorkspace.vue";
import {
    CHAT_ATTACHMENT_ASSET_PICKER_SCENE,
    resolveAssetPickerDialogScene,
    type AssetPickerDialogSceneInput,
} from "@/components/assets/assetPickerScenes";
import { useAssetPickerScene } from "@/components/assets/useAssetPickerScene";
import type { AssetPickerSelection } from "@/components/assets/assetPickerAdapter";

const props = defineProps<{
    open: boolean;
    scope?: FileManageScope;
    parentId?: number | null;
    ownerUserId?: number | null;
    scene?: AssetPickerDialogSceneInput;
    virtualPath?: string | null;
}>();

const emit = defineEmits<{
    "update:open": [value: boolean];
    select: [item: AssetPickerSelection];
}>();

const dialogScene = computed(() =>
    resolveAssetPickerDialogScene(
        props.scene,
        CHAT_ATTACHMENT_ASSET_PICKER_SCENE,
    ),
);
const {
    breadcrumbs,
    canSelect,
    columns,
    enterFolder,
    formatPath,
    goToBreadcrumb,
    loading,
    onSearchInput,
    onSearchSelect,
    pickItem,
    refresh,
    resetSearch,
    doFullSearch,
    searchKeyword,
    searchLoading,
    searchOptions,
    tableData,
} = useAssetPickerScene({
    enabled: toRef(props, "open"),
    allowedKinds: computed(
        () => dialogScene.value.workspace.picker.allowedKinds,
    ),
    ownerUserId: computed(() => props.ownerUserId ?? null),
    parentId: computed(() => props.parentId ?? null),
    selectionMode: computed(
        () => dialogScene.value.workspace.picker.selectionMode,
    ),
    scope: computed(() => props.scope ?? "user"),
    text: computed(() => dialogScene.value.workspace.text),
    virtualPath: computed(() => props.virtualPath ?? null),
});

const selectItem = (item: FileEntryItem | SearchFileEntryItem) => {
    const selection = pickItem(item);
    if (!selection) {
        return;
    }
    emit("select", selection);
    emit("update:open", false);
};

const handleCancel = () => {
    emit("update:open", false);
};
</script>
