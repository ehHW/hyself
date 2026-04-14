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
                    placeholder="按用户名/昵称/邮箱/电话搜索"
                    style="width: 280px"
                    allow-clear
                    @press-enter="onSearch"
                />
                <a-range-picker
                    v-model:value="createdAtRange"
                    show-time
                    value-format="YYYY-MM-DD HH:mm:ss"
                    :placeholder="['创建开始时间', '创建结束时间']"
                />
                <a-button @click="onSearch">搜索</a-button>
                <a-button @click="onReset">重置</a-button>
            </a-space>
            <a-space>
                <a-button
                    v-if="canCreateUser"
                    type="primary"
                    @click="openCreate"
                    >新增用户</a-button
                >
            </a-space>
        </a-space>

        <a-table
            :columns="columns"
            :data-source="users"
            :loading="loading"
            row-key="id"
            :pagination="pagination"
            :scroll="{ x: USER_TABLE_SCROLL_X, y: 500 }"
            table-layout="fixed"
            @change="handleTableChange"
        >
            <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'avatar'">
                    <a-avatar :size="36" :src="record.avatar || undefined">
                        {{
                            (
                                record.display_name ||
                                record.username ||
                                "?"
                            ).slice(0, 1)
                        }}
                    </a-avatar>
                </template>
                <template v-else-if="column.key === 'action'">
                    <a-space>
                        <a-button
                            v-if="!isSuperAdminUser(record) && canUpdateUser"
                            size="small"
                            @click="openEdit(record)"
                            >编辑</a-button
                        >
                        <a-popconfirm
                            v-if="!isSuperAdminUser(record) && canDeleteUser"
                            title="确认删除该用户？"
                            @confirm="onDelete(record.id)"
                        >
                            <a-button size="small" danger>删除</a-button>
                        </a-popconfirm>
                        <a-tag v-if="isSuperAdminUser(record)" color="gold"
                            >超级管理员</a-tag
                        >
                    </a-space>
                </template>
                <template v-else-if="column.key === 'status'">
                    <a-switch
                        v-if="canUpdateUser"
                        :checked="record.is_active"
                        :disabled="isSuperAdminUser(record) || !canUpdateUser"
                        :loading="Boolean(statusUpdatingMap[record.id])"
                        checked-children="启用"
                        un-checked-children="停用"
                        @change="
                            (checked: boolean) =>
                                onToggleStatus(record, checked)
                        "
                    />
                    <a-tag
                        v-else
                        :color="record.is_active ? 'green' : 'default'"
                    >
                        {{ record.is_active ? "启用" : "停用" }}
                    </a-tag>
                </template>
            </template>
        </a-table>
    </a-card>

    <a-modal
        v-model:open="userModalOpen"
        :title="isEdit ? '编辑用户' : '新增用户'"
        :confirm-loading="saving"
        :width="640"
        :style="{ top: '24px' }"
        :body-style="{
            maxHeight: 'calc(100vh - 220px)',
            overflowY: 'auto',
            paddingRight: '8px',
        }"
        @ok="submitUser"
    >
        <a-form layout="vertical" :model="userForm">
            <a-form-item label="用户名">
                <a-input v-model:value="userForm.username" :disabled="isEdit" />
            </a-form-item>
            <a-form-item label="密码" v-if="!isEdit">
                <a-input-password v-model:value="userForm.password" />
            </a-form-item>
            <a-form-item label="确认密码" v-if="!isEdit">
                <a-input-password v-model:value="userForm.confirm_password" />
            </a-form-item>
            <a-form-item label="昵称">
                <a-input v-model:value="userForm.display_name" />
            </a-form-item>
            <a-form-item label="头像">
                <a-space direction="vertical" style="width: 100%">
                    <a-space>
                        <a-upload
                            :before-upload="handleAvatarUpload"
                            :show-upload-list="false"
                            accept="image/*"
                        >
                            <a-button :loading="avatarUploading"
                                >上传头像</a-button
                            >
                        </a-upload>
                    </a-space>
                    <a-avatar :size="72" :src="userForm.avatar || undefined">
                        {{ avatarPreviewText }}
                    </a-avatar>
                </a-space>
            </a-form-item>
            <a-form-item label="电话号码">
                <a-input v-model:value="userForm.phone_number" />
            </a-form-item>
            <a-form-item label="邮箱">
                <a-input v-model:value="userForm.email" />
            </a-form-item>
            <a-form-item label="分配角色">
                <a-select
                    mode="multiple"
                    v-model:value="userForm.role_ids"
                    :options="roleOptions"
                    placeholder="请选择角色"
                />
            </a-form-item>
            <a-form-item label="启用状态">
                <a-switch v-model:checked="userForm.is_active" />
            </a-form-item>
        </a-form>
    </a-modal>

    <AvatarCropModal
        :open="avatarCropOpen"
        :image-url="avatarCropImageUrl"
        :confirm-loading="avatarUploading"
        @cancel="handleAvatarCropCancel"
        @confirm="handleAvatarCropConfirm"
    />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { Modal, message } from "ant-design-vue";
