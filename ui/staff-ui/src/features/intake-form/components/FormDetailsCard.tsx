import Image from 'next/image';
import { useTranslations } from 'next-intl';

export interface FormDetailsCardProps {
    description?: string;
    onClose: () => void;
    flushRight?: boolean;
}

export default function FormDetailsCard({
    description,
    onClose,
    flushRight = true,
}: FormDetailsCardProps) {
    const t = useTranslations();

    return (
        <div className={`flex max-h-[70vh] min-h-[260px] w-full max-w-full flex-col bg-secondary-second p-4 sm:p-6 ${flushRight ? 'rounded-l-[10px] rounded-r-none' : 'rounded-[10px]'}`}>
            <div className="flex items-start justify-between gap-3 mb-4">
                <h3 className="text-[20px] font-bold text-neutral-first">
                    {t('form_details')}
                </h3>
                <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 w-[34px] h-[34px] rounded-full bg-primary-second flex items-center justify-center hover:opacity-90 transition-opacity"
                    aria-label={t('close')}
                >
                    <Image
                        src="/images/config/double_right_arrow.png"
                        alt=""
                        width={16}
                        height={16}
                    />
                </button>
            </div>

            <div className="text-secondary-third text-[14px] leading-[20px] flex flex-col gap-4 whitespace-pre-wrap flex-1 overflow-y-auto">
                {description}
            </div>
        </div>
    );
}
