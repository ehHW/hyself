<template>
    <section
        class="upload-task-panel"
        :class="{
            'upload-task-panel--dragging': isDragging,
            'upload-task-panel--readonly': isReadonly,
        }"
        @dragenter.prevent="handleDragEnter"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
    >
        <div v-if="isDragging" class="upload-task-panel__drop-mask">
            <div class="upload-task-panel__drop-card">
                <div class="upload-task-panel__drop-title">
                    释放文件或文件夹
                </div>
                <div class="upload-task-panel__drop-desc">
                    导入后继续选择上传目录
                </div>
            </div>
        </div>

        <a-alert
            v-if="isReadonly"
            type="info"
            show-icon
            class="upload-readonly-alert"
            message="当前为只读上传页"
            :description="readonlyDescription"
        />

        <div class="upload-toolbar-row">
            <a-space wrap>
                <a-button :disabled="isReadonly" @click="startAll"
                    >开始上传</a-button
                >
                <a-button
                    :disabled="isReadonly || !fileStore.canResumeAll"
                    @click="resumeAll"
                    >全部继续</a-button
                >
                <a-button
                    :disabled="isReadonly || !fileStore.canPauseAll"
                    @click="pauseAll"
                    >全部暂停</a-button
                >
                <a-button
                    danger
                    :disabled="isReadonly || !fileStore.canCancelAll"
                    @click="cancelAll"
                    >全部取消</a-button
                >
                <a-button :disabled="isReadonly" @click="clearFinished"
                    >清理已完成</a-button
                >
                <a-space>
                    <span>刷新后自动继续暂停任务</span>
                    <a-switch
                        :checked="fileStore.autoResumePausedOnReload"
                        :disabled="isReadonly"
                        @change="onToggleAutoResume"
                    />
                </a-space>
            </a-space>
            <span class="upload-toolbar-row__status">{{
                uploadQueueStatusText
            }}</span>
        </div>

        <a-progress
            v-if="fileStore.uploadTasks.length"
            :percent="fileStore.overallUploadProgress"
            style="margin-bottom: 12px"
        />

        <div v-if="!fileStore.uploadTasks.length" class="upload-empty-state">
            <template v-if="isReadonly">
                <div class="upload-empty-state__title">
                    当前账号不可上传文件
                </div>
                <div class="upload-empty-state__desc">
                    你可以查看上传队列和目标目录，但拖拽导入、选择文件、加入上传队列、创建目录与启动上传均已关闭。
                </div>
            </template>
            <template v-else>
                <div class="upload-empty-state__title">
                    拖拽文件或文件夹到这里
                </div>
                <div class="upload-empty-state__desc">
                    也可以点击下面的按钮选择文件，随后再指定上传目录。
                </div>
                <a-space wrap>
                    <a-button type="primary" @click="pickFiles"
                        >选择文件</a-button
                    >
                    <a-button @click="pickFolder">选择文件夹</a-button>
                </a-space>
            </template>
        </div>

        <a-table
            :columns="columns"
            :data-source="fileStore.uploadTasks"
            row-key="id"
            :pagination="{ pageSize: 8 }"
            :scroll="{ x: 980 }"
        >
            <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'displayName'">
                    <FileNameCell :name="record.displayName" :is-dir="false" />
                </template>
                <template v-else-if="column.key === 'size'">
                    {{ formatFileSize(record.size) }}
                </template>
                <template v-else-if="column.key === 'progress'">
                    <a-progress :percent="record.progress" size="small" />
                </template>
                <template v-else-if="column.key === 'status'">
                    <a-tag :color="statusColor(record.status)">{{
                        statusText(record.status)
                    }}</a-tag>
                    <span v-if="record.errorMessage" class="error-text">{{
                        record.errorMessage
                    }}</span>
                </template>
                <template v-else-if="column.key === 'actions'">
                    <a-space>
                        <a-button
                            v-if="
                                record.status === 'paused' ||
                                record.status === 'failed'
                            "
                            size="small"
                            :disabled="isReadonly"
                            @click="onResume(record.id)"
                        >
                            继续
                        </a-button>
                        <a-button
                            v-if="record.status === 'uploading'"
                            size="small"
                            :disabled="isReadonly"
                            @click="onPause(record.id)"
                            >暂停</a-button
                        >
                        <a-button
                            v-if="
                                record.status === 'pending' ||
                                record.status === 'uploading' ||
                                record.status === 'paused'
                            "
                            size="small"
                            danger
                            :disabled="isReadonly"
                            @click="onCancel(record.id)"
                        >
                            取消
                        </a-button>
                    </a-space>
                </template>
            </template>
        </a-table>

        <input
            ref="fileInputRef"
            type="file"
            multiple
            style="display: none"
            @change="onPickFiles"
        />
        <input
            ref="folderInputRef"
            type="file"
            webkitdirectory
            directory
            multiple
            style="display: none"
            @change="onPickFiles"
        />

        <a-modal
            v-model:open="selectTargetOpen"
            title="选择上传目录"
            ok-text="确定上传"
            cancel-text="取消"
            :ok-button-props="{
                disabled: isReadonly || waitingFiles.length === 0,
            }"
            @ok="confirmUploadToCurrentFolder"
        >
            <div class="target-modal-toolbar">
                <a-breadcrumb class="target-modal-toolbar__breadcrumb">
                    <a-breadcrumb-item
                        v-for="item in fileStore.breadcrumbs"
                        :key="String(item.id ?? 'root')"
                    >
                        <a @click="openBreadcrumb(item.id)">{{ item.name }}</a>
                    </a-breadcrumb-item>
                </a-breadcrumb>
                <a-button
                    v-if="canCreateFolder && !isReadonly"
                    type="primary"
                    ghost
                    size="small"
                    @click="toggleCreateFolderInline"
                    >新建文件夹</a-button
                >
            </div>

            <div
                v-if="createFolderInlineOpen"
                class="target-modal-toolbar__inline"
            >
                <a-input
                    ref="createFolderInputRef"
                    v-model:value="newFolderName"
                    placeholder="输入目录名称"
                    @press-enter="handleCreateFolderEnter"
                    @keydown.esc="handleCancelCreateFolder"
                />
                <a-button
                    type="primary"
                    size="small"
                    :loading="createFolderSaving"
                    @click="handleCreateFolder"
                    >创建</a-button
                >
                <a-button
                    size="small"
                    :disabled="createFolderSaving"
                    @click="handleCancelCreateFolder"
                    >取消</a-button
                >
            </div>

            <a-table
                :columns="targetColumns"
                :data-source="folderEntries"
                row-key="id"
                size="small"
                :pagination="false"
                :loading="fileStore.loadingEntries"
            >
                <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'name'">
                        <FileNameCell
                            :name="record.display_name"
                            :is-dir="true"
                            clickable
                            @click="enterFolder(record)"
                        />
                    </template>
                </template>
            </a-table>
        </a-modal>
    </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { message } from "ant-design-vue";
