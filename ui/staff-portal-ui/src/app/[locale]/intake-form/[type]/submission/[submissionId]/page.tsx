'use client';

import { useParams } from 'next/navigation';
import IntakeFormSubmissionView from '@/features/intake-form/components/IntakeFormSubmissionView';

export default function IntakeFormSubmissionPage() {
    const routeParams = useParams<{ type: string; submissionId: string }>();
    const submissionId = routeParams.submissionId;
    const registerType = routeParams.type;

    return (
        <IntakeFormSubmissionView
            registerType={registerType}
            submissionId={submissionId}
        />
    );
}
