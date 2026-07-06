import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

export interface WidgetFieldLabelProps {
  label: string;
  required?: boolean;
  className?: string;
  title?: string;
}

export const WidgetFieldLabel = ({
  label,
  required = false,
  className = '',
  title,
}: WidgetFieldLabelProps) => {
  const { translateConfig } = useWidgetTranslation();
  const translatedLabel = translateConfig(label);
  const tooltip = title !== undefined ? translateConfig(title) : translatedLabel;

  return (
    <label
      className={`flex items-baseline min-w-0 max-w-full ${className}`}
      style={{ fontFamily: 'Roboto, sans-serif' }}
      title={tooltip}
    >
      <span className="min-w-0 truncate">{translatedLabel}</span>
      {required && <span className="ml-1 shrink-0 text-red-500">*</span>}
    </label>
  );
};