import FileNameCell from "@/components/common/FileNameCell.vue";
import { useFileStore } from "@/stores/file";
import { useUserStore } from "@/stores/user";
import type { FileEntryItem } from "@/api/upload";
import { getErrorMessage } from "@/utils/error";
import { formatFileSize } from "@/utils/fileFormatter";

const fileStore = useFileStore();
const userStore = useUserStore();
const fileInputRef = ref<HTMLInputElement | null>(null);
const folderInputRef = ref<HTMLInputElement | null>(null);
const selectTargetOpen = ref(false);
const waitingFiles = ref<File[]>([]);
const createFolderInputRef = ref<{ focus: () => void } | null>(null);
const createFolderInlineOpen = ref(false);
const createFolderSaving = ref(false);
const newFolderName = ref("");
const isDragging = ref(false);
const dragDepth = ref(0);

const uploadQueueStatusText = computed(() => {
    const taskCount = fileStore.uploadTasks.length;
    return taskCount > 0 ? `文件上传队列 ${taskCount} 项` : "文件上传队列 0 项";
});
const canCreateFolder = computed(() =>
    userStore.hasPermission("file.create_folder"),
);
const canUploadFile = computed(() =>
    userStore.hasPermission("file.upload_file"),
);
const isReadonly = computed(() => !canUploadFile.value);
const readonlyDescription = computed(
    () =>
        "当前角色没有 file.upload_file 权限，只能查看上传队列和目录结构，不能拖拽、选取、加入或执行上传任务。",
);

const folderEntries = computed(() =>
    fileStore.entries.filter((item) => item.is_dir && !item.is_recycle_bin),
);

