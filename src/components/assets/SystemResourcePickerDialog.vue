<template>
    <AssetPickerDialog
        :open="open"
        :parent-id="parentId"
        :owner-user-id="ownerUserId"
        :scene="resolvedScene"
        scope="system"
        :virtual-path="virtualPath"
        @update:open="(value) => emit('update:open', value)"
        @select="(selection) => emit('select', selection)"
    />
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AssetPickerSelection } from "@/components/assets/assetPickerAdapter";
import AssetPickerDialog from "@/components/assets/AssetPickerDialog.vue";
import {
    SYSTEM_RESOURCE_ASSET_PICKER_DIALOG_SCENE,
    resolveAssetPickerDialogScene,
    type AssetPickerDialogSceneInput,
} from "@/components/assets/assetPickerScenes";

const props = defineProps<{
    open: boolean;
    parentId?: number | null;
    ownerUserId?: number | null;
    scene?: AssetPickerDialogSceneInput;
    virtualPath?: string | null;
}>();

const emit = defineEmits<{
    "update:open": [value: boolean];
    select: [selection: AssetPickerSelection];
}>();

const resolvedScene = computed(() =>
    resolveAssetPickerDialogScene(
        props.scene,
        SYSTEM_RESOURCE_ASSET_PICKER_DIALOG_SCENE,
    ),
);
</script>
