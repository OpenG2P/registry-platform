'use client';

import { useTranslations } from 'next-intl';
import { StackedCard } from '@/components/shared';
import { useRegister } from '@/context/RegisterContext';
import { ApprovalTask } from '@/features/approval/types/approval';

interface Props {
    task: ApprovalTask;
    href: string | null;
    onNavigate: (href: string) => void;
}

const taskStatusClassMap: Record<string, string> = {
    open: 'text-amber-500',
    claimed: 'text-amber-500',
    completed: 'text-toast-success',
    cancelled: 'text-toast-failed',
};

export default function TaskCard({ task, href, onNavigate }: Props) {
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

    return (
        <StackedCard
            title={contextString('record_name')}
            onViewDetails={href ? () => onNavigate(href) : undefined}
            viewDetailsDisabled={!href}
            columns={[
                {
                    fields: [
                        { label: t('register'), value: registerLabel },
                        { label: t('section'), value: translateKey(sectionMnemonic) },
                    ],
                },
                {
                    fields: [
                        { label: t('assignee'), value: displayValue(task.assignee) },
                        { label: t('assignee_name'), value: displayValue(task.assignee_name) },
                        { label: t('kind'), value: formatEnum(task.kind) },
                    ],
                },
                {
                    fields: [
                        { label: t('decision_action'), value: formatEnum(task.decision_action) },
                        {
                            label: t('status'),
                            value: formatEnum(task.status),
                            valueClassName:
                                taskStatusClassMap[task.status.toLowerCase()] ?? 'text-neutral-first/50',
                        },
                    ],
                },
                {
                    fields: [
                        {
                            label: t('created_at'),
                            value: task.created_at
                                ? new Date(task.created_at).toLocaleDateString()
                                : '—',
                        },
                        {
                            label: t('completed_at'),
                            value: task.completed_at
                                ? new Date(task.completed_at).toLocaleString()
                                : '—',
                        },
                    ],
                },
            ]}
        />
    );
}
