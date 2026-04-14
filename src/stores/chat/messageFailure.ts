import { getErrorMessage } from '@/utils/error'

type MessageFailureTarget = 'message' | 'asset'

const SCHEMA_ERROR_PATTERNS = ['消息参数非法', '请求格式错误', '格式错误', '参数非法', '不能为空']
const PERMISSION_ERROR_PATTERNS = ['没有权限', '无权限', '不是好友', '暂不支持发送', '禁止发送', '已被禁言', '不可发送']

export function getDirectConversationRemovedFailure(target: MessageFailureTarget) {
    if (target === 'asset') {
        return '你们已不是好友，当前私聊附件发送失败'
    }
    return '你们已不是好友，当前私聊消息发送失败'
}

export function getWebSocketUnavailableFailure(target: MessageFailureTarget) {
    if (target === 'asset') {
        return '附件发送失败，WebSocket 未就绪'
    }
    return '消息发送失败，WebSocket 未就绪'
}

export function getWebSocketDisconnectedFailure(target: MessageFailureTarget) {
    if (target === 'asset') {
        return 'WebSocket 未连接，当前无法发送附件'
    }
    return 'WebSocket 未连接，当前无法发送消息'
}

export function getMessageFailureHint(error: string | null | undefined) {
    const normalizedError = String(error || '').trim()
    if (!normalizedError) {
        return '发送失败，请重试'
    }
    if (SCHEMA_ERROR_PATTERNS.some((pattern) => normalizedError.includes(pattern))) {
        return '请重试或刷新'
    }
    if (PERMISSION_ERROR_PATTERNS.some((pattern) => normalizedError.includes(pattern))) {
        return '无权限发送'
    }
    return normalizedError
}

export function getMessageFailureDetail(error: string | null | undefined) {
    const normalizedError = String(error || '').trim()
    if (!normalizedError) {
        return ''
    }
    const hint = getMessageFailureHint(normalizedError)
    if (hint === normalizedError) {
        return ''
    }
    return normalizedError
}

export function getMessageFailureTooltip(error: string | null | undefined) {
    const hint = getMessageFailureHint(error)
    const detail = getMessageFailureDetail(error)
    if (!detail) {
        return hint
    }
    return `${hint}\n${detail}`
}

export function getMessageFailureToast(error: unknown, fallback = '发送失败，请重试') {
    return getMessageFailureHint(getErrorMessage(error, fallback))
}