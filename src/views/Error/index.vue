<template>
    <section class="error-view">
        <div class="error-view__glow error-view__glow--left"></div>
        <div class="error-view__glow error-view__glow--right"></div>
        <div class="error-view__card">
            <p class="error-view__eyebrow">Route Miss</p>
            <h1 class="error-view__code">404</h1>
            <h2 class="error-view__title">页面不存在或已被移动</h2>
            <p class="error-view__desc">
                当前地址没有命中有效页面。你可以返回上一页，或者直接回到首页重新进入目标功能。
            </p>
            <div class="error-view__actions">
                <a-button type="primary" size="large" @click="goHome"
                    >返回首页</a-button
                >
                <a-button size="large" ghost @click="goBack"
                    >返回上一页</a-button
                >
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();

const goHome = () => {
    void router.push("/home");
};

const goBack = () => {
    if (window.history.length > 1) {
        router.back();
        return;
    }
    void router.push("/home");
};
</script>

<style scoped>
.error-view {
    position: relative;
    width: 100%;
    min-height: 100vh;
    height: 100vh;
    overflow: hidden;
    display: grid;
    place-items: center;
    padding: 40px 20px;
    background:
        radial-gradient(
            circle at top,
            rgba(22, 119, 255, 0.18),
            transparent 36%
        ),
        linear-gradient(
            160deg,
            color-mix(in srgb, var(--surface-page) 82%, #dce9fb 18%) 0%,
            var(--surface-page) 52%,
            color-mix(in srgb, var(--surface-page) 88%, #fff2d9 12%) 100%
        );
}

.error-view__glow {
    position: absolute;
    width: 340px;
    height: 340px;
    border-radius: 999px;
    filter: blur(18px);
    opacity: 0.45;
    pointer-events: none;
}

.error-view__glow--left {
    left: -120px;
    bottom: -80px;
    background: rgba(26, 101, 255, 0.22);
}

.error-view__glow--right {
    top: -100px;
    right: -80px;
    background: rgba(255, 170, 64, 0.24);
}

.error-view__card {
    position: relative;
    z-index: 1;
    width: min(680px, 100%);
    margin: auto;
    padding: 40px 32px;
    border: 1px solid rgba(15, 23, 42, 0.08);
    border-radius: 28px;
    background: color-mix(in srgb, var(--surface-header) 88%, transparent);
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
    backdrop-filter: blur(14px);
}

.error-view__eyebrow {
    margin-bottom: 12px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #9a5b16;
}

.error-view__code {
    margin-bottom: 8px;
    font-size: clamp(72px, 15vw, 124px);
    line-height: 0.92;
    font-weight: 800;
    letter-spacing: -0.06em;
    color: var(--text-primary);
}

.error-view__title {
    margin-bottom: 12px;
    font-size: clamp(24px, 4vw, 34px);
    line-height: 1.15;
    color: var(--text-primary);
}

.error-view__desc {
    max-width: 520px;
    font-size: 15px;
    line-height: 1.8;
    color: var(--text-secondary);
}

.error-view__actions {
    display: flex;
    gap: 12px;
    margin-top: 28px;
    flex-wrap: wrap;
}

.error-view__actions :deep(.ant-btn-background-ghost) {
    color: var(--text-primary);
    border-color: color-mix(in srgb, var(--text-secondary) 42%, transparent);
}

@media (max-width: 640px) {
    .error-view {
        min-height: 100vh;
        height: 100vh;
        padding: 24px 16px;
    }

    .error-view__card {
        padding: 28px 20px;
        border-radius: 22px;
    }

    .error-view__actions {
        flex-direction: column;
    }

    .error-view__actions :deep(.ant-btn) {
        width: 100%;
    }
}
</style>
