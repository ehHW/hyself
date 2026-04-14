<template>
    <a-modal
        :open="open"
        title="选择资源中心文件"
        :footer="null"
        :width="CHAT_MODAL_WIDTH_LG"
        @cancel="handleCancel"
    >
        <a-alert
            type="info"
            show-icon
            style="margin-bottom: 12px"
            message="从资源中心发送附件"
            description="选择一个已有文件，直接发送到当前聊天会话；文件夹不能发送。"
        />

        <a-space
            style="
                margin-bottom: 12px;
                width: 100%;
                justify-content: space-between;
            "
            wrap
        >
            <a-breadcrumb>
                <a-breadcrumb-item
                    v-for="item in breadcrumbs"
                    :key="String(item.id ?? 'root')"
                >
                    <a @click="goToBreadcrumb(item.id)">{{ item.name }}</a>
                </a-breadcrumb-item>
            </a-breadcrumb>

            <a-button @click="refresh" :loading="loading">刷新</a-button>
        </a-space>

        <a-space style="margin-bottom: 12px; width: 100%" wrap>
            <a-auto-complete
                v-model:value="searchKeyword"
                placeholder="搜索文件名..."
                :options="searchOptions"
                :loading="searchLoading"
                style="width: 300px"
                @input="onSearchInput"
                @select="onSearchSelect"
            />
            <a-button
                type="primary"
                @click="doFullSearch"
                :loading="searchLoading"
                >搜索全部</a-button
            >
            <a-button @click="resetSearch" :loading="searchLoading"
                >重置</a-button
            >
        </a-space>

        <a-table
            :columns="columns"
            :data-source="tableData"
            row-key="id"
            :loading="loading || searchLoading"
            :pagination="{ pageSize: 10 }"
        >
            <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'name'">
                    <FileNameCell
                        :name="record.display_name"
                        :is-dir="record.is_dir"
                        :clickable="record.is_dir"
                        @click="enterFolder(record)"
                    />
                </template>
                <template v-else-if="column.key === 'path'">
                    <span class="search-path">{{ formatPath(record) }}</span>
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
                        <a v-if="canSelect(record)" @click="selectItem(record)"
                            >选择</a
                        >
                        <a
                            v-else-if="record.is_dir"
                            @click="enterFolder(record)"
                            >进入</a
                        >
                        <a
                            v-if="!record.is_dir && record.url"
                            :href="record.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            >查看</a
                        >
                    </a-space>
                </template>
            </template>
        </a-table>
    </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { getFileEntriesApi, searchFileEntriesApi } from "@/api/upload";
import type { FileEntryItem, SearchFileEntryItem } from "@/api/upload";
import FileNameCell from "@/components/common/FileNameCell.vue";
import { formatFileSize } from "@/utils/fileFormatter";
import { formatDateTime } from "@/utils/timeFormatter";
import { trimText } from "@/validators/common";

const props = defineProps<{
    open: boolean;
}>();

const emit = defineEmits<{
    "update:open": [value: boolean];
    select: [item: FileEntryItem | SearchFileEntryItem];
}>();

const entries = ref<FileEntryItem[]>([]);
const breadcrumbs = ref<Array<{ id: number | null; name: string }>>([
    { id: null, name: "我的文件" },
]);
const currentParentId = ref<number | null>(null);
const loading = ref(false);

const searchKeyword = ref("");
const suggestResults = ref<SearchFileEntryItem[]>([]);
const searchResults = ref<SearchFileEntryItem[]>([]);
const searchLoading = ref(false);
const isSearchMode = ref(false);
const CHAT_MODAL_WIDTH_LG = 720;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const columns = computed(() => {
    if (!isSearchMode.value) {
        return [
            {
                title: "名称",
                dataIndex: "display_name",
                key: "name",
                width: 320,
            },
            { title: "类型", key: "type", width: 120 },
            { title: "大小", key: "size", width: 120 },
            {
                title: "更新时间",
                dataIndex: "updated_at",
                key: "updated_at",
                width: 220,
            },
            { title: "操作", key: "actions", width: 140 },
        ];
    }
    return [
        { title: "名称", dataIndex: "display_name", key: "name", width: 260 },
        { title: "路径", key: "path", width: 320 },
        { title: "类型", key: "type", width: 120 },
        { title: "大小", key: "size", width: 120 },
        {
            title: "更新时间",
            dataIndex: "updated_at",
            key: "updated_at",
            width: 220,
        },
        { title: "操作", key: "actions", width: 140 },
    ];
});

