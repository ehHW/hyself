import { describe, expect, it } from 'vitest'
import { buildAttachmentSendPayloadFromEntry, buildAttachmentSendPayloadFromUploadResult } from '@/utils/chatAttachment'

describe('chatAttachment', () => {
    it('builds payload from an existing resource-center asset entry', () => {
        const payload = buildAttachmentSendPayloadFromEntry({
            id: 7,
            display_name: '季度复盘.pdf',
            stored_name: 'stored.pdf',
            is_dir: false,
            parent_id: null,
            file_size: 4096,
            file_md5: 'md5',
            relative_path: 'users/demo/季度复盘.pdf',
            url: '/uploads/users/demo/季度复盘.pdf',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
            is_system: false,
            is_recycle_bin: false,
            recycled_at: null,
            expires_at: null,
            remaining_days: null,
            recycle_original_parent_id: null,
            asset_reference_id: 31,
            asset_reference: null,
            asset: {
                id: 9,
                file_md5: 'md5',
                sha256: null,
                storage_backend: 'local',
                storage_key: 'users/demo/季度复盘.pdf',
                mime_type: 'application/pdf',
                media_type: 'file',
                file_size: 4096,
                original_name: '季度复盘.pdf',
                extension: '.pdf',
                width: null,
                height: null,
                duration_seconds: null,
                extra_metadata: {},
                url: '/uploads/users/demo/季度复盘.pdf',
            },
        })

        expect(payload).toEqual({
            sourceAssetReferenceId: 31,
            displayName: '季度复盘.pdf',
            mediaType: 'file',
            mimeType: 'application/pdf',
            fileSize: 4096,
            url: '/uploads/users/demo/季度复盘.pdf',
            streamUrl: '',
            thumbnailUrl: '',
        })
    })

    it('builds payload from upload result so chunk-merge can send immediately', () => {
        const payload = buildAttachmentSendPayloadFromUploadResult(
            {
                mode: 'chunked',
                relativePath: 'users/demo/架构图.png',
                url: '/uploads/users/demo/架构图.png',
                assetReferenceId: 52,
                file: {
                    id: 13,
                    display_name: '架构图.png',
                    stored_name: 'stored.png',
                    is_dir: false,
                    parent_id: null,
                    file_size: 2048,
                    file_md5: 'md5',
                    relative_path: 'users/demo/架构图.png',
                    url: '/uploads/users/demo/架构图.png',
                    created_at: '2025-01-01T00:00:00Z',
                    updated_at: '2025-01-01T00:00:00Z',
                    is_system: false,
                    is_recycle_bin: false,
                    recycled_at: null,
                    expires_at: null,
                    remaining_days: null,
                    recycle_original_parent_id: null,
                    asset_reference_id: 52,
                    asset_reference: null,
                    asset: {
                        id: 14,
                        file_md5: 'md5',
                        sha256: null,
                        storage_backend: 'local',
                        storage_key: 'users/demo/架构图.png',
                        mime_type: 'image/png',
                        media_type: 'image',
                        file_size: 2048,
                        original_name: '架构图.png',
                        extension: '.png',
                        width: null,
                        height: null,
                        duration_seconds: null,
                        extra_metadata: {},
                        url: '/uploads/users/demo/架构图.png',
                    },
                },
            },
            {
                name: '架构图.png',
                size: 2048,
                type: 'image/png',
            },
        )

        expect(payload).toEqual({
            sourceAssetReferenceId: 52,
            displayName: '架构图.png',
            mediaType: 'image',
            mimeType: 'image/png',
            fileSize: 2048,
            url: '/uploads/users/demo/架构图.png',
            streamUrl: '',
            thumbnailUrl: '',
            processingStatus: '',
        })
    })
})
