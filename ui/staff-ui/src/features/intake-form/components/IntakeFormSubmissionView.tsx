'use client';

import { TopBar } from '@/components/shared';
import { useIntakeFormSubmission } from '@/features/intake-form/hooks/useIntakeFormSubmission';
import { useIntakeFormDetails } from '@/features/intake-form/hooks/useIntakeFormDetails';
import MultiSectionAccordionForms from '@/features/intake-form/components/MultiSectionAccordionForms';
import SubmissionHeader from '@/features/intake-form/components/SubmissionHeader';
import { IntakeApprovalCard } from '@/features/approval/components';
import { parseAweCurrentStage } from '@/features/approval/utils/aweStatusSummary';
import { REGISTRY_INTAKE_FORM_ARTIFACT } from '@/features/approval/constants';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useIntakeFormSectionAction } from '@/features/intake-form/hooks/useIntakeFormSectionAction';
import { buildIntakeSectionsDataMap } from '@/features/shared/utils/intakeFormSectionDataMap';
import { useRegister } from '@/context/RegisterContext';
import { useRbac } from '@/context/RbacContext';
import { INTAKE_FORM_ACTIONS } from '@/features/shared/permissions';

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface IntakeFormSubmissionViewProps {
    registerType: string;
    submissionId: string;
    breadcrumb?: BreadcrumbItem[];
}

export default function IntakeFormSubmissionView({
    registerType,
    submissionId,
    breadcrumb: breadcrumbOverride,
}: IntakeFormSubmissionViewProps) {
    const t = useTranslations();
    const { currentRegister } = useRegister();
    const { can } = useRbac();
    const canCreate = can(INTAKE_FORM_ACTIONS.edit);

    const {
        submission,
        section_payloads,
        loading: loadingSubmission,
        refetchSubmission,
    } = useIntakeFormSubmission(submissionId);

    const intakeApprovalArtifactContext = useMemo(() => {
        if (!submission?.submission_id) return null;
        const currentStage =
            parseAweCurrentStage(submission.awe_request_status_summary) ?? 1;
        return {
            artifactId: submission.submission_id,
            artifactType: REGISTRY_INTAKE_FORM_ARTIFACT,
            currentStage,
        };
    }, [submission?.submission_id, submission?.awe_request_status_summary]);

    const intakeFormId = submission?.form_id;
    const { sections, form_name, form_description, loading: loadingSections } =
        useIntakeFormDetails(intakeFormId);

    const loading = loadingSubmission || (!sections && loadingSections);
    const isDraft = submission?.draft_status === 'DRAFT';

    const { handleAction, FormActionModals, recordName } = useIntakeFormSectionAction({
        registerId: submission?.register_id || '',
        formId: intakeFormId || '',
        registerType,
        submissionId,
        initialRecordName: submission?.record_name,
        onSuccess: () => {},
    });

    const breadcrumb = useMemo(() => {
        if (breadcrumbOverride) {
            return breadcrumbOverride;
        }

        return [
            {
                label: t('register_intake_form', {
                    subject: currentRegister?.register_subject || t('register'),
                }),
                href: `/intake-form/${registerType}`,
            },
            { label: recordName || '—' },
        ];
    }, [
        breadcrumbOverride,
        currentRegister?.register_subject,
        registerType,
        recordName,
        t,
    ]);

    const sectionDataMap = useMemo(
        () => buildIntakeSectionsDataMap(section_payloads),
        [section_payloads]
    );

    return (
        <div className="min-h-screen mx-auto bg-secondary-first">
            <TopBar
                breadcrumb={breadcrumb}
                showFilters={false}
                showPagination={false}
                showCapsule={false}
            />

            <div className={`mx-7.5 ${isDraft ? '' : 'py-6 space-y-6'}`}>
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <span className="text-neutral-first/50">{t('loading')}</span>
                    </div>
                ) : (
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className={`w-full ${isDraft ? '' : 'lg:w-[75%]'} space-y-6`}>
                            {!isDraft && (
                                <SubmissionHeader
                                    submission={submission}
                                />
                            )}

                            <MultiSectionAccordionForms
                                form_name={form_name}
                                form_description={form_description}
                                sections={sections || []}
                                schemaData={sectionDataMap}
                                showActions={isDraft && canCreate}
                                onAction={handleAction}
                                submissionId={submissionId}
                                formRegisterId={submission?.register_id || currentRegister?.register_id}
                                registerType={registerType}
                            />
                        </div>

                        {!isDraft && (
                            <div className="w-full lg:w-[25%] space-y-6">
                                <IntakeApprovalCard
                                    awe_request_id={submission?.awe_request_id}
                                    artifactContext={intakeApprovalArtifactContext}
                                    isPending={
                                        !isDraft && submission?.approval_status === 'PENDING'
                                    }
                                    onRefresh={refetchSubmission}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <FormActionModals />
        </div>
    );
}