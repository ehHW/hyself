<template>
    <a-card>
        <a-space
            style="
                margin-bottom: 12px;
                width: 100%;
                justify-content: space-between;
            "
        >
            <a-space>
                <a-input
                    v-model:value="keyword"
                    placeholder="按权限编码/名称/描述搜索"
                    style="width: 280px"
                    allow-clear
                    @press-enter="onSearch"
                />
                <a-button @click="onSearch">搜索</a-button>
                <a-button @click="onReset">重置</a-button>
            </a-space>
            <a-space>
                <a-button
                    v-if="canCreatePermission"
                    type="primary"
                    @click="openCreate"
                    >新增权限</a-button
                >
            </a-space>
        </a-space>

        <a-table
            :columns="columns"
            :data-source="permissions"
            :loading="loading"
            row-key="id"
            :pagination="pagination"
            :scroll="{ x: 860, y: 500 }"
            @change="handleTableChange"
        >
            <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'action'">
                    <a-space>
                        <a-button
                            v-if="canUpdatePermission"
                            size="small"
                            @click="openEdit(record)"
                            >编辑</a-button
                        >
                        <a-popconfirm
                            v-if="canDeletePermission"
                            title="确认删除该权限？"
                            @confirm="onDelete(record.id)"
                        >
                            <a-button size="small" danger>删除</a-button>
                        </a-popconfirm>
                    </a-space>
                </template>
            </template>
        </a-table>
    </a-card>

    <a-modal
        v-model:open="modalOpen"
        :title="editId ? '编辑权限' : '新增权限'"
        @ok="submit"
        :confirm-loading="saving"
    >
        <a-form layout="vertical" :model="formState">
            <a-form-item label="权限编码">
                <a-input
                    v-model:value="formState.code"
                    placeholder="例如: user.view_user"
                />
            </a-form-item>
            <a-form-item label="权限名称">
                <a-input v-model:value="formState.name" />
            </a-form-item>
            <a-form-item label="描述">
                <a-input v-model:value="formState.description" />
            </a-form-item>
        </a-form>
    </a-modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { message } from "ant-design-vue";
import type { TablePaginationConfig } from "ant-design-vue";
import {
    createPermissionApi,
    deletePermissionApi,
    getPermissionsApi,
    updatePermissionApi,
} from "@/api/user";
import { useUserStore } from "@/stores/user";
import { subscribeAppRefresh } from "@/utils/appRefresh";
import type { PermissionItem } from "@/types/user";
import { getErrorMessage } from "@/utils/error";

const userStore = useUserStore();
const loading = ref(false);
const saving = ref(false);
const modalOpen = ref(false);
const editId = ref<number | null>(null);
const permissions = ref<PermissionItem[]>([]);
const keyword = ref("");

const pagination = reactive<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showTotal: (total) => `共 ${total} 条`,
});

const formState = reactive({
    code: "",
    name: "",
    description: "",
});

const canCreatePermission = computed(() =>
    userStore.hasPermission("user.create_permission"),
);
const canUpdatePermission = computed(() =>
    userStore.hasPermission("user.update_permission"),
);
const canDeletePermission = computed(() =>
    userStore.hasPermission("user.delete_permission"),
);
const showActionColumn = computed(
    () => canUpdatePermission.value || canDeletePermission.value,
);
const columns = computed(() => {
    const result: Array<{
        title: string;
        dataIndex?: string;
        key?: string;
        width?: number;
        fixed?: "left" | "right";
    }> = [
        { title: "ID", dataIndex: "id", width: 80, fixed: "left" as const },
        { title: "权限编码", dataIndex: "code", width: 220 },
        { title: "权限名称", dataIndex: "name", width: 180 },
        { title: "描述", dataIndex: "description", width: 240 },
    ];

    if (showActionColumn.value) {
        result.push({
            title: "操作",
            key: "action",
            fixed: "right" as const,
            width: 140,
        });
    }

    return result;
});

let unsubscribeAppRefresh: (() => void) | null = null;

const loadData = async () => {
    loading.value = true;
    try {
        const { data } = await getPermissionsApi({
            page: pagination.current,
            page_size: pagination.pageSize,
            keyword: keyword.value.trim() || undefined,
        });
        permissions.value = data.results;
        pagination.total = data.count;
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "加载权限数据失败"));
    } finally {
        loading.value = false;
    }
};

const onSearch = async () => {
    pagination.current = 1;
    await loadData();
};

const onReset = async () => {
    keyword.value = "";
    pagination.current = 1;
    await loadData();
};

const handleTableChange = async (pager: TablePaginationConfig) => {
    pagination.current = pager.current || 1;
    pagination.pageSize = pager.pageSize || 10;
    await loadData();
};

const resetForm = () => {
    formState.code = "";
    formState.name = "";
    formState.description = "";
};

const openCreate = () => {
    resetForm();
    editId.value = null;
    modalOpen.value = true;
};

const openEdit = (row: PermissionItem) => {
    formState.code = row.code;
    formState.name = row.name;
    formState.description = row.description;
    editId.value = row.id;
    modalOpen.value = true;
};

const submit = async () => {
    if (!formState.code.trim() || !formState.name.trim()) {
        message.warning("权限编码和权限名称不能为空");
        return;
    }

    saving.value = true;
    try {
        if (editId.value) {
            await updatePermissionApi(editId.value, {
                code: formState.code.trim(),
                name: formState.name.trim(),
                description: formState.description,
            });
            message.success("权限更新成功");
        } else {
            await createPermissionApi({
                code: formState.code.trim(),
                name: formState.name.trim(),
                description: formState.description,
            });
            message.success("权限创建成功");
        }
        modalOpen.value = false;
        await loadData();
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "保存失败"));
    } finally {
        saving.value = false;
    }
};

const onDelete = async (id: number) => {
    try {
        await deletePermissionApi(id);
        message.success("删除成功");
        await loadData();
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "删除失败"));
    }
};

onMounted(async () => {
    unsubscribeAppRefresh = subscribeAppRefresh(async () => {
        await loadData();
    });
    try {
        await loadData();
    } catch {
        // loadData already handles error messaging
    }
});

onBeforeUnmount(() => {
    unsubscribeAppRefresh?.();
    unsubscribeAppRefresh = null;
});
</script>

<style scoped>
.ant-card {
    height: 100%;
}

:deep(.ant-card-body) {
    height: 100%;
    overflow: hidden;
}
</style>
