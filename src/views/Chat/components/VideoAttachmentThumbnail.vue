<template>
    <div class="video-thumbnail">
        <img
            v-if="previewUrl"
            :src="previewUrl"
            :alt="alt"
            class="video-thumbnail__image"
            @error="handleImageError"
            loading="lazy"
            decoding="async"
        />
        <div v-else class="video-thumbnail__fallback" aria-hidden="true">
            <div class="video-thumbnail__fallback-icon">
                <CaretRightFilled />
            </div>
            <div class="video-thumbnail__fallback-text">视频</div>
        </div>
        <video
            v-if="sourceUrl"
            ref="videoRef"
            class="video-thumbnail__hidden-video"
            :src="sourceUrl"
            muted
            playsinline
            preload="metadata"
            @loadedmetadata="handleLoadedMetadata"
            @seeked="captureFrame"
            @loadeddata="captureFrame"
        ></video>
    </div>
</template>

<script setup lang="ts">
import { CaretRightFilled } from "@ant-design/icons-vue";
import { computed, ref, watch } from "vue";

const props = defineProps<{
    posterUrl?: string;
    sourceUrl?: string;
    alt: string;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const previewUrl = ref("");
const seekScheduled = ref(false);

const normalizedPosterUrl = computed(() =>
    String(props.posterUrl || "").trim(),
);
const normalizedSourceUrl = computed(() =>
    String(props.sourceUrl || "").trim(),
);

const resetPreview = () => {
    previewUrl.value = normalizedPosterUrl.value;
    seekScheduled.value = false;
};

const captureFrame = () => {
    const element = videoRef.value;
    if (!element || previewUrl.value || !normalizedSourceUrl.value) {
        return;
    }
    if (
        element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        !element.videoWidth ||
        !element.videoHeight
    ) {
        return;
    }
    try {
        const canvas = document.createElement("canvas");
        canvas.width = element.videoWidth;
        canvas.height = element.videoHeight;
        const context = canvas.getContext("2d");
        if (!context) {
            return;
        }
        context.drawImage(element, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.84);
        if (dataUrl && dataUrl !== "data:,") {
            previewUrl.value = dataUrl;
        }
    } catch {
        // Ignore capture failure and keep the fallback placeholder.
    }
};

const handleLoadedMetadata = () => {
    const element = videoRef.value;
    if (!element || normalizedPosterUrl.value || seekScheduled.value) {
        return;
    }
    const duration = Number.isFinite(element.duration) ? element.duration : 0;
    const targetTime =
        duration > 0
            ? Math.min(Math.max(duration * 0.15, 0.2), 1.2, duration)
            : 0;
    if (targetTime <= 0) {
        captureFrame();
        return;
    }
    seekScheduled.value = true;
    try {
        element.currentTime = targetTime;
    } catch {
        captureFrame();
    }
};

const handleImageError = () => {
    previewUrl.value = "";
    if (videoRef.value && !seekScheduled.value) {
        handleLoadedMetadata();
    }
};

watch(
    [normalizedPosterUrl, normalizedSourceUrl],
    () => {
        resetPreview();
    },
    { immediate: true },
);
</script>

<style scoped>
.video-thumbnail {
    position: relative;
    display: inline-flex;
    min-width: 140px;
    min-height: 96px;
    max-width: min(var(--attachment-preview-width, 320px), 80vw);
    max-height: var(--attachment-preview-height, 220px);
    overflow: hidden;
    border-radius: 14px;
    background: #111827;
}

.video-thumbnail__image {
    display: block;
    width: auto;
    height: auto;
    max-width: min(var(--attachment-preview-width, 320px), 80vw);
    max-height: var(--attachment-preview-height, 220px);
    border-radius: 14px;
    object-fit: contain;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
}

.video-thumbnail__fallback {
    display: flex;
    width: min(var(--attachment-preview-width, 320px), 80vw);
    min-height: 96px;
    max-height: var(--attachment-preview-height, 220px);
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border-radius: 14px;
    color: rgba(255, 255, 255, 0.92);
    background:
        radial-gradient(
            circle at top,
            rgba(96, 165, 250, 0.32),
            transparent 55%
        ),
        linear-gradient(160deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.94));
}

.video-thumbnail__fallback-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
    backdrop-filter: blur(6px);
}

.video-thumbnail__fallback-icon :deep(svg) {
    font-size: 24px;
    transform: translateX(2px);
}

.video-thumbnail__fallback-text {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.08em;
}

.video-thumbnail__hidden-video {
    position: absolute;
    inset: 0;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
}
</style>
