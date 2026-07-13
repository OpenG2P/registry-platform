'use client';

import { useMemo } from 'react';
import { Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Register } from '../shared/types';
import { InputField, TextAreaField, CustomDropdown } from '../shared/components';

export interface RegisterFormData {
    register_mnemonic: string;
    register_description: string;
    master_register_id: string;
    dedup_is_enabled: boolean;
    dedup_threshold_score: string;
    register_icon: string;
    register_rank: string;
    register_purpose: string;
    functional_id_generation_required: boolean;
    completion_score_required: boolean;
    requires_registrant_authentication: boolean;
    registrant_authentication_validity_days: string;
    registrant_re_auth_warning_days_before: string;
    outgest_applicable: boolean;
}

export const EMPTY_REGISTER_FORM: RegisterFormData = {
    register_mnemonic: '',
    register_description: '',
    master_register_id: '',
    dedup_is_enabled: false,
    dedup_threshold_score: '',
    register_icon: '',
    register_rank: '',
    register_purpose: 'REGISTER',
    functional_id_generation_required: false,
    completion_score_required: false,
    requires_registrant_authentication: false,
    registrant_authentication_validity_days: '',
    registrant_re_auth_warning_days_before: '',
    outgest_applicable: false,
};

interface RegisterFormFieldsProps {
    formData: RegisterFormData;
    setFormData: React.Dispatch<React.SetStateAction<RegisterFormData>>;
    registers: Register[];
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    purposeOptions: { label: string; value: string }[];
    iconPreview?: (icon: string) => string;
}

function FormSection({ children }: { children: React.ReactNode }) {
    return (
        <div className="space-y-4 border-b border-secondary-first/80 pb-4 last:border-b-0 last:pb-0">
            {children}
        </div>
    );
}

