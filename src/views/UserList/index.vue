<template>
    <a-card title="用户列表">
        <a-table
            :columns="columns"
            :data-source="users"
            :loading="loading"
            row-key="id"
            :pagination="false"
            :scroll="{ y: 520 }"
        />
    </a-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getUsersApi } from "@/api/user";
import type { UserItem } from "@/types/user";

const loading = ref(false);
const users = ref<UserItem[]>([]);

const columns = [
    { title: "ID", dataIndex: "id" },
    { title: "用户名", dataIndex: "username" },
    { title: "昵称", dataIndex: "display_name" },
    { title: "邮箱", dataIndex: "email" },
    {
        title: "角色",
        customRender: ({ record }: { record: UserItem }) =>
            record.roles.map((item) => item.name).join(", ") || "-",
    },
];

const loadData = async () => {
    loading.value = true;
    try {
        const { data } = await getUsersApi();
        users.value = data.results;
    } finally {
        loading.value = false;
    }
};

onMounted(loadData);
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
