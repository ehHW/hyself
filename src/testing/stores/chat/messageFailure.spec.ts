import { describe, expect, it } from 'vitest'
import {
    getDirectConversationRemovedFailure,
    getMessageFailureDetail,
    getMessageFailureHint,
    getMessageFailureToast,
    getMessageFailureTooltip,
    getWebSocketDisconnectedFailure,
    getWebSocketUnavailableFailure,
} from '@/stores/chat/messageFailure'

describe('getMessageFailureHint', () => {
    it('maps schema-like errors to retry or refresh guidance', () => {
        expect(getMessageFailureHint('消息参数非法')).toBe('请重试或刷新')
        expect(getMessageFailureHint('task_id 不能为空')).toBe('请重试或刷新')
    })

    it('maps permission-like errors to no-permission guidance', () => {
        expect(getMessageFailureHint('你们还不是好友，当前私聊暂不支持发送附件')).toBe('无权限发送')
        expect(getMessageFailureHint('当前没有权限执行该操作')).toBe('无权限发送')
    })

    it('preserves business errors and fallback copy', () => {
        expect(getMessageFailureHint('该消息已撤回，无法回复')).toBe('该消息已撤回，无法回复')
        expect(getMessageFailureHint('')).toBe('发送失败，请重试')
    })

    it('keeps raw detail only when ui hint differs from source error', () => {
        expect(getMessageFailureDetail('消息参数非法')).toBe('消息参数非法')
        expect(getMessageFailureDetail('你们还不是好友，当前私聊暂不支持发送附件')).toBe('你们还不是好友，当前私聊暂不支持发送附件')
        expect(getMessageFailureDetail('该消息已撤回，无法回复')).toBe('')
        expect(getMessageFailureTooltip('消息参数非法')).toBe('请重试或刷新\n消息参数非法')
    })

    it('maps unknown errors to the same toast hint contract', () => {
        expect(getMessageFailureToast(new Error('消息参数非法'))).toBe('请重试或刷新')
        expect(getMessageFailureToast({ response: { data: { message: '你们还不是好友，当前私聊暂不支持发送附件' } } })).toBe('无权限发送')
        expect(getMessageFailureToast(null)).toBe('发送失败，请重试')
    })

    it('centralizes sync send failure source messages', () => {
        expect(getDirectConversationRemovedFailure('message')).toBe('你们已不是好友，当前私聊消息发送失败')
        expect(getDirectConversationRemovedFailure('asset')).toBe('你们已不是好友，当前私聊附件发送失败')
        expect(getWebSocketDisconnectedFailure('message')).toBe('WebSocket 未连接，当前无法发送消息')
        expect(getWebSocketDisconnectedFailure('asset')).toBe('WebSocket 未连接，当前无法发送附件')
        expect(getWebSocketUnavailableFailure('message')).toBe('消息发送失败，WebSocket 未就绪')
        expect(getWebSocketUnavailableFailure('asset')).toBe('附件发送失败，WebSocket 未就绪')
    })
})