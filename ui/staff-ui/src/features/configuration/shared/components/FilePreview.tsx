'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDocuments } from '@/features/shared/hooks';

const TEMPLATE_EXTENSION = '.json.j2';

interface Props {
    documentId?: string;
}

function isJsonJ2(filename?: string) {
    return Boolean(filename?.toLowerCase().endsWith(TEMPLATE_EXTENSION));
}

function downloadText(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
}

function downloadFromUrl(filename: string, url: string) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

export default function FilePreview({ documentId }: Props) {
    const t = useTranslations();
    const { getDocument } = useDocuments();
    const [displayLabel, setDisplayLabel] = useState('');
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [content, setContent] = useState<string | null>(null);
    const [presignedUrl, setPresignedUrl] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!documentId) {
            setDisplayLabel('');
            return;
        }

        let cancelled = false;
        setDisplayLabel('');

        getDocument(documentId).then((document) => {
            if (cancelled) return;
            setDisplayLabel(document?.source_filename || document?.label || '');
        });

        return () => {
            cancelled = true;
        };
    }, [documentId, getDocument]);

    useEffect(() => {
        if (!open || !documentId) return;

        let cancelled = false;
        setLoading(true);
        setContent(null);
        setPresignedUrl(null);

        getDocument(documentId).then(async (document) => {
            if (cancelled) return;

            if (!document) {
                setLoading(false);
                return;
            }

            const filename = document.source_filename || document.label || displayLabel;
            const url = document.presigned_url ?? null;
            if (filename) setDisplayLabel(filename);
            setPresignedUrl(url);

            if (!url || !isJsonJ2(filename)) {
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error('Failed to load file');
                }
                const text = await response.text();
                if (cancelled) return;
                if (!text.includes('\0')) {
                    setContent(text);
                }
            } catch {
                if (!cancelled) setContent(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [open, documentId, getDocument]);

    useEffect(() => {
        if (!open) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open]);

    const title = displayLabel || t('template');
    const canDownload = content !== null || Boolean(presignedUrl);
    const unavailableMessage = t.has('unable_to_preview_file')
        ? t('unable_to_preview_file')
        : 'Unable to preview this file.';

    const handleDownload = () => {
        if (content !== null) {
            downloadText(title, content);
            return;
        }
        if (presignedUrl) {
            downloadFromUrl(title, presignedUrl);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!documentId) return;
                    setOpen(true);
                }}
                disabled={!documentId}
                className="truncate text-neutral-first transition-colors hover:text-toast-info hover:underline disabled:opacity-50"
                title={displayLabel}
            >
                {displayLabel}
            </button>

            {open && mounted && createPortal(
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-neutral-first/80 p-4"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="relative flex max-h-[85vh] w-full max-w-200 flex-col rounded-[10px] border-5 border-primary-first bg-neutral-second px-8 py-6"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between gap-4">
                            <h2 className="truncate text-[24px] font-medium text-primary-second" title={title}>
                                {title}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="opacity-50 transition hover:opacity-100"
                                aria-label={t('close')}
                            >
                                <X size={30} />
                            </button>
                        </div>

                        <div className="message-json-scroll min-h-[240px] flex-1 overflow-auto rounded-[10px] bg-secondary-second/50 px-6 py-4">
                            {loading ? (
                                <div className="flex h-full min-h-[200px] items-center justify-center">
                                    <div
                                        className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-second"
                                        role="status"
                                        aria-label={t('loading')}
                                    />
                                </div>
                            ) : content !== null ? (
                                <pre className="whitespace-pre text-[14px] text-neutral-first">{content}</pre>
                            ) : (
                                <p className="text-[16px] text-neutral-first/70">
                                    {unavailableMessage}
                                </p>
                            )}
                        </div>

                        <div className="mt-4 flex gap-4">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="rounded-[10px] bg-secondary-second px-6 py-2 text-[16px] font-bold text-neutral-first/50"
                            >
                                {t('close')}
                            </button>
                            <button
                                type="button"
                                onClick={handleDownload}
                                disabled={!canDownload || loading}
                                className="rounded-[10px] bg-neutral-first px-6 py-2 text-[16px] font-bold text-neutral-second disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {t('download')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
