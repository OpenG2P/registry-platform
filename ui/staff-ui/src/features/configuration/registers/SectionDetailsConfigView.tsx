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
        <div className="flex flex-1 flex-col min-h-0 mx-8 mt-6 mb-6 overflow-hidden rounded-[10px] bg-neutral-second px-8 pb-8 pt-12">
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