const columns = [
    { title: "文件名", dataIndex: "displayName", width: 260 },
    { title: "相对路径", dataIndex: "relativePath", width: 260 },
    { title: "大小", key: "size", width: 120 },
    { title: "进度", key: "progress", width: 220 },
    { title: "状态", key: "status", width: 220 },
    { title: "操作", key: "actions", width: 180, fixed: "right" as const },
];

const targetColumns = [
    { title: "目录", dataIndex: "display_name", key: "name" },
];

const pickFiles = () => {
    if (isReadonly.value) return;
    if (!fileInputRef.value) return;
    fileInputRef.value.value = "";
    fileInputRef.value.click();
};

const pickFolder = () => {
    if (isReadonly.value) return;
    if (!folderInputRef.value) return;
    folderInputRef.value.value = "";
    folderInputRef.value.click();
};

const onPickFiles = async (event: Event) => {
    try {
        const input = event.target as HTMLInputElement;
        const files = Array.from(input.files || []);
        await queueFilesForUpload(files);
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "选择文件失败"));
    }
};

const queueFilesForUpload = async (files: File[]) => {
    if (isReadonly.value) {
        message.warning("当前无上传权限，上传页为只读状态");
        return;
    }
    if (files.length === 0) {
        return;
    }
    waitingFiles.value = files;
    await fileStore.loadEntries(
        fileStore.currentParent?.is_recycle_bin
            ? null
            : fileStore.currentParentId,
    );
    selectTargetOpen.value = true;
};

const openBreadcrumb = async (id: number | null) => {
    try {
        await fileStore.goToBreadcrumb({ id });
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "打开目录失败"));
    }
};

const enterFolder = async (folder: FileEntryItem) => {
    try {
        if (folder.is_recycle_bin) {
            message.warning("上传目录不能选择回收站");
            return;
        }
        await fileStore.enterFolder(folder);
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "进入目录失败"));
    }
};

const toggleCreateFolderInline = async () => {
    if (isReadonly.value) {
        message.warning("当前无上传权限，上传页为只读状态");
        return;
    }
    createFolderInlineOpen.value = !createFolderInlineOpen.value;
    if (!createFolderInlineOpen.value) {
        newFolderName.value = "";
        return;
    }
    await nextTick();
    createFolderInputRef.value?.focus();
};

const handleCancelCreateFolder = () => {
    createFolderInlineOpen.value = false;
    newFolderName.value = "";
};

const handleCreateFolder = async () => {
    if (isReadonly.value) {
        message.warning("当前无上传权限，上传页为只读状态");
        return;
    }
    const folderName = newFolderName.value.trim();
    if (!folderName) {
        message.warning("请输入目录名称");
        return;
    }
    createFolderSaving.value = true;
    try {
        await fileStore.createFolder(folderName, fileStore.currentParentId);
        newFolderName.value = "";
        createFolderInlineOpen.value = false;
        message.success("目录已创建");
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "创建目录失败"));
    } finally {
        createFolderSaving.value = false;
    }
};

const handleCreateFolderEnter = async (event: KeyboardEvent) => {
    event.preventDefault();
    await handleCreateFolder();
};

type FileSystemEntryWithFile = FileSystemEntry & {
    file?: (
        successCallback: (file: File) => void,
        errorCallback?: (error: DOMException) => void,
    ) => void;
    createReader?: () => {
        readEntries: (
            successCallback: (entries: FileSystemEntry[]) => void,
            errorCallback?: (error: DOMException) => void,
        ) => void;
    };
};

const cloneFileWithRelativePath = (file: File, relativePath: string) => {
    const cloned = new File([file], file.name, {
        type: file.type,
        lastModified: file.lastModified,
    }) as File & { webkitRelativePath?: string };
    Object.defineProperty(cloned, "webkitRelativePath", {
        configurable: true,
        enumerable: false,
        value: relativePath.replace(/^\/+/, ""),
    });
    return cloned;
};

const readFileEntry = (entry: FileSystemEntryWithFile, relativePath: string) =>
    new Promise<File>((resolve, reject) => {
        entry.file?.(
            (file) =>
                resolve(
                    cloneFileWithRelativePath(file, relativePath || file.name),
                ),
            (error) => reject(error),
        );
    });

