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
                    placeholder="按角色名/描述/权限搜索"
                    style="width: 260px"
                    allow-clear
                    @press-enter="onSearch"
                />
                <a-button @click="onSearch">搜索</a-button>
                <a-button @click="onReset">重置</a-button>
            </a-space>
            <a-space>
                <a-button
                    v-if="canCreateRole"
                    type="primary"
                    @click="openCreate"
                    >新增角色</a-button
                >
            </a-space>
        </a-space>

        <a-table
            :columns="columns"
            :data-source="roles"
            :loading="loading"
            row-key="id"
            :pagination="pagination"
            :scroll="{ x: 960, y: 500 }"
            @change="handleTableChange"
        >
            <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'action'">
                    <a-space>
                        <a-button
                            v-if="!isSuperAdminRole(record) && canUpdateRole"
                            size="small"
                            @click="openEdit(record)"
                            >编辑</a-button
                        >
                        <a-popconfirm
                            v-if="!isSuperAdminRole(record) && canDeleteRole"
                            title="确认删除该角色？"
                            @confirm="onDelete(record.id)"
                        >
                            <a-button size="small" danger>删除</a-button>
                        </a-popconfirm>
                        <a-tag v-if="isSuperAdminRole(record)" color="gold"
                            >系统内置</a-tag
                        >
                    </a-space>
                </template>
            </template>
        </a-table>
    </a-card>

    <a-drawer
        v-model:open="drawerOpen"
        :title="editId ? '编辑角色' : '新增角色'"
        placement="right"
        :width="520"
        :destroy-on-close="false"
        @close="handleDrawerClose"
    >
        <a-form layout="vertical" :model="formState">
            <a-form-item label="角色名">
                <a-input v-model:value="formState.name" />
            </a-form-item>
            <a-form-item label="描述">
                <a-input v-model:value="formState.description" />
            </a-form-item>
            <a-form-item label="权限树">
                <a-input
                    v-model:value="permissionFilterKeyword"
                    allow-clear
                    placeholder="搜索权限编码或名称"
                    style="margin-bottom: 12px"
                />
                <div class="role-tree-panel">
                    <a-tree
                        checkable
                        block-node
                        :tree-data="permissionTreeData"
                        :checked-keys="checkedPermissionKeys"
                        :expanded-keys="expandedPermissionKeys"
                        @check="handlePermissionCheck"
                        @expand="handlePermissionExpand"
                    />
                </div>
            </a-form-item>
        </a-form>
        <template #footer>
            <div class="role-drawer__footer">
                <a-space>
                    <a-button @click="handleDrawerClose">取消</a-button>
                    <a-button type="primary" :loading="saving" @click="submit"
                        >保存</a-button
                    >
                </a-space>
            </div>
        </template>
    </a-drawer>
</template>

<script setup lang="ts">
import {
    computed,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
} from "vue";
import { message } from "ant-design-vue";
import type { TablePaginationConfig } from "ant-design-vue";
import {
    createRoleApi,
    deleteRoleApi,
    getPermissionsApi,
    getRolesApi,
    updateRoleApi,
} from "@/api/user";
import { useUserStore } from "@/stores/user";
import { subscribeAppRefresh } from "@/utils/appRefresh";
import type { PermissionItem, RoleItem } from "@/types/user";
import { getErrorMessage } from "@/utils/error";

type PermissionTreeNode = {
    key: string;
    title: string;
    children?: PermissionTreeNode[];
    selectable?: boolean;
    disableCheckbox?: boolean;
};

const userStore = useUserStore();
const loading = ref(false);
const saving = ref(false);
const drawerOpen = ref(false);
const editId = ref<number | null>(null);
const keyword = ref("");
const permissionFilterKeyword = ref("");
const expandedPermissionKeys = ref<string[]>([]);

const roles = ref<RoleItem[]>([]);
const permissions = ref<PermissionItem[]>([]);
const SUPER_ADMIN_ROLE_NAME = "超级管理员";

const pagination = reactive<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showTotal: (total) => `共 ${total} 条`,
});

const formState = reactive({
    name: "",
    description: "",
    permission_ids: [] as number[],
});

const canCreateRole = computed(() =>
    userStore.hasPermission("user.create_role"),
);
const canUpdateRole = computed(() =>
    userStore.hasPermission("user.update_role"),
);
const canDeleteRole = computed(() =>
    userStore.hasPermission("user.delete_role"),
);
const showActionColumn = computed(
    () => canUpdateRole.value || canDeleteRole.value,
);
const isSuperAdminRole = (role: RoleItem) =>
    role.name === SUPER_ADMIN_ROLE_NAME;
