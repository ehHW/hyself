<template>
    <a-alert
        v-if="scene.banner"
        :type="scene.banner.type || 'info'"
        :show-icon="scene.banner.showIcon ?? true"
        style="margin-bottom: 12px"
        :message="scene.banner.message"
        :description="scene.banner.description"
    />

    <a-space
        style="margin-bottom: 12px; width: 100%; justify-content: space-between"
        wrap
    >
        <a-breadcrumb>
            <a-breadcrumb-item
                v-for="item in breadcrumbs"
                :key="String(item.id ?? 'root')"
            >
                <a @click="onGoToBreadcrumb(item)">{{ item.name }}</a>
            </a-breadcrumb-item>
        </a-breadcrumb>

        <a-button
            v-if="scene.showRefresh"
            @click="onRefresh"
            :loading="loading"
            >{{ scene.text.refreshButtonText }}</a-button
        >
    </a-space>

    <a-space
        v-if="scene.showSearch"
        style="margin-bottom: 12px; width: 100%"
        wrap
    >
        <a-auto-complete
            :value="searchKeyword"
            :placeholder="scene.text.searchPlaceholder"
            :options="searchOptions"
            :loading="searchLoading"
            style="width: 300px"
            @update:value="handleSearchKeywordChange"
            @select="handleSearchSelect"
        />
        <a-button
            type="primary"
            @click="onFullSearch"
            :loading="searchLoading"
            >{{ scene.text.searchButtonText }}</a-button
        >
        <a-button @click="onResetSearch" :loading="searchLoading">{{
            scene.text.resetButtonText
        }}</a-button>
    </a-space>

    <a-table
        :columns="columns"
        :data-source="tableData"
        row-key="id"
        :loading="loading || searchLoading"
        :pagination="{ pageSize: scene.pageSize }"
    >
        <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
                <FileNameCell
                    :name="record.display_name"
                    :is-dir="record.is_dir"
                    :clickable="record.is_dir"
                    @click="onEnterFolder(record)"
                />
            </template>
            <template v-else-if="column.key === 'path'">
                <span class="search-path">{{ formatPath(record) }}</span>
            </template>
            <template v-else-if="column.key === 'owner'">
                <span>{{ record.owner_name || "-" }}</span>
            </template>
            <template v-else-if="column.key === 'size'">
                <span>{{
                    record.is_dir ? "-" : formatFileSize(record.file_size)
                }}</span>
            </template>
            <template v-else-if="column.key === 'type'">
                <a-tag :color="record.is_dir ? 'blue' : 'green'">
                    {{ record.is_dir ? "文件夹" : "文件" }}
                </a-tag>
            </template>
            <template v-else-if="column.key === 'updated_at'">
                <span>{{ formatDateTime(record.updated_at) }}</span>
            </template>
            <template v-else-if="column.key === 'actions'">
                <a-space>
                    <a v-if="canSelect(record)" @click="onSelectItem(record)">{{
                        scene.text.selectActionText
                    }}</a>
                    <a
                        v-else-if="record.is_dir"
                        @click="onEnterFolder(record)"
                        >{{ scene.text.enterActionText }}</a
                    >
                    <a
                        v-if="!record.is_dir && record.url"
                        :href="record.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        >{{ scene.text.previewActionText }}</a
                    >
                </a-space>
            </template>
        </template>
    </a-table>
</template>

<script setup lang="ts">
import type { FileEntryItem, SearchFileEntryItem } from "@/api/upload";
import type { ResolvedAssetPickerWorkspaceScene } from "@/components/assets/assetPickerScenes";
import FileNameCell from "@/components/common/FileNameCell.vue";
import { formatFileSize } from "@/utils/fileFormatter";
import { formatDateTime } from "@/utils/timeFormatter";

type AssetPickerEntry = FileEntryItem | SearchFileEntryItem;

const props = defineProps<{
    breadcrumbs: Array<{
        id: number | null;
        name: string;
        owner_user_id?: number | null;
        virtual_path?: string | null;
    }>;
    columns: Array<Record<string, unknown>>;
    loading: boolean;
    scene: ResolvedAssetPickerWorkspaceScene;
    searchKeyword: string;
    searchLoading: boolean;
    searchOptions: Array<Record<string, unknown>>;
    tableData: AssetPickerEntry[];
    canSelect: (item: AssetPickerEntry) => boolean;
    formatPath: (item: SearchFileEntryItem) => string;
    onEnterFolder: (item: AssetPickerEntry) => void | Promise<void>;
    onFullSearch: () => void | Promise<void>;
    onGoToBreadcrumb: (item: {
        id: number | null;
        name: string;
        owner_user_id?: number | null;
        virtual_path?: string | null;
    }) => void | Promise<void>;
    onRefresh: () => void | Promise<void>;
    onResetSearch: () => void | Promise<void>;
    onSearchInput: () => void;
    onSearchSelect: (
        value: string,
        option: { fileId?: number },
    ) => void | Promise<void>;
    onSelectItem: (item: AssetPickerEntry) => void;
}>();

const emit = defineEmits<{
    "update:searchKeyword": [value: string];
}>();

const handleSearchKeywordChange = (value: string) => {
    emit("update:searchKeyword", value);
    props.onSearchInput();
};

const handleSearchSelect = async (
    value: string,
    option: { fileId?: number },
) => {
    emit("update:searchKeyword", value);
    await props.onSearchSelect(value, option);
};
</script>