export default function RegisterFormFields({
    formData,
    setFormData,
    registers,
    fileInputRef,
    onFileChange,
    purposeOptions,
    iconPreview = (icon) => icon,
}: RegisterFormFieldsProps) {
    const t = useTranslations();

    const booleanOptions = [
        { label: t('true'), value: 'true' },
        { label: t('false'), value: 'false' },
    ];

    const sortedRegisters = useMemo(
        () =>
            [...registers].sort(
                (a, b) => (Number(a.register_rank) || 0) - (Number(b.register_rank) || 0),
            ),
        [registers],
    );

    const iconSrc = formData.register_icon ? iconPreview(formData.register_icon) : '';

    return (
        <div className="space-y-4">
            <FormSection>
                <div className="grid grid-cols-2 gap-4">
                    <InputField
                        label={t('register_mnemonic')}
                        placeholder={t('enter_register_name')}
                        value={formData.register_mnemonic}
                        onChange={(value) =>
                            setFormData((prev) => ({ ...prev, register_mnemonic: value }))
                        }
                    />
                    <CustomDropdown
                        label={t('register_purpose')}
                        value={formData.register_purpose}
                        onChange={(value) =>
                            setFormData((prev) => ({ ...prev, register_purpose: value }))
                        }
                        options={purposeOptions}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <CustomDropdown
                        label={t('master_register')}
                        placeholder={t('select_master_register')}
                        value={formData.master_register_id}
                        onChange={(value) =>
                            setFormData((prev) => ({ ...prev, master_register_id: value }))
                        }
                        options={registers.map((register: Register) => ({
                            label: register.register_mnemonic,
                            value: register.register_id,
                        }))}
                    />
                    <TextAreaField
                        label={t('register_description')}
                        placeholder={t('type_your_message')}
                        rows={1}
                        value={formData.register_description}
                        onChange={(value) =>
                            setFormData((prev) => ({ ...prev, register_description: value }))
                        }
                        textareaClassName="min-h-[42px] resize-y max-h-32 overflow-y-auto"
                    />
                </div>
            </FormSection>

            <FormSection>
                <div className="grid grid-cols-2 gap-4">
                    <CustomDropdown
                        label={t('deduplication_enabled')}
                        value={formData.dedup_is_enabled ? 'true' : 'false'}
                        onChange={(value) =>
                            setFormData((prev) => ({
                                ...prev,
                                dedup_is_enabled: value === 'true',
                            }))
                        }
                        options={booleanOptions}
                    />
                    <InputField
                        label={t('dedup_threshold_score')}
                        type="number"
                        min={0}
                        value={formData.dedup_threshold_score}
                        disabled={!formData.dedup_is_enabled}
                        onChange={(value) =>
                            setFormData((prev) => ({ ...prev, dedup_threshold_score: value }))
                        }
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <CustomDropdown
                        label={t('functional_id_generation_required')}
                        value={formData.functional_id_generation_required ? 'true' : 'false'}
                        onChange={(value) =>
                            setFormData((prev) => ({
                                ...prev,
                                functional_id_generation_required: value === 'true',
                            }))
                        }
                        options={booleanOptions}
                    />
                    <CustomDropdown
                        label={t('completion_score_required')}
                        value={formData.completion_score_required ? 'true' : 'false'}
                        onChange={(value) =>
                            setFormData((prev) => ({
                                ...prev,
                                completion_score_required: value === 'true',
                            }))
                        }
                        options={booleanOptions}
                    />
                </div>
            </FormSection>

            <FormSection>
                <div className="grid grid-cols-2 gap-4">
                    <CustomDropdown
                        label={t('requires_registrant_authentication')}
                        value={formData.requires_registrant_authentication ? 'true' : 'false'}
                        onChange={(value) =>
                            setFormData((prev) => ({
                                ...prev,
                                requires_registrant_authentication: value === 'true',
                            }))
                        }
                        options={booleanOptions}
                    />
                    <CustomDropdown
                        label={t('outgest_applicable')}
                        value={formData.outgest_applicable ? 'true' : 'false'}
                        onChange={(value) =>
                            setFormData((prev) => ({
                                ...prev,
                                outgest_applicable: value === 'true',
                            }))
                        }
                        options={booleanOptions}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <InputField
                        label={t('registrant_authentication_validity_days')}
                        type="number"
                        min={0}
                        value={formData.registrant_authentication_validity_days}
                        disabled={!formData.requires_registrant_authentication}
                        onChange={(value) =>
                            setFormData((prev) => ({
                                ...prev,
                                registrant_authentication_validity_days: value,
                            }))
                        }
                    />
                    <InputField
                        label={t('registrant_re_auth_warning_days_before')}
                        type="number"
                        min={0}
                        value={formData.registrant_re_auth_warning_days_before}
                        disabled={!formData.requires_registrant_authentication}
                        onChange={(value) =>
                            setFormData((prev) => ({
                                ...prev,
                                registrant_re_auth_warning_days_before: value,
                            }))
                        }
                    />
                </div>
            </FormSection>

            <FormSection>
                <div className="grid grid-cols-4 gap-4 items-start">
                    <div className="col-span-2">
                        <label
                            className="block text-[16px] font-medium text-neutral-first truncate"
                            title={t('register_rank')}
                        >
                            {t('register_rank')}
                        </label>
                        <div className="mt-2 grid grid-cols-2 gap-2 items-center">
                            <InputField
                                type="number"
                                placeholder="e.g. 0"
                                value={formData.register_rank}
                                onChange={(value) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        register_rank: value,
                                    }))
                                }
                            />
                            <CustomDropdown
                                inline
                                placeholder={t('view_existing_ranks')}
                                value=""
                                onChange={() => {}}
                                options={sortedRegisters.map((register) => ({
                                    label: `${register.register_mnemonic} (Rank: ${register.register_rank})`,
                                    value: String(register.register_rank),
                                }))}
                            />
                        </div>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[16px] font-medium text-neutral-first">
                            {t('register_icon')}
                        </label>
                        <div className="mt-2 flex items-center gap-4">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-10 h-10 border-2 border-dashed border-primary-second rounded-lg flex items-center justify-center cursor-pointer hover:bg-secondary-first transition-colors overflow-hidden shrink-0"
                            >
                                {iconSrc ? (
                                    <img
                                        src={iconSrc}
                                        alt="icon"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Upload className="text-primary-second" size={20} />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={onFileChange}
                                    accept="image/*"
                                    className="hidden"
                                />
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="text-sm text-primary-second font-medium hover:underline"
                                    >
                                        {formData.register_icon ? t('change_icon') : t('upload_icon')}
                                    </button>
                                    {formData.register_icon && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    register_icon: '',
                                                }));
                                                if (fileInputRef.current) {
                                                    fileInputRef.current.value = '';
                                                }
                                            }}
                                            className="shrink-0 text-red-500 hover:text-red-600"
                                            title={t('remove')}
                                            aria-label={t('remove')}
                                        >
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-secondary-third">{t('max_size_2mb')}</p>
                            </div>
    
                        </div>
                    </div>
                </div>
            </FormSection>
        </div>
    );
}
