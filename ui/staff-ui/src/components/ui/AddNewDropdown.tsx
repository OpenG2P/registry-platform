'use client';

import { useState, useRef } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useParams } from 'next/navigation';

import { useIntakeForms } from '@/features/intake-form/hooks/useIntakeForms';
import { useRegister } from '@/context/RegisterContext';
import { useVCConfigs } from '@/features/register/hooks/useVCConfigs';
import { useClickOutside } from '@/shared/hooks';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import ImportModal from '@/features/intake-form/components/ImportModal';
import { useImportFileConfigs } from '@/features/intake-form/hooks/useImportFileConfigs';

const VpVerificationModal = dynamic(
    () => import('@/features/verifiable-credentials/components/VpVerificationModal'),
    { ssr: false }
);

type Mechanism = {
    mechanism_id: string;
    mechanism_type: 'INTAKE_FORM' | 'IMPORT_FILE' | 'VERIFIABLE_CREDENTIAL';
    display_key: string;
};

type Props = {
    mechanisms?: any[];
    loading?: boolean;
};

type MechanismMenuProps = {
    mechanisms: Mechanism[];
    loading: boolean;
    onSelectForm: (formId: string) => void;
    onSelectImport: (file: any) => void;
    onSelectVC: (vc: any) => void;
};

function MechanismMenu({
    mechanisms,
    loading,
    onSelectForm,
    onSelectImport,
    onSelectVC,
}: MechanismMenuProps) {
    const t = useTranslations();
    const { currentRegister } = useRegister();
    const registerId = currentRegister?.register_id;

    const { forms, loading: formsLoading } = useIntakeForms(registerId);
    const { vcOptions, isLoadingVCs } = useVCConfigs();
    const { importFileOptions, isLoadingImportFiles } = useImportFileConfigs();

    const renderSubMenu = (mechanism: Mechanism) => {
        switch (mechanism.mechanism_type) {
            case 'INTAKE_FORM':
                if (formsLoading) {
                    return (
                        <div className="px-4 py-1 text-[16px] text-neutral-first/50">
                            {t('loading')}
                        </div>
                    );
                }

                if (!forms?.length) {
                    return (
                        <div className="px-4 py-1 text-[16px] text-neutral-first/50">
                            {t('no_options_available')}
                        </div>
                    );
                }

                return forms.map((form: any) => {
                    const label = t.has(form.form_mnemonic) ? t(form.form_mnemonic) : form.form_mnemonic;
                    return (
                        <div
                            key={form.form_id}
                            onClick={() => onSelectForm(form.form_id)}
                            className="px-4 py-1 font-medium hover:bg-secondary-second cursor-pointer truncate text-[16px]"
                            title={label}
                        >
                            {label}
                        </div>
                    );
                });

            case 'IMPORT_FILE':
                if (isLoadingImportFiles) {
                    return (
                        <div className="px-4 py-1 text-[16px] text-neutral-first/50">
                            {t('loading')}
                        </div>
                    );
                }

                if (!importFileOptions?.length) {
                    return (
                        <div className="px-4 py-1 text-[16px] text-neutral-first/50">
                            {t('no_options_available')}
                        </div>
                    );
                }

                return importFileOptions.map((file: any) => {
                    const label = t.has(file.import_file_template_mnemonic)
                        ? t(file.import_file_template_mnemonic)
                        : file.import_file_template_mnemonic;
                    return (
                        <div
                            key={file.import_file_configuration_id}
                            onClick={() => onSelectImport(file)}
                            className="px-4 py-1 font-medium hover:bg-secondary-second cursor-pointer text-[16px] truncate"
                            title={label}
                        >
                            {label}
                        </div>
                    );
                });

            case 'VERIFIABLE_CREDENTIAL':
                if (isLoadingVCs) {
                    return (
                        <div className="px-4 py-1 text-[16px] text-neutral-first/50">
                            {t('loading')}
                        </div>
                    );
                }

                if (!vcOptions?.length) {
                    return (
                        <div className="px-4 py-1 text-[16px] text-neutral-first/50">
                            {t('no_options_available')}
                        </div>
                    );
                }

                return vcOptions.map((vc: any) => {
                    const vcLabel = t.has(vc.vc_mnemonic) ? t(vc.vc_mnemonic) : vc.vc_mnemonic;
                    const dataModelLabel = t.has(vc.data_model_mnemonic)
                        ? t(vc.data_model_mnemonic)
                        : vc.data_model_mnemonic;
                    const formLabel = t.has(vc.intake_form_mnemonic)
                        ? t(vc.intake_form_mnemonic)
                        : vc.intake_form_mnemonic;
                    const label = `${vcLabel} - ${dataModelLabel} - ${formLabel}`;
                    return (
                        <div
                            key={vc.vc_config_id}
                            onClick={() => onSelectVC(vc)}
                            className="px-4 py-1 font-medium hover:bg-secondary-second cursor-pointer text-[16px] truncate"
                            title={label}
                        >
                            {label}
                        </div>
                    );
                });

            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="px-4 py-1 text-[16px] text-neutral-first">
                {t('loading')}
            </div>
        );
    }

    if (!mechanisms.length) {
        return (
            <div className="px-4 py-1 text-[16px] text-neutral-first truncate">
                {t('no_options_available')}
            </div>
        );
    }

    return (
        <>
            {mechanisms.map((mechanism, index) => (
                <div key={mechanism.mechanism_id} className="w-full">
                    <div className="px-4 py-1 text-neutral-first/50 font-medium">
                        {mechanism.display_key}
                    </div>

                    <div className="text-neutral-first">
                        {renderSubMenu(mechanism)}
                    </div>

                    {index !== mechanisms.length - 1 && (
                        <div className="border-b border-primary-second" />
                    )}
                </div>
            ))}
        </>
    );
}

