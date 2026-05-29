import React from 'react';
import { useBaseWidget, BaseWidgetConfig } from '@openg2p/react-widgets';

/**
 * Example: Simple text input widget
 * 
 * Usage in schema:
 * {
 *   "widget": "text-input",
 *   "widget-type": "input",
 *   "widget-label": "Name",
 *   "widget-id": "name",
 *   "widget-data-path": "person.name",
 *   "widget-required": true,
 *   "widget-data-validation": {
 *     "required": true,
 *     "minLength": 2
 *   }
 * }
 */
interface TextInputWidgetProps {
  config: BaseWidgetConfig;
}

export const TextInputWidget = ({ config }: TextInputWidgetProps) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    onChange,
    onBlur,
    config: widgetConfig,
  } = useBaseWidget({ config });

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {widgetConfig['widget-label']}
        {widgetConfig['widget-required'] && (
          <span className="text-red-500 ml-1">*</span>
        )}
      </label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={!isEnabled}
        placeholder={widgetConfig['widget-data-placeholder']}
        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          touched && error.length > 0
            ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300'
        } ${!isEnabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
        title={widgetConfig['widget-data-tooltip']}
      />
      {touched && error.length > 0 && (
        <p className="text-red-500 text-sm mt-1">{error[0]}</p>
      )}
      {widgetConfig['widget-data-helptext'] && (
        <p className="text-gray-500 text-sm mt-1">
          {widgetConfig['widget-data-helptext']}
        </p>
      )}
    </div>
  );
};

