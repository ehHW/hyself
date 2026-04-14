<template>
    <div class="game-2048-view">
        <aside class="leaderboard-panel">
            <div class="panel-header">
                <div>
                    <p class="panel-eyebrow">游戏排行榜</p>
                    <div class="panel-title-row">
                        <h2 class="panel-title">{{ currentGame.name }}</h2>
                        <a-tooltip title="仅保留每个用户在当前游戏中的最高成绩">
                            <InfoCircleOutlined class="title-tip-icon" />
                        </a-tooltip>
                    </div>
                </div>
            </div>

            <a-alert
                v-if="!canSubmitBestRecord"
                type="info"
                show-icon
                class="leaderboard-alert"
                message="当前为排行榜只读模式"
                description="你可以查看排行榜和历史成绩，但当前角色没有 game.submit_best_record 权限，新的游戏成绩不会提交到后端。"
            />

            <section class="summary-card">
                <div class="summary-label">我的最高分</div>
                <div class="summary-score">
                    {{ myBestRecord?.best_score ?? 0 }}
                </div>
                <div class="summary-meta">
                    <span>{{
                        myBestRecord
                            ? formatTime(myBestRecord.finished_at)
                            : "还没有通关记录"
                    }}</span>
                    <span v-if="myBestRecord">结束棋盘已入库</span>
                </div>
            </section>

            <a-spin :spinning="isLeaderboardLoading || isSubmittingResult">
                <div v-if="leaderboard.length" class="leaderboard-list">
                    <div
                        v-for="item in leaderboard"
                        :key="`${item.user_id}-${item.game_code}`"
                        class="leaderboard-item"
                        :class="{
                            'is-self': item.user_id === currentUserId,
                            'is-preview': isPreviewRecord(item),
                        }"
                        @click="toggleBoardPreview(item)"
                    >
                        <div class="rank-badge">#{{ item.rank }}</div>
                        <div class="player-main-row">
                            <a-avatar
                                :src="item.avatar || undefined"
                                class="player-avatar"
                            >
                                {{ resolveDisplayName(item).slice(0, 1) }}
                            </a-avatar>
                            <div class="player-name-row">
                                <span class="player-name">{{
                                    resolveDisplayName(item)
                                }}</span>
                                <span
                                    v-if="item.user_id === currentUserId"
                                    class="self-tag"
                                    >我</span
                                >
                            </div>
                        </div>
                        <div class="player-score">{{ item.best_score }}</div>
                    </div>
                </div>
                <a-empty v-else description="暂无排行榜记录" />
            </a-spin>
        </aside>

        <section class="game-stage">
            <div class="preview-slot">
                <div v-if="isPreviewingBoard" class="preview-banner">
                    正在查看
                    {{ resolveDisplayName(previewRecord as GameRecordItem) }}
                    的终局棋盘
                    <a class="preview-cancel" @click.prevent="clearPreview"
                        >退出查看</a
                    >
                </div>
            </div>
            <Game2048
                :preview-board-snapshot="previewBoardSnapshot"
                :preview-score="previewScore"
                :readonly-mode="isPreviewingBoard"
                @game-over="handleGameOver"
            />
        </section>
    </div>
</template>

<script setup lang="ts">
import { InfoCircleOutlined } from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
    getGameLeaderboardApi,
    getMyBestGameRecordApi,
    submitBestGameRecordApi,
} from "@/api/game";
import { ENTERTAINMENT_GAMES } from "@/views/Entertainment/gameConfig";
import { useUserStore } from "@/stores/user";
import type { GameRecordItem } from "@/types/game";
import { subscribeAppRefresh } from "@/utils/appRefresh";
import Game2048 from "./Game2048.vue";

const currentGame = ENTERTAINMENT_GAMES.game2048;

const leaderboard = ref<GameRecordItem[]>([]);
const myBestRecord = ref<GameRecordItem | null>(null);
const previewRecord = ref<GameRecordItem | null>(null);
const isLeaderboardLoading = ref(false);
const isBestLoading = ref(false);
const isSubmittingResult = ref(false);
const userStore = useUserStore();
const currentUserId = computed(() => userStore.user?.id ?? 0);
const canSubmitBestRecord = computed(() =>
    userStore.hasPermission("game.submit_best_record"),
);
const isPreviewingBoard = computed(() => Boolean(previewRecord.value));
const previewBoardSnapshot = computed<number[][] | null>(
    () => previewRecord.value?.board_snapshot ?? null,
);
const previewScore = computed<number | null>(
    () => previewRecord.value?.best_score ?? null,
);
let unsubscribeAppRefresh: (() => void) | null = null;

function isPreviewRecord(record: GameRecordItem) {
    return previewRecord.value?.id === record.id;
}

function hasBoardSnapshot(record: GameRecordItem) {
    return (
        Array.isArray(record.board_snapshot) && record.board_snapshot.length > 0
    );
}

function clearPreview() {
    previewRecord.value = null;
}

function toggleBoardPreview(record: GameRecordItem) {
    if (isPreviewRecord(record)) {
        clearPreview();
        return;
    }
    if (!hasBoardSnapshot(record)) {
        message.warning("该记录没有可预览的终局棋盘");
        return;
    }
    previewRecord.value = record;
}

function resolveDisplayName(record: GameRecordItem) {
    return record.display_name || record.username || `用户#${record.user_id}`;
}