import type { TablePaginationConfig, UploadProps } from "ant-design-vue";
import AvatarCropModal from "@/components/AvatarCropModal.vue";
import {
    createUserApi,
    deleteUserApi,
    getRolesApi,
    getUsersApi,
    kickoutUserApi,
    updateUserApi,
} from "@/api/user";
import { useAuthStore } from "@/stores/auth";
import { useUserStore } from "@/stores/user";
import { subscribeAppRefresh } from "@/utils/appRefresh";
import { getErrorMessage } from "@/utils/error";
import { uploadFileWithCategory } from "@/utils/fileUploader";
import { formatDateTime } from "@/utils/timeFormatter";
import {
    isValidEmail,
    isValidPhoneNumber,
    trimText,
    validateAvatarFile,
} from "@/validators/common";
import type { UserItem } from "@/types/user";

const authStore = useAuthStore();
const userStore = useUserStore();
const loading = ref(false);
const saving = ref(false);
const avatarUploading = ref(false);
const avatarCropOpen = ref(false);
const avatarCropImageUrl = ref("");
let avatarTempObjectUrl = "";
const users = ref<UserItem[]>([]);
const statusUpdatingMap = reactive<Record<number, boolean>>({});
const keyword = ref("");
const createdAtRange = ref<[string, string] | []>([]);

const pagination = reactive<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showTotal: (total) => `共 ${total} 条`,
});

const userModalOpen = ref(false);
const isEdit = ref(false);
const editId = ref<number | null>(null);

const userForm = reactive({
    username: "",
    password: "",
    confirm_password: "",
    display_name: "",
    avatar: "",
    phone_number: "",
    email: "",
    role_ids: [] as number[],
    is_active: true,
});

const roleOptions = ref<{ label: string; value: number }[]>([]);
const SUPER_ADMIN_ROLE_NAME = "超级管理员";
const DEFAULT_USER_ROLE_NAME = "普通用户";
const canCreateUser = computed(() =>
    userStore.hasPermission("user.create_user"),
);
const canUpdateUser = computed(() =>
    userStore.hasPermission("user.update_user"),
);
const canDeleteUser = computed(() =>
    userStore.hasPermission("user.delete_user"),
);
const canManageUserRoles = computed(
    () => canCreateUser.value || canUpdateUser.value,
);
const showActionColumn = computed(
    () => canUpdateUser.value || canDeleteUser.value,
);
const avatarPreviewText = computed(() =>
    (userForm.display_name || userForm.username || "?").slice(0, 1),
);
const USER_TABLE_SCROLL_X = 1530;
const defaultRoleId = computed(
    () =>
        roleOptions.value.find((item) => item.label === DEFAULT_USER_ROLE_NAME)
            ?.value || null,
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
        { title: "用户名", dataIndex: "username", width: 140 },
        { title: "昵称", dataIndex: "display_name", width: 140 },
        { title: "电话号码", dataIndex: "phone_number", width: 150 },
        { title: "头像", dataIndex: "avatar", key: "avatar", width: 120 },
        { title: "邮箱", dataIndex: "email", width: 220 },
        {
            title: "状态",
            key: "status",
            width: 100,
            customRender: () => null,
        },
        {
            title: "创建时间",
            width: 180,
            customRender: ({ record }: { record: UserItem }) =>
                formatDateTime(record.created_at),
        },
        {
            title: "更新时间",
            width: 180,
            customRender: ({ record }: { record: UserItem }) =>
                formatDateTime(record.updated_at),
        },
    ];

    if (showActionColumn.value) {
        result.push({
            title: "操作",
            key: "action",
            fixed: "right" as const,
            width: 220,
        });
    }

    return result;
});

