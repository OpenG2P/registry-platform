'use client';

import { BadgeCheck, ClipboardList, FileInput, FileUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import ImportModal from '@/features/intake-form/components/ImportModal';
import type { MoreMenuItem } from '@/components/shared';
import type {
    RegisterIntakeMenuGroup,
    RegisterIntakeMenuIconKey,
} from '@/features/register/hooks/useRegisterIntakeMenuItems';

const VpVerificationModal = dynamic(
    () => import('@/features/verifiable-credentials/components/VpVerificationModal'),
    { ssr: false },
);

const INTAKE_MENU_ICONS: Record<RegisterIntakeMenuIconKey, MoreMenuItem['icon']> = {
    formSubmissions: <ClipboardList size={16} />,
    intakeForms: <FileInput size={16} />,
    importFile: <FileUp size={16} />,
    importVc: <BadgeCheck size={16} />,
};

export function toRegisterIntakeMoreMenuItems(
    groups: RegisterIntakeMenuGroup[],
): MoreMenuItem[] {
    return groups.map((group) => ({
        id: group.id,
        label: group.label,
        icon: INTAKE_MENU_ICONS[group.iconKey],
        onClick: group.onClick,
        children: group.children,
    }));
}

interface RegisterIntakeMenuModalsProps {
    selectedImportFile: unknown;
    showImportModal: boolean;
    onCloseImport: () => void;
    selectedVC: unknown;
    openVC: boolean;
    onCloseVC: () => void;
}

export default function RegisterIntakeMenuModals({
    selectedImportFile,
    showImportModal,
    onCloseImport,
    selectedVC,
    openVC,
    onCloseVC,
}: RegisterIntakeMenuModalsProps) {
    return (
        <>
            {openVC && selectedVC ? (
                <VpVerificationModal
                    vc={selectedVC}
                    onClose={onCloseVC}
                />
            ) : null}
            {showImportModal ? (
                <ImportModal
                    onClose={onCloseImport}
                    importFileConfig={selectedImportFile}
                />
            ) : null}
        </>
    );
}