const checkedPermissionKeys = computed(() =>
    formState.permission_ids.map((id) => String(id)),
);
const columns = computed(() => {
    const result: Array<{
        title: string;
        dataIndex?: string;
        key?: string;
        width?: number;
        fixed?: "left" | "right";
        customRender?: (...args: any[]) => unknown;
    }> = [
        { title: "ID", dataIndex: "id", width: 80, fixed: "left" as const },
        { title: "角色名", dataIndex: "name", width: 160 },
        { title: "描述", dataIndex: "description", width: 220 },
        {
            title: "权限",
            width: 360,
            customRender: ({ record }: { record: RoleItem }) =>
                record.permissions.map((item) => item.name).join(", ") || "-",
        },
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

const buildPermissionTree = (items: PermissionItem[]) => {
    const keywordValue = permissionFilterKeyword.value.trim().toLowerCase();
    const groups = new Map<string, PermissionItem[]>();
    for (const item of items) {
        const resourceKey = item.code.split(".")[0] || "other";
        const bucket = groups.get(resourceKey) || [];
        bucket.push(item);
        groups.set(resourceKey, bucket);
    }

    const nodes: PermissionTreeNode[] = [];
    for (const [resourceKey, groupItems] of Array.from(groups.entries()).sort(
        (left, right) => left[0].localeCompare(right[0]),
    )) {
        const children = groupItems
            .filter((item) => {
                if (!keywordValue) return true;
                const haystack =
                    `${item.code} ${item.name} ${item.description || ""}`.toLowerCase();
                return haystack.includes(keywordValue);
            })
            .sort((left, right) => left.code.localeCompare(right.code))
            .map((item) => ({
                key: String(item.id),
                title: `${item.name} (${item.code})`,
            }));
        if (!children.length) {
            continue;
        }
        nodes.push({
            key: `group:${resourceKey}`,
            title: resourceKey,
            children,
        });
    }
    return nodes;
};

const permissionTreeData = computed(() =>
    buildPermissionTree(permissions.value),
);

const syncExpandedPermissionKeys = (forceExpandAll: boolean = false) => {
    const nextKeys = permissionTreeData.value.map((item) => item.key);
    if (forceExpandAll || !expandedPermissionKeys.value.length) {
        expandedPermissionKeys.value = nextKeys;
        return;
    }
    const allowed = new Set(nextKeys);
    expandedPermissionKeys.value = expandedPermissionKeys.value.filter((key) =>
        allowed.has(key),
    );
};

const loadData = async () => {
    loading.value = true;
    try {
        const [rolesRes, permsRes] = await Promise.all([
            getRolesApi({
                page: pagination.current,
                page_size: pagination.pageSize,
                keyword: keyword.value.trim() || undefined,
            }),
            getPermissionsApi({ page: 1, page_size: 500 }),
        ]);
        roles.value = rolesRes.data.results;
        pagination.total = rolesRes.data.count;
        permissions.value = permsRes.data.results;
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "加载角色数据失败"));
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
    formState.name = "";
    formState.description = "";
    formState.permission_ids = [];
};

const openCreate = () => {
    resetForm();
    editId.value = null;
    syncExpandedPermissionKeys(true);
    drawerOpen.value = true;
};

const openEdit = (row: RoleItem) => {
    formState.name = row.name;
    formState.description = row.description;
    formState.permission_ids = row.permissions.map((item) => item.id);
    editId.value = row.id;
    syncExpandedPermissionKeys(true);
    drawerOpen.value = true;
};

const handleDrawerClose = () => {
    drawerOpen.value = false;
    permissionFilterKeyword.value = "";
    syncExpandedPermissionKeys(true);
};

const handlePermissionCheck = (
    checkedKeys: string[] | { checked: string[]; halfChecked: string[] },
) => {
    const keys = Array.isArray(checkedKeys) ? checkedKeys : checkedKeys.checked;
    formState.permission_ids = keys
        .filter((key) => !String(key).startsWith("group:"))
        .map((key) => Number(key))
        .filter((value) => Number.isFinite(value));
};

const handlePermissionExpand = (keys: string[]) => {
    expandedPermissionKeys.value = keys;
};

const submit = async () => {
    if (!formState.name.trim()) {
        message.warning("角色名不能为空");
        return;
    }

    saving.value = true;
    try {
        if (editId.value) {
            await updateRoleApi(editId.value, {
                name: formState.name.trim(),
                description: formState.description,
                permission_ids: formState.permission_ids,
            });
            message.success("角色更新成功");
        } else {
            await createRoleApi({
                name: formState.name.trim(),
                description: formState.description,
                permission_ids: formState.permission_ids,
            });
            message.success("角色创建成功");
        }
        handleDrawerClose();
        await loadData();
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "保存失败"));
    } finally {
        saving.value = false;
    }
};

const onDelete = async (id: number) => {
    try {
        await deleteRoleApi(id);
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
        syncExpandedPermissionKeys(true);
    } catch {
        // loadData already handles error messaging
    }
});

watch(permissionTreeData, () => {
    syncExpandedPermissionKeys(Boolean(permissionFilterKeyword.value.trim()));
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

.role-tree-panel {
    max-height: calc(100vh - 320px);
    overflow: auto;
    padding: 8px 12px;
    border: 1px solid var(--border-color, rgba(148, 163, 184, 0.24));
    border-radius: 10px;
    background: color-mix(in srgb, var(--surface-header) 92%, transparent);
}

.role-drawer__footer {
    display: flex;
    justify-content: flex-end;
}
</style>
