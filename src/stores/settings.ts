import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { permissionContextApi } from '@/api/user'
import { getChatSettingsApi, updateChatSettingsApi } from '@/api/chat'
import type { ChatPreferencePayload } from '@/types/chat'
import type { PermissionContext } from '@/types/user'

export interface AppSettings {
    systemTitle: string
    themeMode: 'light' | 'dark'
    chatReceiveNotification: boolean
    chatListSortMode: 'recent' | 'unread'
    chatStealthInspectEnabled: boolean
    chatSendHotkey: 'enter' | 'ctrl_enter'
    chatLayout: ChatLayoutSettings
}

export interface ChatLayoutSettings {
    menuWidth: number
    listWidth: number
    composerHeight: number
}

const defaultChatLayout: ChatLayoutSettings = {
    menuWidth: 72,
    listWidth: 320,
    composerHeight: 188,
}

const defaultSettings: AppSettings = {
    systemTitle: 'Hyself 管理后台',
    themeMode: 'light',
    chatReceiveNotification: true,
    chatListSortMode: 'recent',
    chatStealthInspectEnabled: false,
    chatSendHotkey: 'ctrl_enter',
    chatLayout: { ...defaultChatLayout },
}

export const useSettingsStore = defineStore(
    'settings',
    () => {
        const settings = ref<AppSettings>({ ...defaultSettings })
        let systemSettingsHydrated = false
        let chatPreferencesHydrated = false

        const save = (next: Partial<AppSettings>) => {
            settings.value = {
                ...settings.value,
                ...next,
                themeMode: normalizeThemeMode(next.themeMode ?? settings.value.themeMode),
                chatListSortMode: normalizeChatListSortMode(next.chatListSortMode ?? settings.value.chatListSortMode),
                chatReceiveNotification: normalizeBoolean(next.chatReceiveNotification, settings.value.chatReceiveNotification),
                chatStealthInspectEnabled: normalizeBoolean(next.chatStealthInspectEnabled, settings.value.chatStealthInspectEnabled),
                chatSendHotkey: normalizeChatSendHotkey(next.chatSendHotkey ?? settings.value.chatSendHotkey),
                chatLayout: normalizeChatLayout(next.chatLayout ?? settings.value.chatLayout),
            }
        }

        const reset = () => {
            settings.value = { ...defaultSettings }
        }

        const applySessionContext = (context: Pick<PermissionContext, 'system' | 'chat'> | null | undefined) => {
            if (context?.system) {
                save({
                    systemTitle: normalizeSystemTitle(context.system.system_title),
                })
                systemSettingsHydrated = true
            }
            if (context?.chat) {
                save(buildChatPreferencePatch(context.chat))
                chatPreferencesHydrated = true
            }
        }

        const loadSystemSettings = async () => {
            if (!systemSettingsHydrated) {
                const { data } = await permissionContextApi()
                applySessionContext(data)
            }
            return {
                system_title: settings.value.systemTitle,
            }
        }

        const systemTitle = computed(() => settings.value.systemTitle)
        const themeMode = computed(() => settings.value.themeMode)
        const chatReceiveNotification = computed(() => settings.value.chatReceiveNotification)
        const chatListSortMode = computed(() => settings.value.chatListSortMode)
        const chatStealthInspectEnabled = computed(() => settings.value.chatStealthInspectEnabled)
        const chatSendHotkey = computed(() => settings.value.chatSendHotkey)
        const chatLayout = computed(() => settings.value.chatLayout)

        const loadChatPreferences = async (options?: { force?: boolean }) => {
            if (chatPreferencesHydrated && !options?.force) {
                return buildChatPreferencePayload(settings.value)
            }
            const { data } = await getChatSettingsApi()
            save(buildChatPreferencePatch(data))
            chatPreferencesHydrated = true
            return data
        }

        const loadSessionSettings = async (options?: { includeChatPreferences?: boolean; forceChatPreferences?: boolean }) => {
            const includeChatPreferences = options?.includeChatPreferences ?? true
            const needsBootstrap = !systemSettingsHydrated || (includeChatPreferences && (!chatPreferencesHydrated || Boolean(options?.forceChatPreferences)))

            if (needsBootstrap) {
                const { data } = await permissionContextApi()
                applySessionContext(data)
            }

            if (includeChatPreferences && (!chatPreferencesHydrated || Boolean(options?.forceChatPreferences))) {
                await loadChatPreferences({ force: true })
            }
            return {
                system: {
                    system_title: settings.value.systemTitle,
                },
                chat: buildChatPreferencePayload(settings.value),
            }
        }

        const markSessionSettingsStale = () => {
            systemSettingsHydrated = false
            chatPreferencesHydrated = false
        }

        const saveChatPreferences = async (next?: Partial<AppSettings>) => {
            if (next) {
                save(next)
            }
            const { data } = await updateChatSettingsApi({
                theme_mode: settings.value.themeMode,
                chat_receive_notification: settings.value.chatReceiveNotification,
                chat_list_sort_mode: settings.value.chatListSortMode,
                chat_stealth_inspect_enabled: settings.value.chatStealthInspectEnabled,
                settings_json: {
                    chat_send_hotkey: settings.value.chatSendHotkey,
                    chat_layout: settings.value.chatLayout,
                },
            })
            const settingsJson = (data.settings_json || {}) as Record<string, unknown>
            save({
                themeMode: data.theme_mode,
                chatReceiveNotification: data.chat_receive_notification,
                chatListSortMode: data.chat_list_sort_mode,
                chatStealthInspectEnabled: data.chat_stealth_inspect_enabled,
                chatSendHotkey: normalizeChatSendHotkey(typeof settingsJson.chat_send_hotkey === 'string' ? settingsJson.chat_send_hotkey : undefined),
                chatLayout: normalizeChatLayout(settingsJson.chat_layout ?? settings.value.chatLayout),
            })
            chatPreferencesHydrated = true
            return data
        }

        return {
            settings,
            systemTitle,
            themeMode,
            chatReceiveNotification,
            chatListSortMode,
            chatStealthInspectEnabled,
            chatSendHotkey,
            chatLayout,
            save,
            reset,
            loadSystemSettings,
            loadChatPreferences,
            loadSessionSettings,
            applySessionContext,
            markSessionSettingsStale,
            saveChatPreferences,
        }
    },
    {
        persist: true,
    },
)