const readDirectoryEntries = (
    reader: NonNullable<
        ReturnType<NonNullable<FileSystemEntryWithFile["createReader"]>>
    >,
) =>
    new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
    });

const collectEntryFiles = async (
    entry: FileSystemEntryWithFile,
    currentPath = "",
): Promise<File[]> => {
    const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    if (entry.isFile) {
        return [await readFileEntry(entry, nextPath)];
    }
    if (!entry.isDirectory || !entry.createReader) {
        return [];
    }

    const reader = entry.createReader();
    const files: File[] = [];
    while (true) {
        const entries = await readDirectoryEntries(reader);
        if (entries.length === 0) {
            break;
        }
        for (const child of entries) {
            const childFiles = await collectEntryFiles(
                child as FileSystemEntryWithFile,
                nextPath,
            );
            files.push(...childFiles);
        }
    }
    return files;
};

const extractDroppedFiles = async (event: DragEvent) => {
    const items = Array.from(event.dataTransfer?.items || []);
    const collected: File[] = [];
    let usedEntryTraversal = false;

    for (const item of items) {
        const entry = (
            item as DataTransferItem & {
                webkitGetAsEntry?: () => FileSystemEntry | null;
            }
        ).webkitGetAsEntry?.();
        if (!entry) {
            continue;
        }
        usedEntryTraversal = true;
        const files = await collectEntryFiles(entry as FileSystemEntryWithFile);
        collected.push(...files);
    }

    if (usedEntryTraversal) {
        return collected;
    }

    return Array.from(event.dataTransfer?.files || []);
};

const resetDraggingState = () => {
    dragDepth.value = 0;
    isDragging.value = false;
};

const handleDragEnter = () => {
    if (isReadonly.value) return;
    dragDepth.value += 1;
    isDragging.value = true;
};

const handleDragOver = () => {
    if (isReadonly.value) return;
    isDragging.value = true;
};

const handleDragLeave = () => {
    if (isReadonly.value) return;
    dragDepth.value = Math.max(0, dragDepth.value - 1);
    if (dragDepth.value === 0) {
        isDragging.value = false;
    }
};

const handleDrop = async (event: DragEvent) => {
    if (isReadonly.value) {
        resetDraggingState();
        message.warning("当前无上传权限，上传页为只读状态");
        return;
    }
    resetDraggingState();
    try {
        const files = await extractDroppedFiles(event);
        await queueFilesForUpload(files);
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "拖拽导入失败"));
    }
};

const confirmUploadToCurrentFolder = async () => {
    if (isReadonly.value) {
        message.warning("当前无上传权限，上传页为只读状态");
        return;
    }
    if (waitingFiles.value.length === 0) {
        message.warning("未选择文件");
        return;
    }
    try {
        await fileStore.addUploadFiles(
            waitingFiles.value,
            fileStore.currentParentId,
        );
        waitingFiles.value = [];
        selectTargetOpen.value = false;
        createFolderInlineOpen.value = false;
        newFolderName.value = "";
        message.success("已加入文件上传队列，请点击“开始上传”");
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "准备上传文件失败"));
    }
};

const startAll = async () => {
    if (isReadonly.value) {
        message.warning("当前无上传权限，上传页为只读状态");
        return;
    }
    try {
        await fileStore.startPendingUploads();
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "开始上传失败"));
    }
};

const resumeAll = async () => {
    if (isReadonly.value) {
        message.warning("当前无上传权限，上传页为只读状态");
        return;
    }
    try {
        const startedCount = await fileStore.resumeAllTasks();
        if (startedCount > 0) {
            message.success(`已继续 ${startedCount} 个文件上传`);
            return;
        }
        message.info("当前没有可继续的文件上传");
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "继续上传失败"));
    }
};

const pauseAll = () => {
    if (isReadonly.value) {
        message.warning("当前无上传权限，上传页为只读状态");
        return;
    }
    fileStore.pauseAllTasks();
    message.success("已暂停全部文件上传");
};

const cancelAll = () => {
    if (isReadonly.value) {
        message.warning("当前无上传权限，上传页为只读状态");
        return;
    }
    const canceledCount = fileStore.cancelAllTasks();
    if (canceledCount > 0) {
        message.success(`已取消 ${canceledCount} 个文件上传`);
        return;
    }
    message.info("当前没有可取消的文件上传");
};