let unsubscribeAppRefresh: (() => void) | null = null;

const loadUsers = async () => {
    loading.value = true;
    try {
        const { data } = await getUsersApi({
            page: pagination.current,
            page_size: pagination.pageSize,
            keyword: keyword.value.trim() || undefined,
            created_from: createdAtRange.value[0] || undefined,
            created_to: createdAtRange.value[1] || undefined,
        });
        users.value = data.results;
        pagination.total = data.count;
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "加载用户失败"));
    } finally {
        loading.value = false;
    }
};

const loadRoles = async () => {
    if (!canManageUserRoles.value) {
        roleOptions.value = [];
        return;
    }
    try {
        const { data } = await getRolesApi({ page: 1, page_size: 500 });
        roleOptions.value = data.results
            .filter((item) => item.name !== SUPER_ADMIN_ROLE_NAME)
            .map((item) => ({ label: item.name, value: item.id }));
        if (
            !isEdit.value &&
            userModalOpen.value &&
            userForm.role_ids.length === 0 &&
            defaultRoleId.value
        ) {
            userForm.role_ids = [defaultRoleId.value];
        }
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "加载角色失败"));
    }
};

const isSuperAdminUser = (user: UserItem) => {
    if (user.is_superuser) return true;
    return user.roles.some((role) => role.name === SUPER_ADMIN_ROLE_NAME);
};

const onSearch = async () => {
    pagination.current = 1;
    await loadUsers();
};

const onReset = async () => {
    keyword.value = "";
    createdAtRange.value = [];
    pagination.current = 1;
    await loadUsers();
};

const handleTableChange = async (pager: TablePaginationConfig) => {
    pagination.current = pager.current || 1;
    pagination.pageSize = pager.pageSize || 10;
    await loadUsers();
};

const resetUserForm = () => {
    userForm.username = "";
    userForm.password = "";
    userForm.confirm_password = "";
    userForm.display_name = "";
    userForm.avatar = "";
    userForm.phone_number = "";
    userForm.email = "";
    userForm.role_ids = defaultRoleId.value ? [defaultRoleId.value] : [];
    userForm.is_active = true;
};

const openCreate = () => {
    void loadRoles();
    resetUserForm();
    isEdit.value = false;
    editId.value = null;
    userModalOpen.value = true;
};

const openEdit = (row: UserItem) => {
    void loadRoles();
    userForm.username = row.username;
    userForm.password = "";
    userForm.confirm_password = "";
    userForm.display_name = row.display_name;
    userForm.avatar = row.avatar || "";
    userForm.phone_number = row.phone_number || "";
    userForm.email = row.email;
    userForm.role_ids = row.roles.map((item) => item.id);
    if (userForm.role_ids.length === 0 && defaultRoleId.value) {
        userForm.role_ids = [defaultRoleId.value];
    }
    userForm.is_active = row.is_active;
    isEdit.value = true;
    editId.value = row.id;
    userModalOpen.value = true;
};

const handleAvatarUpload: UploadProps["beforeUpload"] = async (file) => {
    const warning = validateAvatarFile(file as File);
    if (warning) {
        message.warning(warning);
        return false;
    }

    if (avatarTempObjectUrl) {
        URL.revokeObjectURL(avatarTempObjectUrl);
        avatarTempObjectUrl = "";
    }

    avatarTempObjectUrl = URL.createObjectURL(file as File);
    avatarCropImageUrl.value = avatarTempObjectUrl;
    avatarCropOpen.value = true;

    return false;
};

const clearCropState = () => {
    avatarCropOpen.value = false;
    avatarCropImageUrl.value = "";
    if (avatarTempObjectUrl) {
        URL.revokeObjectURL(avatarTempObjectUrl);
        avatarTempObjectUrl = "";
    }
};

const handleAvatarCropCancel = () => {
    clearCropState();
};

const handleAvatarCropConfirm = async (avatarFile: File) => {
    if (!authStore.accessToken) {
        message.error("登录状态无效，无法上传头像");
        return;
    }

    avatarUploading.value = true;
    try {
        const result = await uploadFileWithCategory({
            file: avatarFile,
            category: "profile",
            token: authStore.accessToken,
        });
        userForm.avatar = result.url;
        message.success("头像上传成功");
        clearCropState();
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "头像上传失败"));
    } finally {
        avatarUploading.value = false;
    }
};

