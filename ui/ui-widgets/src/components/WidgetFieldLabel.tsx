
import { useWidgetContext } from './WidgetProvider';
import { tSchema } from '../utils/tSchema';
export interface WidgetFieldLabelProps {
  label?: string | null;
  required?: boolean;
  className?: string;
  title?: string | null;
}

export const WidgetFieldLabel = ({
  label,
  required = false,
  className = '',
  title,
}: WidgetFieldLabelProps) => {
  const { t } = useWidgetContext();
  const translatedLabel = tSchema(t, label);
  const tooltip = title !== undefined ? tSchema(t, title) : translatedLabel;

  return (
    <label
      className={`flex items-baseline min-w-0 max-w-full ${className}`}
      style={{ fontFamily: 'Roboto, sans-serif' }}
      title={tooltip}
    >
      <span className="min-w-0 truncate">{translatedLabel}</span>
      {required && <span className="ml-1 shrink-0 owt-field-required">*</span>}
    </label>
  );
};