function formatTime(value: string) {
    if (!value) {
        return "暂无记录";
    }
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

async function loadLeaderboard(silent: boolean = false) {
    isLeaderboardLoading.value = true;
    try {
        const { data } = await getGameLeaderboardApi({
            game_code: currentGame.code,
            limit: 10,
        });
        leaderboard.value = data.results;
        if (previewRecord.value) {
            const matched = data.results.find(
                (item) => item.id === previewRecord.value?.id,
            );
            if (matched) {
                previewRecord.value = matched;
            }
        }
    } catch {
        if (!silent) {
            message.error("获取排行榜失败");
        }
    } finally {
        isLeaderboardLoading.value = false;
    }
}

async function loadMyBestRecord(silent: boolean = false) {
    isBestLoading.value = true;
    try {
        const { data } = await getMyBestGameRecordApi({
            game_code: currentGame.code,
        });
        myBestRecord.value = data.record;
    } catch {
        if (!silent) {
            message.error("获取个人最高分失败");
        }
    } finally {
        isBestLoading.value = false;
    }
}

async function refreshRecords(silent: boolean = false) {
    await Promise.all([loadLeaderboard(silent), loadMyBestRecord(silent)]);
}

async function handleGameOver(payload: {
    score: number;
    boardSnapshot: number[][];
}) {
    if (!canSubmitBestRecord.value) {
        message.info("当前角色无成绩提交权限，已跳过同步");
        return;
    }
    if (isSubmittingResult.value) {
        return;
    }

    isSubmittingResult.value = true;
    try {
        const { data: bestData } = await getMyBestGameRecordApi({
            game_code: currentGame.code,
        });
        myBestRecord.value = bestData.record;
        const previousBestScore = bestData.record?.best_score ?? 0;
        if (payload.score <= previousBestScore) {
            return;
        }

        const { data } = await submitBestGameRecordApi({
            game_code: currentGame.code,
            game_name: currentGame.name,
            score: payload.score,
            board_snapshot: payload.boardSnapshot,
        });

        myBestRecord.value = data.record;
        await loadLeaderboard(true);
        message.success(`已更新最高分：${data.record.best_score}`);
    } catch {
        message.error("同步最高分失败");
    } finally {
        isSubmittingResult.value = false;
    }
}

onMounted(() => {
    unsubscribeAppRefresh = subscribeAppRefresh(async () => {
        await refreshRecords(false);
    });
    void refreshRecords(true);
});

onBeforeUnmount(() => {
    unsubscribeAppRefresh?.();
    unsubscribeAppRefresh = null;
});
</script>

<style scoped>
.game-2048-view {
    min-height: 100%;
    display: grid;
    grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
    gap: 20px;
    align-items: start;
    padding: 16px;
    background: transparent;
}

.leaderboard-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 18px;
    border-radius: 18px;
    background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--surface-header) 92%, #f4ede1 8%),
        var(--surface-sidebar)
    );
    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
}

.panel-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
}

.panel-eyebrow {
    margin: 0 0 6px;
    font-size: 12px;
    letter-spacing: 0.08em;
    color: var(--text-secondary);
}

.panel-title {
    margin: 0;
    font-size: 26px;
    line-height: 1.1;
    color: var(--text-primary);
}

.panel-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.title-tip-icon {
    color: var(--text-secondary);
    font-size: 15px;
    cursor: help;
}

.summary-card {
    padding: 16px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--surface-header) 84%, #f6c177 16%);
}

.leaderboard-alert {
    margin-bottom: -2px;
}

.summary-label {
    font-size: 12px;
    color: var(--text-secondary);
}

.summary-score {
    margin-top: 8px;
    font-size: 40px;
    line-height: 1;
    font-weight: 700;
    color: var(--text-primary);
}

.summary-meta {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--text-secondary);
}

.leaderboard-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.leaderboard-item {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--surface-header) 92%, transparent);
    border: 1px solid color-mix(in srgb, var(--text-secondary) 14%, transparent);
    cursor: pointer;
    transition:
        border-color 0.2s ease,
        background-color 0.2s ease;
}

.leaderboard-item.is-self {
    border-color: color-mix(in srgb, #1677ff 55%, transparent);
    background: color-mix(in srgb, #1677ff 12%, var(--surface-header));
}

.leaderboard-item.is-preview {
    border-color: color-mix(in srgb, #fa8c16 70%, transparent);
    background: color-mix(in srgb, #fa8c16 15%, var(--surface-header));
}

.rank-badge {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
}

.player-main-row {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
}

.player-avatar {
    flex-shrink: 0;
}

.player-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}

.player-name {
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.self-tag {
    padding: 2px 6px;
    border-radius: 999px;
    font-size: 12px;
    color: #1677ff;
    background: color-mix(in srgb, #1677ff 12%, white);
}

.player-score {
    font-size: 26px;
    line-height: 1;
    font-weight: 700;
    color: var(--text-primary);
}

.game-stage {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    justify-content: center;
}

.preview-slot {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}

.preview-banner {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    padding: 8px 12px;
    border-radius: 999px;
    background: color-mix(in srgb, #fa8c16 15%, var(--surface-header));
    border: 1px solid color-mix(in srgb, #fa8c16 55%, transparent);
    color: var(--text-primary);
    font-size: 13px;
}

.preview-cancel {
    margin-left: 10px;
    color: #d46b08;
}

@media (max-width: 1024px) {
    .game-2048-view {
        grid-template-columns: 1fr;
    }
}
</style>
