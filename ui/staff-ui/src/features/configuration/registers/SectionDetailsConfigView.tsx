'use client';
import { SectionBuilder } from '@openg2p/registry-widgets';
import type { BuilderNotifyType, SectionConfig } from '@openg2p/registry-widgets';
import { useFetch } from '@/shared/hooks';
import { RegistryWidgetProvider } from '@/shared/widgets';
import { toast } from 'react-toastify';
import { useTranslations } from "next-intl";

interface SectionDetailsConfigViewProps {
    sectionUISchema: any;
    registerId: string;
    sectionId: string;
    isCoreSection?: boolean;
}

const notify = (message: string, type: BuilderNotifyType) => {
    const options = {
        position: 'top-right' as const,
        className: 'rounded-[15px] shadow-xl border border-secondary-first',
    };

    switch (type) {
        case 'success':
            toast.success(message, options);
            break;
        case 'error':
            toast.error(message, options);
            break;
        case 'warn':
            toast.warn(message, options);
            break;
        default:
            toast.info(message, options);
            break;
    }
};

export default function SectionDetailsConfigView({
    sectionUISchema,
    registerId,
    sectionId,
    isCoreSection = false,
}: SectionDetailsConfigViewProps) {
    const t = useTranslations();
    const { execute: updateUISchema } = useFetch();

    const handleSectionChange = (_updatedSection: SectionConfig) => {
    };

    const handleSave = async (updatedSection: SectionConfig) => {
        if (isCoreSection) {
            toast.info(t('core_section_warning') || 'This is a core section, UI schema cannot be modified.', {
                position: "top-right",
                className: 'rounded-[15px] shadow-xl border border-secondary-first',
            });
            return;
        }

        if (!registerId || !sectionId) {
            toast.error(t('toast_section_info_missing') || 'Missing required section information');
            return;
        }

        const result = await updateUISchema('/api/configuration/registers/section-metadata/update-section-ui-schema', {
            method: 'POST',
            body: JSON.stringify({
                section_id: sectionId,
                register_id: registerId,
                section_ui_schema: updatedSection,
            })
        });

        if (result?.section_id) {
            toast.success(t('toast_section_ui_updated') || 'Section UI schema updated successfully');
        }
    };

    return (
        <div className="mx-3 mb-4 mt-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] bg-neutral-second px-3 pb-4 pt-4 sm:mx-6 sm:px-6 lg:mx-8 lg:mb-6 lg:mt-6 lg:px-8 lg:pb-8 lg:pt-12">
            <RegistryWidgetProvider>
                <SectionBuilder
                    initialSection={sectionUISchema}
                    onChange={handleSectionChange}
                    onSave={handleSave}
                    onNotify={notify}
                />
            </RegistryWidgetProvider>
        </div>
    );
}
