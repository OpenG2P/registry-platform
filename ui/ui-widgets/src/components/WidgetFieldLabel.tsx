import React from 'react';

export interface WidgetFieldLabelProps {
  label: string;
  required?: boolean;
  className?: string;
  title?: string;
}

/**
 * Field label: long text truncates with ellipsis; required asterisk always stays visible.
 */
export const WidgetFieldLabel = ({
  label,
  required = false,
  className = '',
  title,
}: WidgetFieldLabelProps) => {
  const tooltip = title ?? label;

  return (
    <label
      className={`flex items-baseline min-w-0 max-w-full ${className}`}
      style={{ fontFamily: 'Roboto, sans-serif' }}
      title={tooltip}
    >
      <span className="min-w-0 truncate">{label}</span>
      {required && <span className="ml-1 shrink-0 text-red-500">*</span>}
    </label>
  );
};
