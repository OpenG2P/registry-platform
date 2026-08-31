'use client';

/**
 * Check a credential a citizen has presented.
 *
 * One screen, one question: is this card genuine? The agent uploads the printed
 * PDF or a photo of it, the QR is read here in the browser, and only the
 * payload goes to the server.
 */

import { useCallback, useRef, useState } from 'react';

import { ApiError, api, type VerificationResult } from '@/api/client';

import { readQrFromFile } from './qr-reader';

const ACCEPT = '.pdf,image/png,image/jpeg';

export default function VerifyFlow() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<VerificationResult | null>(null);
    const [filename, setFilename] = useState('');
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(async (file: File) => {
        setBusy(true);
        setError('');
        setResult(null);
        setFilename(file.name);
        try {
            const payload = await readQrFromFile(file);
            if (!payload) {
                // Distinguish "could not read it" from "it is not genuine".
                // Telling an agent a card is invalid when the photo was blurry
                // would have them turn away someone holding a good credential.
                setError(
                    'No QR code could be read from that file. Try a clearer photo, ' +
                        'or upload the original PDF.',
                );
                return;
            }
            setResult(await api.verify(payload));
        } catch (e) {
            setError(
                e instanceof ApiError
                    ? `${e.message} (${e.code})`
                    : 'The file could not be read.',
            );
        } finally {
            setBusy(false);
        }
    }, []);

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
        },
        [handleFile],
    );

    return (
        <section className="card">
            <h2>Verify a credential</h2>
            <p className="muted">
                Upload the printed credential (PDF) or a photo of it. The QR code is read
                on this device — the image is never uploaded.
            </p>

            <div
                className={`dropzone${dragging ? ' is-dragging' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
                }}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPT}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                        // Reset so re-selecting the same file fires change again.
                        e.target.value = '';
                    }}
                />
                {busy ? (
                    <span>Reading…</span>
                ) : (
                    <>
                        <div style={{ fontSize: '1.6rem' }} aria-hidden="true">
                            ⬆
                        </div>
                        <div>
                            <strong>Choose a file</strong> or drop it here
                        </div>
                        <div className="muted" style={{ fontSize: '0.85rem' }}>
                            PDF, PNG or JPEG
                        </div>
                    </>
                )}
            </div>

            {filename && !busy && (
                <p className="muted" style={{ marginTop: '0.75rem' }}>
                    {filename}
                </p>
            )}

            {error && (
                <p className="error" role="alert" style={{ marginTop: '1rem' }}>
                    {error}
                </p>
            )}

            {result && (
                <div style={{ marginTop: '1.25rem' }}>
                    <div
                        className={`verdict ${result.verified ? 'verdict-ok' : 'verdict-bad'}`}
                        role="status"
                    >
                        <span className="verdict-icon" aria-hidden="true">
                            {result.verified ? '✓' : '✕'}
                        </span>
                        <span>
                            {result.verified
                                ? 'Valid — signed by a trusted issuer'
                                : 'Not valid'}
                            {result.status ? ` (${result.status})` : ''}
                        </span>
                    </div>

                    {/* The signature being good is not the whole question: the agent
                        still has to see that the card belongs to the person holding
                        it. */}
                    {result.claims && Object.keys(result.claims).length > 0 && (
                        <>
                            <h3>Credential contents</h3>
                            <dl className="facts">
                                {Object.entries(result.claims).map(([k, v]) => (
                                    <div key={k}>
                                        <dt>{k}</dt>
                                        <dd>{String(v)}</dd>
                                    </div>
                                ))}
                            </dl>
                        </>
                    )}
                </div>
            )}
        </section>
    );
}
