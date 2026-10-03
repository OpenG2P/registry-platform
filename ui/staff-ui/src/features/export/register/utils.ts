import type { ExportQueueRecord } from './types';

const IN_PROGRESS_STATUSES = new Set(['PENDING', 'QUEUED', 'PROCESSING', 'IN_PROGRESS']);

export function isExportInProgress(record: ExportQueueRecord): boolean {
    return IN_PROGRESS_STATUSES.has(String(record.export_status || '').toUpperCase());
}

export function isDownloadExpired(record: ExportQueueRecord): boolean {
    if (!record.file_url_expires_at) return false;
    const expires = new Date(record.file_url_expires_at).getTime();
    return Number.isFinite(expires) && Date.now() > expires;
}
