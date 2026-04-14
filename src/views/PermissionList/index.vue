<template>
    <a-card title="权限列表">
        <a-table
            :columns="columns"
            :data-source="permissions"
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
import { getPermissionsApi } from "@/api/user";
import type { PermissionItem } from "@/types/user";

const loading = ref(false);
const permissions = ref<PermissionItem[]>([]);
const pagination = reactive<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showTotal: (total) => `共 ${total} 条`,
});

const columns = [
    { title: "ID", dataIndex: "id" },
    { title: "权限编码", dataIndex: "code" },
    { title: "权限名称", dataIndex: "name" },
    { title: "描述", dataIndex: "description" },
];

const loadData = async () => {
    loading.value = true;
    try {
        const { data } = await getPermissionsApi({
            page: pagination.current,
            page_size: pagination.pageSize,
        });
        permissions.value = data.results;
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