const onToggleAutoResume = (checked: boolean) => {
    if (isReadonly.value) {
        message.warning("当前无上传权限，上传页为只读状态");
        return;
    }
    fileStore.setAutoResumePausedOnReload(checked);
    message.success(
        checked ? "已开启自动继续暂停任务" : "已关闭自动继续暂停任务",
    );
};

const clearFinished = () => {
    if (isReadonly.value) {
        message.warning("当前无上传权限，上传页为只读状态");
        return;
    }
    fileStore.clearFinishedTasks();
};

const onPause = (taskId: string) => {
    if (isReadonly.value) {
        message.warning("当前无上传权限，上传页为只读状态");
        return;
    }
    fileStore.pauseTask(taskId);
};

const onResume = async (taskId: string) => {
    if (isReadonly.value) {
        message.warning("当前无上传权限，上传页为只读状态");
        return;
    }
    try {
        await fileStore.resumeTask(taskId);
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "继续上传失败"));
    }
};

const onCancel = (taskId: string) => {
    if (isReadonly.value) {
        message.warning("当前无上传权限，上传页为只读状态");
        return;
    }
    fileStore.cancelTask(taskId);
};

const statusText = (status: string) => {
    const mapping: Record<string, string> = {
        pending: "待上传",
        uploading: "上传中",
        paused: "已暂停",
        completed: "已完成",
        failed: "失败",
        canceled: "已取消",
    };
    return mapping[status] || status;
};

const statusColor = (status: string) => {
    const mapping: Record<string, string> = {
        pending: "default",
        uploading: "processing",
        paused: "warning",
        completed: "success",
        failed: "error",
        canceled: "default",
    };
    return mapping[status] || "default";
};

onMounted(async () => {
    try {
        if (fileStore.autoResumePausedOnReload && fileStore.pausedCount > 0) {
            await fileStore.resumePausedTasks();
            message.success("已自动继续暂停的文件上传");
        }
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "文件上传初始化失败"));
    }
});
</script>

<style scoped>
.upload-task-panel {
    min-height: 0;
    position: relative;
}

.upload-task-panel--readonly {
    border-radius: 16px;
}

.upload-readonly-alert {
    margin-bottom: 12px;
}

.upload-toolbar-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}

.upload-toolbar-row__status {
    flex-shrink: 0;
    color: var(--text-secondary);
    font-size: 12px;
}

.upload-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 240px;
    margin-bottom: 12px;
    padding: 28px 20px;
    border: 1px dashed color-mix(in srgb, #1677ff 32%, transparent);
    border-radius: 18px;
    background: color-mix(in srgb, #1677ff 5%, var(--surface-content));
    text-align: center;
}

.upload-task-panel--readonly .upload-empty-state {
    border-style: solid;
    border-color: color-mix(in srgb, #1677ff 18%, transparent);
    background: linear-gradient(
        135deg,
        color-mix(in srgb, #1677ff 8%, var(--surface-content)),
        color-mix(in srgb, #94a3b8 10%, var(--surface-content))
    );
}

.upload-empty-state__title {
    color: var(--text-primary);
    font-size: 18px;
    font-weight: 700;
}

.upload-empty-state__desc {
    max-width: 420px;
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.6;
}

.upload-task-panel--dragging {
    outline: 2px dashed #1677ff;
    outline-offset: 8px;
}

.upload-task-panel__drop-mask {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(22, 119, 255, 0.08);
    backdrop-filter: blur(2px);
}

.upload-task-panel__drop-card {
    min-width: 240px;
    padding: 20px 24px;
    border: 1px dashed rgba(22, 119, 255, 0.42);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.96);
    text-align: center;
    box-shadow: 0 18px 36px rgba(15, 23, 42, 0.12);
}

.upload-task-panel__drop-title {
    color: var(--text-primary);
    font-size: 16px;
    font-weight: 700;
}

.upload-task-panel__drop-desc {
    margin-top: 6px;
    color: var(--text-secondary);
    font-size: 12px;
}

.error-text {
    margin-left: 8px;
    color: var(--error-color);
}

.target-modal-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}

.target-modal-toolbar__breadcrumb {
    flex: 1;
    min-width: 0;
}

.target-modal-toolbar__inline {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}

.target-modal-toolbar__inline :deep(.ant-input) {
    flex: 1;
}
</style>