export default function AddNewDropdown({
    mechanisms = [],
    loading = false
}: Props) {
    const router = useRouter();
    const params = useParams<{ type: string }>();
    const registerType = params.type;

    const t = useTranslations();

    const [open, setOpen] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    const [selectedVC, setSelectedVC] = useState<any | null>(null);
    const [selectedImportFile, setSelectedImportFile] = useState<any | null>(null);
    const [openVC, setOpenVC] = useState(false);

    const ref = useRef<HTMLDivElement>(null);

    useClickOutside(ref, () => setOpen(false), open);

    const closeAll = () => {
        setOpen(false);
    };

    const handleNavigateForm = (formId: string) => {
        router.push(`/intake-form/${registerType}/new/${formId}`);
        closeAll();
    };

    const handleImport = (file: any) => {
        setSelectedImportFile(file);
        setShowImportModal(true);
        closeAll();
    };

    const handleVCSelect = (vc: any) => {
        setSelectedVC(vc);
        setOpenVC(true);
        closeAll();
    };

    return (
        <>
            <div ref={ref} className="relative z-10">
                <button
                    onClick={() => setOpen((prev) => !prev)}
                    disabled={loading}
                    className="h-8.5 px-6 bg-primary-first rounded-[10px] flex items-center gap-2"
                    title={t('create_new_submission')}
                >
                    <span className="text-[16px] font-medium text-neutral-first truncate overflow-hidden whitespace-nowrap">
                        {t('create_new_submission')}
                    </span>
                    <span className="text-[20px] font-bold text-neutral-first leading-none">
                        +
                    </span>
                </button>

                {open && (
                    <div className="absolute right-0 top-full mt-1 w-100 bg-neutral-second border border-primary-second rounded-[10px] overflow-hidden z-50">
                        <MechanismMenu
                            mechanisms={mechanisms}
                            loading={loading}
                            onSelectForm={handleNavigateForm}
                            onSelectImport={handleImport}
                            onSelectVC={handleVCSelect}
                        />
                    </div>
                )}
            </div>

            {openVC && selectedVC && (
                <VpVerificationModal
                    vc={selectedVC}
                    onClose={() => {
                        setOpenVC(false);
                        setSelectedVC(null);
                    }}
                />
            )}

            {showImportModal && (
                <ImportModal
                    onClose={() => setShowImportModal(false)}
                    importFileConfig={selectedImportFile}
                />
            )}
        </>
    );
}
