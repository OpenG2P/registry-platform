'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { TopBar } from '@/components/shared';
import MultiSectionAccordionForms from '@/features/intake-form/components/MultiSectionAccordionForms';
import { useRegister } from '@/context/RegisterContext';
import { useIntakeFormDetails } from '@/features/intake-form/hooks/useIntakeFormDetails';
import { useIntakeFormSubmission } from '@/features/intake-form/hooks/useIntakeFormSubmission';
import { useTranslations } from 'next-intl';
import { useIntakeFormSectionAction } from '@/features/intake-form/hooks/useIntakeFormSectionAction';
import { buildIntakeSectionsDataMap } from '@/features/shared/utils/intakeFormSectionDataMap';

export default function NewIntakeFormSubmissionPage() {
    const t = useTranslations();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const routeParams = useParams<{ type: string, intakeFormId: string }>();
    const intake_form_id = routeParams.intakeFormId;
    const registerType = routeParams.type;

    const sidFromParams = searchParams.get('sid');

    const initialSidRef = useRef(sidFromParams);

    const { currentRegister } = useRegister();
    const registerId = currentRegister?.register_id;

    const { sections, form_description, loading } = useIntakeFormDetails(intake_form_id);
    const { section_payloads, submission } = useIntakeFormSubmission(sidFromParams ?? undefined);

    const schemaData = useMemo(
        () => initialSidRef.current ? buildIntakeSectionsDataMap(section_payloads) : {},
        [section_payloads],
    );

    const { handleAction, FormActionModals, applicationReference, activeSubmissionId } = useIntakeFormSectionAction({
        registerId,
        formId: intake_form_id,
        registerType,
        submissionId: sidFromParams,
        initialSectionPayloads: section_payloads ?? null,
    });

    useEffect(() => {
        if (activeSubmissionId && !sidFromParams) {
            router.replace(`${pathname}?sid=${activeSubmissionId}`);
        }
    }, [activeSubmissionId, sidFromParams, pathname, router]);

    const displayReference = applicationReference || submission?.application_reference || '';

    return (
        <div className="min-h-screen mx-auto bg-secondary-first">
            <TopBar
                breadcrumb={[
                    {
                        label: t("register_form_submissions", { subject: currentRegister?.register_subject || t("register") }),
                        href: `/intake-form/${registerType}`
                    },
                    { label: displayReference }
                ]}

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
                    <MultiSectionAccordionForms
                        formDetailsCard={true}
                        sections={sections || []}
                        form_description={form_description}
                        schemaData={schemaData}
                        onAction={handleAction}
                        onCancel={() => router.push(`/intake-form/${registerType}`)}
                        registerType={registerType}
                        submissionId={activeSubmissionId || undefined}
                        formRegisterId={registerId}
                    />
                )}
            </div>

            <FormActionModals />
        </div>
    );
}