const submitUser = async () => {
    userForm.username = trimText(userForm.username);
    userForm.display_name = trimText(userForm.display_name);
    userForm.phone_number = trimText(userForm.phone_number);
    userForm.email = trimText(userForm.email);

    if (!isEdit.value && !userForm.username) {
        message.warning("请输入用户名");
        return;
    }

    if (!isEdit.value) {
        if (!userForm.password) {
            message.warning("请输入密码");
            return;
        }
        if (userForm.password !== userForm.confirm_password) {
            message.warning("两次输入的密码不一致");
            return;
        }
    }

    if (!isValidEmail(userForm.email)) {
        message.warning("邮箱格式不正确");
        return;
    }
    if (userForm.role_ids.length === 0) {
        message.warning("每个用户至少需要保留一个角色");
        return;
    }
    if (!isValidPhoneNumber(userForm.phone_number)) {
        message.warning("电话号码格式不正确，应为 11 位手机号");
        return;
    }

    saving.value = true;
    try {
        if (isEdit.value && editId.value) {
            await updateUserApi(editId.value, {
                display_name: userForm.display_name,
                avatar: userForm.avatar,
                phone_number: userForm.phone_number,
                email: userForm.email,
                is_active: userForm.is_active,
                role_ids: userForm.role_ids,
            });
            message.success("用户更新成功");
        } else {
            await createUserApi({
                username: userForm.username,
                password: userForm.password,
                display_name: userForm.display_name,
                avatar: userForm.avatar,
                phone_number: userForm.phone_number,
                email: userForm.email,
                is_active: userForm.is_active,
                role_ids: userForm.role_ids,
            });
            message.success("用户创建成功");
        }
        userModalOpen.value = false;
        await loadUsers();
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "保存失败"));
    } finally {
        saving.value = false;
    }
};

const onDelete = async (id: number) => {
    try {
        await deleteUserApi(id);
        message.success("删除成功");
        await loadUsers();
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "删除失败"));
    }
};

const onToggleStatus = async (row: UserItem, checked: boolean) => {
    if (checked === row.is_active) {
        return;
    }

    if (!checked) {
        if (row.id === userStore.user?.id) {
            message.warning("不能停用当前登录用户");
            return;
        }
        Modal.confirm({
            title: "确认停用该用户？",
            content: "停用后将强制该用户下线，并且该用户无法登录。",
            okText: "确认停用",
            cancelText: "取消",
            onOk: async () => {
                await updateUserStatus(row, false);
            },
        });
        return;
    }

    await updateUserStatus(row, true);
};

const updateUserStatus = async (row: UserItem, isActive: boolean) => {
    statusUpdatingMap[row.id] = true;
    try {
        await updateUserApi(row.id, { is_active: isActive });
        if (!isActive && row.id !== userStore.user?.id) {
            await kickoutUserApi(row.id);
        }
        // 直接更新当前行数据，而不是重新加载整个列表
        const targetUser = users.value.find((u) => u.id === row.id);
        if (targetUser) {
            targetUser.is_active = isActive;
        }
        message.success(
            isActive ? "用户已启用" : `已停用 ${row.username} 并强制下线`,
        );
    } catch (error: unknown) {
        message.error(
            getErrorMessage(error, isActive ? "启用失败" : "停用失败"),
        );
    } finally {
        statusUpdatingMap[row.id] = false;
    }
};

onMounted(async () => {
    unsubscribeAppRefresh = subscribeAppRefresh(async () => {
        const tasks = [loadUsers()];
        if (canManageUserRoles.value) {
            tasks.push(loadRoles());
        }
        await Promise.all(tasks);
    });
    try {
        const tasks = [loadUsers()];
        if (canManageUserRoles.value) {
            tasks.push(loadRoles());
        }
        await Promise.all(tasks);
    } catch {
        // loadUsers/loadRoles already report user-friendly errors
    }
});

onBeforeUnmount(() => {
    unsubscribeAppRefresh?.();
    unsubscribeAppRefresh = null;
    if (avatarTempObjectUrl) {
        URL.revokeObjectURL(avatarTempObjectUrl);
        avatarTempObjectUrl = "";
    }
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
