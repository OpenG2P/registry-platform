"use client";

import { useState } from "react";

interface Props {
    open: boolean;
    title: string;
    description?: string;
    confirmText: string;
    required?: boolean;
    danger?: boolean;
    onCancel: () => void;
    onConfirm: (reason: string) => Promise<void> | void;
}

/** Asks for a reason before a correction, void, rejection or reopening. */
export default function ReasonDialog({ open, title, description, confirmText, required = true, danger, onCancel, onConfirm }: Props) {
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    if (!open) return null;

    const submit = async () => {
        setBusy(true);
        try {
            await onConfirm(reason.trim());
            setReason("");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-neutral-first/50 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md bg-neutral-second rounded-[16px] shadow-lg p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold">{title}</h2>
                {description && <p className="text-sm opacity-80">{description}</p>}
                <label htmlFor="activity-reason" className="text-sm font-medium">
                    Reason{required && <span className="text-toast-failed"> *</span>}
                </label>
                <textarea
                    id="activity-reason"
                    rows={3}
                    className="border border-secondary-second rounded-md px-3 py-2 bg-neutral-second text-sm"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    autoFocus
                />
                <div className="flex justify-end gap-3">
                    <button type="button" className="px-4 py-2 rounded-md border border-secondary-second text-sm" onClick={onCancel} disabled={busy}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={`px-4 py-2 rounded-md text-sm text-neutral-second ${danger ? "bg-toast-failed" : "bg-primary-first"} disabled:opacity-50`}
                        disabled={busy || (required && !reason.trim())}
                        onClick={submit}
                    >
                        {busy ? "Saving…" : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
