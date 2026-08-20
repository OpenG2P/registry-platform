'use client';

import { TopBar, TabsLayout } from '@/components/shared';
import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRegister } from '@/context/RegisterContext';
import { useRbac } from '@/context/RbacContext';
import { INTAKE_FORM_ACTIONS } from '@/features/shared/permissions';
import { useIntakeFormSubmission } from '@/features/intake-form/hooks/useIntakeFormSubmission';
import { useIntakeFormDetails } from '@/features/intake-form/hooks/useIntakeFormDetails';
import { useIntakeFormDocuments } from '@/features/intake-form/hooks/useIntakeFormDocuments';
import { useIntakeFormSectionAction } from '@/features/intake-form/hooks/useIntakeFormSectionAction';
import MultiSectionAccordionForms from '@/features/intake-form/components/MultiSectionAccordionForms';
import SubmissionHeader from '@/features/intake-form/components/SubmissionHeader';
import { ApprovalList, ApprovalListSkeleton } from '@/features/approval/components';
import {
    useApprovalTasks,
    useSubmitApprovalDecision,
} from '@/features/approval/hooks';
import { parseAweCurrentStage } from '@/features/approval/utils/aweStatusSummary';
import { REGISTRY_INTAKE_FORM_ARTIFACT } from '@/features/approval/constants';
import { buildIntakeSectionsDataMap } from '@/features/shared/utils/intakeFormSectionDataMap';
import CRHeaderSkeleton from '@/features/change-request/components/CRHeaderSkeleton';
import SectionSchemaSkeleton from '@/features/change-request/components/SectionSchemaSkeleton';

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

    const { documents, loading: loadingDocuments } = useIntakeFormDocuments(submissionId);

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

    const { tasks, loadingTasks, refetchTasks } = useApprovalTasks(submission?.awe_request_id);

    const refreshAfterDecision = useCallback(async () => {
        await refetchTasks();
        await refetchSubmission();
    }, [refetchTasks, refetchSubmission]);

    const { submitDecision } = useSubmitApprovalDecision(
        intakeApprovalArtifactContext,
        refreshAfterDecision,
    );

    const intakeFormId = submission?.form_id;
    const { sections, form_description, loading: loadingSections } =
        useIntakeFormDetails(intakeFormId);

    const loading = loadingSubmission || (!sections && loadingSections);
    const isDraft = submission?.draft_status === 'DRAFT';

    const { handleAction, FormActionModals } = useIntakeFormSectionAction({
        registerId: submission?.register_id || '',
        formId: intakeFormId || '',
        registerType,
        submissionId,
        initialRecordName: submission?.record_name,
        onSuccess: () => {},
    });

    const breadcrumb = useMemo(() => {
        const applicationReference = submission?.application_reference?.trim() || '';

        if (breadcrumbOverride?.length) {
            return [
                ...breadcrumbOverride.slice(0, -1),
                { ...breadcrumbOverride[breadcrumbOverride.length - 1], label: applicationReference },
            ];
        }

        return [
            {
                label: t('register_form_submissions', {
                    subject: currentRegister?.register_subject || t('register'),
                }),
                href: `/intake-form/${registerType}`,
            },
            { label: applicationReference },
        ];
    }, [
        breadcrumbOverride,
        currentRegister?.register_subject,
        registerType,
        submission?.application_reference,
        t,
    ]);

    const sectionDataMap = useMemo(
        () => buildIntakeSectionsDataMap(section_payloads),
        [section_payloads]
    );

    const formContent = (
        <MultiSectionAccordionForms
            formDetailsCard={isDraft}
            form_description={form_description}
            sections={sections || []}
            schemaData={sectionDataMap}
            showActions={isDraft && canCreate}
            onAction={handleAction}
            submissionId={submissionId}
            formRegisterId={submission?.register_id || currentRegister?.register_id}
            registerType={registerType}
        />
    );

    if (isDraft) {
        return (
            <div className="min-h-screen mx-auto bg-secondary-first">
                <TopBar
                    breadcrumb={breadcrumb}
                    showFilters={false}
                    showPagination={false}
                    showCapsule={false}
                />

                <div className="mx-7.5">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <span className="text-neutral-first/50">{t('loading')}</span>
                        </div>
                    ) : (
                        <div className="w-full">
                            {formContent}
                        </div>
                    )}
                </div>

                <FormActionModals />
            </div>
        );
    }

    return (
        <TabsLayout breadcrumb={breadcrumb}>
            {!submission && (loadingSubmission || loadingDocuments) ? (
                <CRHeaderSkeleton />
            ) : (
                submission && (
                    <SubmissionHeader
                        submission={submission}
                        documents={documents}
                    />
                )
            )}

            <div className="mt-7.5 flex flex-col gap-6 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                    {loadingSections ? (
                        <SectionSchemaSkeleton />
                    ) : (
                        submission && formContent
                    )}
                </div>

                <div className="w-full min-w-0 shrink-0 lg:w-[320px]">
                    {loadingSubmission || (!!submission?.awe_request_id && loadingTasks) ? (
                        <ApprovalListSkeleton />
                    ) : (
                        <ApprovalList
                            tasks={tasks}
                            isPending={submission?.approval_status === 'PENDING'}
                            onSubmitDecision={submitDecision}
                            intakeForm
                        />
                    )}
                </div>
            </div>

            <FormActionModals />
        </TabsLayout>
    );
}
