'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { KeyValue } from '@/components/ui/KeyValue';
import { useRegister } from '@/context/RegisterContext';
import { ApprovalTask } from '@/features/approval/types/approval';

interface Props {
    task: ApprovalTask;
    index: number;
    href: string | null;
    onNavigate: (href: string) => void;
}

const taskStatusClassMap: Record<string, string> = {
    open: 'text-amber-500',
    claimed: 'text-amber-500',
    completed: 'text-toast-success',
    cancelled: 'text-toast-failed',
};

export default function TaskCard({ task, index, href, onNavigate }: Props) {
    const t = useTranslations();
    const { registers } = useRegister();
    const context = task.context ?? {};

    const translateKey = (value?: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return '—';
        if (t.has(trimmed)) return t(trimmed);
        const lower = trimmed.toLowerCase();
        if (lower !== trimmed && t.has(lower)) return t(lower);
        return trimmed;
    };

    const displayValue = (value?: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return '—';
        return trimmed;
    };

    const formatEnum = (value?: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return '—';
        if (t.has(trimmed)) return t(trimmed);
        const lower = trimmed.toLowerCase();
        if (lower !== trimmed && t.has(lower)) return t(lower);
        return trimmed
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const contextString = (key: string) => {
        const value = context[key];
        if (value === null || value === undefined || value === '') return '';
        return String(value);
    };

    const registerMnemonic = contextString('register_mnemonic');
    const matchedRegister = registers.find(
        (register) => register.register_mnemonic.toLowerCase() === registerMnemonic.toLowerCase(),
    );
    const registerLabel = matchedRegister?.register_subject
        ? translateKey(matchedRegister.register_subject)
        : translateKey(registerMnemonic);

    const sectionMnemonic =
        contextString('section_mnemonic') || contextString('intake_form_mnemonic');
    const recordName = displayValue(contextString('record_name'));
    const statusClass = taskStatusClassMap[task.status.toLowerCase()] ?? 'text-neutral-first/50';

    return (
        <div
            key={index}
            className="rounded-[10px] bg-neutral-second px-10 py-5"
        >
            <h3
                className="mb-4 min-h-[32px] truncate text-[24px] font-medium text-neutral-first"
                title={recordName !== '—' ? recordName : undefined}
            >
                {recordName}
            </h3>

            <div className="grid grid-cols-4 items-stretch gap-6 text-[16px] text-neutral-first/50">
                <div className="flex h-full min-h-0 flex-col">
                    <div className="flex flex-1 flex-col space-y-2">
                        <KeyValue
                            label={t('register')}
                            value={registerLabel}
                        />
                        <KeyValue
                            label={t('section')}
                            value={translateKey(sectionMnemonic)}
                        />
                    </div>
                </div>

                <div className="flex h-full min-h-0 flex-col">
                    <div className="flex flex-1 flex-col space-y-2 border-l-2 border-secondary-second pl-6">
                        <KeyValue
                            label={t('assignee_email')}
                            value={displayValue(task.assignee)}
                        />
                        <KeyValue
                            label={t('assignee_name')}
                            value={displayValue(task.assignee_name)}
                        />
                        <KeyValue
                            label={t('kind')}
                            value={formatEnum(task.kind)}
                        />
                    </div>
                </div>

                <div className="flex h-full min-h-0 flex-col">
                    <div className="flex flex-1 flex-col space-y-2 border-l-2 border-secondary-second pl-6">
                        <KeyValue
                            label={t('decision_action')}
                            value={formatEnum(task.decision_action)}
                        />
                        <KeyValue
                            label={t('status')}
                            value={formatEnum(task.status)}
                            valueClassName={statusClass}
                        />
                    </div>
                </div>

                <div className="flex h-full min-h-0 flex-col">
                    <div className="flex flex-1 flex-col space-y-2 border-l-2 border-secondary-second pl-6">
                        <KeyValue
                            label={t('created_at')}
                            value={
                                task.created_at
                                    ? new Date(task.created_at).toLocaleDateString()
                                    : '—'
                            }
                        />
                        <KeyValue
                            label={t('completed_at')}
                            value={
                                task.completed_at
                                    ? new Date(task.completed_at).toLocaleString()
                                    : '—'
                            }
                        />
                    </div>
                </div>
            </div>

            <div className="my-4 border-t border-secondary-second" />

            <div className="flex items-center justify-between">
                <button
                    type="button"
                    disabled={!href}
                    onClick={() => href && onNavigate(href)}
                    className="flex items-center gap-2 text-[14px] font-normal text-neutral-first opacity-60 transition hover:opacity-100 disabled:cursor-default disabled:opacity-40 disabled:hover:opacity-40"
                >
                    {t('view_details')}
                    <Image
                        src="/images/common/arrow_next_01.png"
                        alt=""
                        width={14}
                        height={14}
                    />
                </button>
            </div>
        </div>
    );
}