function normalizeThemeMode(value: AppSettings['themeMode'] | undefined): AppSettings['themeMode'] {
    return value === 'dark' ? 'dark' : 'light'
}

function normalizeSystemTitle(value: string | undefined): string {
    return String(value || '').trim() || defaultSettings.systemTitle
}

function normalizeChatListSortMode(value: AppSettings['chatListSortMode'] | undefined): AppSettings['chatListSortMode'] {
    return value === 'unread' ? 'unread' : 'recent'
}

function normalizeBoolean(value: boolean | undefined, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback
}

function normalizeChatSendHotkey(value: string | undefined): AppSettings['chatSendHotkey'] {
    return value === 'enter' ? 'enter' : 'ctrl_enter'
}

function normalizeChatLayout(value: unknown): ChatLayoutSettings {
    if (!value || typeof value !== 'object') {
        return { ...defaultChatLayout }
    }
    const next = value as Partial<ChatLayoutSettings>
    return {
        menuWidth: clampLayoutNumber(next.menuWidth, defaultChatLayout.menuWidth, 64, 120),
        listWidth: clampLayoutNumber(next.listWidth, defaultChatLayout.listWidth, 260, 480),
        composerHeight: clampLayoutNumber(next.composerHeight, defaultChatLayout.composerHeight, 176, 320),
    }
}

function clampLayoutNumber(value: unknown, fallback: number, min: number, max: number): number {
    const normalized = typeof value === 'number' && Number.isFinite(value) ? value : fallback
    return Math.min(max, Math.max(min, Math.round(normalized)))
}

function buildChatPreferencePatch(data: ChatPreferencePayload): Partial<AppSettings> {
    const settingsJson = (data.settings_json || {}) as Record<string, unknown>
    return {
        themeMode: data.theme_mode,
        chatReceiveNotification: data.chat_receive_notification,
        chatListSortMode: data.chat_list_sort_mode,
        chatStealthInspectEnabled: data.chat_stealth_inspect_enabled,
        chatSendHotkey: normalizeChatSendHotkey(typeof settingsJson.chat_send_hotkey === 'string' ? settingsJson.chat_send_hotkey : undefined),
        chatLayout: normalizeChatLayout(settingsJson.chat_layout),
    }
}

function buildChatPreferencePayload(settings: AppSettings): ChatPreferencePayload {
    return {
        theme_mode: settings.themeMode,
        chat_receive_notification: settings.chatReceiveNotification,
        chat_list_sort_mode: settings.chatListSortMode,
        chat_stealth_inspect_enabled: settings.chatStealthInspectEnabled,
        settings_json: {
            chat_send_hotkey: settings.chatSendHotkey,
            chat_layout: settings.chatLayout,
        },
    }
}
