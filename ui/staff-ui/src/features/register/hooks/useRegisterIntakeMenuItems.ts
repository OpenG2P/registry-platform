import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useRegister } from '@/context/RegisterContext';
import { useRbac } from '@/context/RbacContext';
import { useIntakeForms } from '@/features/intake-form/hooks/useIntakeForms';
import { useImportFileConfigs } from '@/features/intake-form/hooks/useImportFileConfigs';
import { useVCConfigs } from '@/features/register/hooks/useVCConfigs';
import { INTAKE_FORM_ACTIONS } from '@/features/shared/permissions';

export type RegisterIntakeMenuIconKey =
    | 'formSubmissions'
    | 'intakeForms'
    | 'importFile'
    | 'importVc';

export interface RegisterIntakeMenuOption {
    id: string;
    label: string;
    disabled?: boolean;
    onClick?: () => void;
}

export interface RegisterIntakeMenuGroup {
    id: string;
    label: string;
    iconKey: RegisterIntakeMenuIconKey;
    onClick?: () => void;
    children?: RegisterIntakeMenuOption[];
}

function optionChildren(
    groupId: string,
    loading: boolean,
    items: RegisterIntakeMenuOption[],
    t: ReturnType<typeof useTranslations>,
): RegisterIntakeMenuOption[] {
    if (loading) {
        return [{
            id: `${groupId}-loading`,
            label: t.has('loading') ? t('loading') : 'Loading',
            disabled: true,
        }];
    }

    if (items.length === 0) {
        return [{
            id: `${groupId}-empty`,
            label: t.has('no_options_available')
                ? t('no_options_available')
                : 'No options available',
            disabled: true,
        }];
    }

    return items;
}

export function useRegisterIntakeMenuItems(registerType?: string) {
    const t = useTranslations();
    const router = useRouter();
    const { can } = useRbac();
    const { currentRegister } = useRegister();
    const registerId = currentRegister?.register_id;
    const { forms, loading: formsLoading } = useIntakeForms(registerId);
    const { importFileOptions, isLoadingImportFiles } = useImportFileConfigs();
    const { vcOptions, isLoadingVCs } = useVCConfigs();

    const [selectedImportFile, setSelectedImportFile] = useState<unknown | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [selectedVC, setSelectedVC] = useState<unknown | null>(null);
    const [openVC, setOpenVC] = useState(false);

    const groups = useMemo<RegisterIntakeMenuGroup[]>(() => {
        if (!registerType) return [];

        const menuGroups: RegisterIntakeMenuGroup[] = [];

        if (can(INTAKE_FORM_ACTIONS.view)) {
            menuGroups.push({
                id: 'form-submissions',
                label: t.has('form_submissions') ? t('form_submissions') : 'Form Submissions',
                iconKey: 'formSubmissions',
                onClick: () => router.push(`/intake-form/${registerType}`),
            });
        }

        if (can(INTAKE_FORM_ACTIONS.edit)) {
            menuGroups.push({
                id: 'intake-forms',
                label: t.has('intake_forms') ? t('intake_forms') : 'Intake Forms',
                iconKey: 'intakeForms',
                children: optionChildren(
                    'intake-forms',
                    formsLoading,
                    forms.map((form) => ({
                        id: form.form_id,
                        label: t.has(form.form_mnemonic) ? t(form.form_mnemonic) : form.form_mnemonic,
                        onClick: () =>
                            router.push(`/intake-form/${registerType}/new/${form.form_id}`),
                    })),
                    t,
                ),
            });

            menuGroups.push({
                id: 'import-file',
                label: t.has('import_from_file') ? t('import_from_file') : 'Import from file',
                iconKey: 'importFile',
                children: optionChildren(
                    'import-file',
                    isLoadingImportFiles,
                    importFileOptions.map((file) => ({
                        id: file.import_file_configuration_id,
                        label: t.has(file.import_file_template_mnemonic)
                            ? t(file.import_file_template_mnemonic)
                            : file.import_file_template_mnemonic,
                        onClick: () => {
                            setSelectedImportFile(file);
                            setShowImportModal(true);
                        },
                    })),
                    t,
                ),
            });

            menuGroups.push({
                id: 'import-vc',
                label: t.has('import_from_vc')
                    ? t('import_from_vc')
                    : 'Import from verifiable credentials',
                iconKey: 'importVc',
                children: optionChildren(
                    'import-vc',
                    isLoadingVCs,
                    (Array.isArray(vcOptions) ? vcOptions : []).map((vc: {
                        vc_config_id: string;
                        vc_mnemonic?: string;
                        data_model_mnemonic?: string;
                        intake_form_mnemonic?: string;
                    }) => {
                        const vcLabel = vc.vc_mnemonic && t.has(vc.vc_mnemonic)
                            ? t(vc.vc_mnemonic)
                            : vc.vc_mnemonic;
                        const dataModelLabel = vc.data_model_mnemonic && t.has(vc.data_model_mnemonic)
                            ? t(vc.data_model_mnemonic)
                            : vc.data_model_mnemonic;
                        const formLabel = vc.intake_form_mnemonic && t.has(vc.intake_form_mnemonic)
                            ? t(vc.intake_form_mnemonic)
                            : vc.intake_form_mnemonic;
                        return {
                            id: vc.vc_config_id,
                            label: `${vcLabel} - ${dataModelLabel} - ${formLabel}`,
                            onClick: () => {
                                setSelectedVC(vc);
                                setOpenVC(true);
                            },
                        };
                    }),
                    t,
                ),
            });
        }

        return menuGroups;
    }, [
        can,
        forms,
        formsLoading,
        importFileOptions,
        isLoadingImportFiles,
        isLoadingVCs,
        registerType,
        router,
        t,
        vcOptions,
    ]);

    return {
        groups,
        selectedImportFile,
        showImportModal,
        closeImportModal: () => {
            setShowImportModal(false);
            setSelectedImportFile(null);
        },
        selectedVC,
        openVC,
        closeVC: () => {
            setOpenVC(false);
            setSelectedVC(null);
        },
    };
}