const tableData = computed<Array<FileEntryItem | SearchFileEntryItem>>(() =>
    isSearchMode.value ? searchResults.value : entries.value,
);

const getNormalizedKeyword = () => {
    const raw =
        typeof searchKeyword.value === "string"
            ? searchKeyword.value
            : String(searchKeyword.value ?? "");
    return trimText(raw);
};

const searchOptions = computed(() => {
    if (!getNormalizedKeyword()) {
        return [];
    }
    return [
        {
            label: "搜索选项",
            options: suggestResults.value.slice(0, 5).map((item) => ({
                label: `${item.display_name} (${item.directory_path || "根目录"})`,
                value: item.display_name,
                fileId: item.id,
            })),
        },
    ];
});

const clearSearchState = () => {
    searchKeyword.value = "";
    suggestResults.value = [];
    searchResults.value = [];
    isSearchMode.value = false;
};

const loadEntries = async (parentId?: number | null) => {
    loading.value = true;
    try {
        const { data } = await getFileEntriesApi(parentId ?? null);
        entries.value = data.items;
        breadcrumbs.value = data.breadcrumbs;
        currentParentId.value = data.parent?.id ?? null;
    } finally {
        loading.value = false;
    }
};

const refresh = async () => {
    if (isSearchMode.value) {
        await doFullSearch();
        return;
    }
    await loadEntries(currentParentId.value);
};

const goToBreadcrumb = async (id: number | null) => {
    clearSearchState();
    await loadEntries(id);
};

const enterFolder = async (item: FileEntryItem | SearchFileEntryItem) => {
    if (!item.is_dir) {
        return;
    }
    clearSearchState();
    await loadEntries(item.id);
};

const performSearch = async () => {
    const keyword = getNormalizedKeyword();
    if (!keyword) {
        suggestResults.value = [];
        return;
    }
    searchLoading.value = true;
    try {
        const { data } = await searchFileEntriesApi(keyword, 50);
        suggestResults.value = data.items;
    } finally {
        searchLoading.value = false;
    }
};

const onSearchInput = () => {
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }
    if (!getNormalizedKeyword()) {
        suggestResults.value = [];
        return;
    }
    searchDebounceTimer = setTimeout(async () => {
        await performSearch();
    }, 500);
};

const navigateToFile = async (item: SearchFileEntryItem) => {
    if (item.is_dir) {
        await loadEntries(item.id);
    } else {
        await loadEntries(item.parent_id ?? null);
    }
    clearSearchState();
};

const onSearchSelect = async (value: string, option: { fileId?: number }) => {
    searchKeyword.value = value;
    const item =
        suggestResults.value.find((entry) => entry.id === option?.fileId) ||
        suggestResults.value.find((entry) => entry.display_name === value);
    if (item) {
        await navigateToFile(item);
    }
};

const doFullSearch = async () => {
    const keyword = getNormalizedKeyword();
    if (!keyword) {
        await resetSearch();
        return;
    }
    searchLoading.value = true;
    try {
        const { data } = await searchFileEntriesApi(keyword, 200);
        searchResults.value = data.items;
        isSearchMode.value = true;
        if (searchResults.value.length === 0) {
            message.info("没有找到匹配的文件");
        }
    } finally {
        searchLoading.value = false;
    }
};

const resetSearch = async () => {
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
    }
    clearSearchState();
    await loadEntries(currentParentId.value);
};

const formatPath = (item: SearchFileEntryItem) => item.full_path;

const canSelect = (item: FileEntryItem | SearchFileEntryItem) =>
    !item.is_dir && Boolean(item.asset_reference_id);

const selectItem = (item: FileEntryItem | SearchFileEntryItem) => {
    if (!canSelect(item)) {
        message.warning("该文件缺少资产引用，暂时无法发送");
        return;
    }
    emit("select", item);
    emit("update:open", false);
};

const handleCancel = () => {
    emit("update:open", false);
};

watch(
    () => props.open,
    (open) => {
        if (!open) {
            return;
        }
        clearSearchState();
        void loadEntries(null);
    },
    { immediate: true },
);
</script>
