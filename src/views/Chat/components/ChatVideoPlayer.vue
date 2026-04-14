<template>
    <div class="chat-video-player">
        <video
            ref="videoRef"
            class="chat-video-player__element"
            playsinline
            preload="auto"
            :poster="posterUrl || undefined"
        ></video>
    </div>
</template>

<script setup lang="ts">
import Hls from "hls.js";
// @ts-ignore
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { ChatVideoSubtitleTrack } from "@/types/chat";

const props = defineProps<{
    sourceUrl?: string;
    streamUrl?: string;
    posterUrl?: string;
    subtitleTracks?: ChatVideoSubtitleTrack[];
    autoplay?: boolean;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const posterUrl = computed(() => String(props.posterUrl || "").trim());
let hls: Hls | null = null;
let player: Plyr | null = null;
let currentSourceUrl = "";

const normalizedSubtitleTracks = computed(() => {
    if (!Array.isArray(props.subtitleTracks)) {
        return [] as ChatVideoSubtitleTrack[];
    }
    return props.subtitleTracks.filter((item) =>
        Boolean(String(item?.url || "").trim()),
    );
});

const isHlsSource = (value: string) => {
    if (!value) {
        return false;
    }
    try {
        const parsed = new URL(value, window.location.origin);
        return parsed.pathname.toLowerCase().endsWith(".m3u8");
    } catch {
        return (value.split("?")[0] ?? "").toLowerCase().endsWith(".m3u8");
    }
};

const PLYR_I18N_ZH_CN = {
    restart: "重新播放",
    rewind: "后退 {seektime} 秒",
    play: "播放",
    pause: "暂停",
    fastForward: "前进 {seektime} 秒",
    seek: "拖动进度",
    seekLabel: "{currentTime} / {duration}",
    played: "已播放",
    buffered: "已缓冲",
    currentTime: "当前时间",
    duration: "总时长",
    volume: "音量",
    mute: "静音",
    unmute: "取消静音",
    enableCaptions: "开启字幕",
    disableCaptions: "关闭字幕",
    download: "下载",
    enterFullscreen: "进入全屏",
    exitFullscreen: "退出全屏",
    frameTitle: "{title} 播放器",
    captions: "字幕",
    settings: "设置",
    pip: "画中画",
    menuBack: "返回上一级菜单",
    speed: "倍速",
    normal: "正常",
    quality: "清晰度",
    loop: "循环",
    start: "开始",
    end: "结束",
    all: "全部",
    reset: "重置",
    disabled: "关闭",
    enabled: "开启",
};

const destroyPlayer = () => {
    hls?.destroy();
    hls = null;
    player?.destroy();
    player = null;
};

const resolveVideoSource = () => {
    const streamUrl = String(props.streamUrl || "").trim();
    if (streamUrl && (Hls.isSupported() || isHlsSource(streamUrl))) {
        return streamUrl;
    }
    return String(props.sourceUrl || "").trim();
};

const applyPoster = () => {
    const element = videoRef.value;
    if (!element) {
        return;
    }
    if (posterUrl.value) {
        element.poster = posterUrl.value;
        return;
    }
    element.removeAttribute("poster");
};

const syncSubtitleTracks = () => {
    const element = videoRef.value;
    if (!element) {
        return;
    }
    Array.from(
        element.querySelectorAll("track[data-chat-subtitle-track='1']"),
    ).forEach((trackNode) => {
        trackNode.remove();
    });
    normalizedSubtitleTracks.value.forEach((track) => {
        const trackElement = document.createElement("track");
        trackElement.kind = "subtitles";
        trackElement.label = track.label || track.language || "字幕";
        trackElement.srclang = track.language || "zh";
        trackElement.src = track.url;
        trackElement.default = Boolean(track.default);
        trackElement.setAttribute("data-chat-subtitle-track", "1");
        element.appendChild(trackElement);
    });
};

const attemptAutoplay = () => {
    if (!props.autoplay) {
        return;
    }
    const element = videoRef.value;
    if (!element) {
        return;
    }
    element.autoplay = true;
    void element.play().catch(() => {
        // Ignore browser autoplay blocking; the user can resume manually.
    });
};

const ensurePlayer = (element: HTMLVideoElement) => {
    if (player) {
        return;
    }
    player = new Plyr(element, {
        autoplay: props.autoplay ?? false,
        captions: {
            active: normalizedSubtitleTracks.value.length > 0,
            update: true,
            language:
                normalizedSubtitleTracks.value.find((item) => item.default)
                    ?.language ||
                normalizedSubtitleTracks.value[0]?.language ||
                "auto",
        },
        controls: [
            "play-large",
            "play",
            "progress",
            "current-time",
            "mute",
            "volume",
            "settings",
            "fullscreen",
        ],
        i18n: PLYR_I18N_ZH_CN,
    });
};

const mountPlayer = () => {
    const element = videoRef.value;
    if (!element) {
        return;
    }
    const sourceUrl = resolveVideoSource();
    applyPoster();
    syncSubtitleTracks();
    if (!sourceUrl) {
        hls?.destroy();
        hls = null;
        currentSourceUrl = "";
        element.pause();
        element.removeAttribute("src");
        element.load();
        return;
    }

    if (sourceUrl === currentSourceUrl && player) {
        attemptAutoplay();
        return;
    }

    currentSourceUrl = sourceUrl;
    hls?.destroy();
    hls = null;
    element.pause();
    element.removeAttribute("src");
    element.load();

    if (isHlsSource(sourceUrl) && Hls.isSupported()) {
        hls = new Hls({
            enableWorker: true,
        });
        hls.attachMedia(element);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            hls?.loadSource(sourceUrl);
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            ensurePlayer(element);
            attemptAutoplay();
        });
    } else {
        element.src = sourceUrl;
        element.load();
        const handleCanPlay = () => {
            ensurePlayer(element);
            attemptAutoplay();
            element.removeEventListener("canplay", handleCanPlay);
        };
        element.addEventListener("canplay", handleCanPlay);
    }
};

watch(
    [() => props.sourceUrl, () => props.streamUrl],
    () => {
        mountPlayer();
    },
    { immediate: true },
);

watch(
    () => props.posterUrl,
    () => {
        applyPoster();
    },
);

watch(
    () => props.autoplay,
    (nextAutoplay) => {
        if (nextAutoplay) {
            attemptAutoplay();
        }
    },
);

watch(
    () => props.subtitleTracks,
    () => {
        currentSourceUrl = "";
        destroyPlayer();
        mountPlayer();
    },
    { deep: true },
);

onMounted(() => {
    applyPoster();
    mountPlayer();
});

onBeforeUnmount(() => {
    currentSourceUrl = "";
    destroyPlayer();
});
</script>

<style scoped>
.chat-video-player,
.chat-video-player__element {
    width: 100%;
}

.chat-video-player__element {
    display: block;
    height: auto;
    max-height: min(72vh, 720px);
    border-radius: 14px;
    background: #0f172a;
}
</style>
