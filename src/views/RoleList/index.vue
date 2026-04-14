<template>
    <a-card title="角色列表">
        <a-table
            :columns="columns"
            :data-source="roles"
            :loading="loading"
            row-key="id"
            :pagination="pagination"
            :scroll="{ y: 520 }"
            @change="handleTableChange"
        />
    </a-card>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import type { TablePaginationConfig } from "ant-design-vue";
import { getRolesApi } from "@/api/user";
import type { RoleItem } from "@/types/user";

const loading = ref(false);
const roles = ref<RoleItem[]>([]);
const pagination = reactive<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showTotal: (total) => `共 ${total} 条`,
});

const columns = [
    { title: "ID", dataIndex: "id" },
    { title: "角色名", dataIndex: "name" },
    { title: "描述", dataIndex: "description" },
    {
        title: "权限",
        customRender: ({ record }: { record: RoleItem }) =>
            record.permissions.map((item) => item.name).join(", ") || "-",
    },
];

const loadData = async () => {
    loading.value = true;
    try {
        const { data } = await getRolesApi({
            page: pagination.current,
            page_size: pagination.pageSize,
        });
        roles.value = data.results;
        pagination.total = data.count;
    } finally {
        loading.value = false;
    }
};

const handleTableChange = async (pager: TablePaginationConfig) => {
    pagination.current = pager.current || 1;
    pagination.pageSize = pager.pageSize || 10;
    await loadData();
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
