import React, { useState, useEffect, useMemo, useRef } from 'react';
import { tSchema } from '../utils/tSchema';
import { useWidgetContext } from '../components/WidgetProvider';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import { serializeValue, deserializeValue } from '../utils/fileSerialization';
import { documentDisplayValue } from '../utils/documentDisplay';
import { uploadIcon, attachmentIcon, remove } from '../assets';
import { DocumentDisplay } from '../components/DocumentDisplay';

interface FileInputWidgetProps {
  config: BaseWidgetConfig;
}

const iconButtonClass =
  'inline-flex items-center justify-center shrink-0 p-0 border-0 bg-transparent focus:outline-none';

const docControlClass =
  'w-full h-9 min-w-0 flex items-center rounded-lg px-2.5 box-border';

export const FileInputWidget = ({ config }: FileInputWidgetProps) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    isRequired,
    onChange,
    onBlur,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { t } = useWidgetContext();

  const accept = widgetConfig['widget-data-options']?.accept;
  const maxSize = widgetConfig['widget-data-options']?.maxSize;
  const isReadonly = Boolean(widgetConfig['widget-readonly']);

  const [localFile, setLocalFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const deserializedValue = useMemo(() => {
    if (!value) return null;
    return deserializeValue(value);
  }, [value]);

  useEffect(() => {
    if (deserializedValue instanceof File) {
      setLocalFile(deserializedValue);
    } else {
      setLocalFile(null);
    }
  }, [deserializedValue]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      onChange(null);
      setLocalFile(null);
      return;
    }

    const file = files[0];

    if (maxSize && file.size > maxSize) {
      console.error(`File ${file.name} exceeds maximum size of ${maxSize} bytes`);
      return;
    }

    setLocalFile(file);

    try {
      const serialized = await serializeValue(file);
      onChange(serialized);
    } catch (error) {
      console.error('Error serializing file:', error);
      onChange({ name: file.name, size: file.size, type: file.type });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange(null);
    setLocalFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasFile = Boolean(localFile || value);
  const displayFileName = documentDisplayValue(localFile || value).name || '';
  const isEmptyRequired = isRequired && !hasFile;
  const showValidationError = touched && error.length > 0 && isEmptyRequired;
  const label = tSchema(t, widgetConfig['widget-label']);

  if (isReadonly) {
    return (
      <div className="mb-[10px] FileDisplayWidget flex w-full min-w-0 max-w-full flex-col items-start sm:flex-row">
        {label && (
          <div
            className="w-full min-w-0 pr-2 text-base owt-field-label font-medium sm:w-1/2"
            style={{ fontFamily: 'Roboto, sans-serif' }}
            title={label}
          >
            <span className="block min-w-0 truncate">{label}:</span>
          </div>
        )}
        <div className="flex min-h-[1.5rem] w-full min-w-0 max-w-full items-center sm:w-1/2">
          {value ? (
            <DocumentDisplay value={localFile || value}
              source={widgetConfig['widget-data-options']?.documentSource} />
          ) : (
            <span className="text-base owt-text font-medium">-</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-[10px] min-w-0 max-w-full">
      <div className="flex w-full min-w-0 max-w-full flex-col items-start sm:flex-row">
        <WidgetFieldLabel
          className="w-full min-w-0 pr-2 text-base font-medium owt-field-label sm:w-1/2"
          label={label}
          required={isRequired}
        />
        <div className="flex min-h-[1.5rem] w-full min-w-0 max-w-full flex-col justify-center sm:w-1/2">
          {!hasFile && (
            <label
              className={`${docControlClass} cursor-pointer justify-center gap-2 border border-dashed ${
                !isEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                borderColor: isEmptyRequired
                  ? 'var(--owt-widget-error-color)'
                  : 'var(--owt-color-primary-dark)',
                backgroundColor: 'var(--owt-color-bg)',
              }}
            >
              <img src={uploadIcon} alt="" className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium owt-text">
                {t?.('common.upload') ?? 'Upload'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={(e) => void handleFileChange(e)}
                onBlur={onBlur}
                disabled={!isEnabled}
                className="hidden"
              />
            </label>
          )}
          {hasFile && (
            <div
              className={`${docControlClass} gap-2 border owt-border owt-bg`}
              title={displayFileName}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <img
                  src={attachmentIcon}
                  alt=""
                  className="h-4 w-4 shrink-0"
                />
                <DocumentDisplay value={localFile || value}
                  source={widgetConfig['widget-data-options']?.documentSource} />
              </div>
              <button
                type="button"
                onClick={handleRemove}
                disabled={!isEnabled}
                className={`inline-flex items-center justify-center shrink-0 h-5 w-5 p-0 border-0 rounded-full owt-bg-alt focus:outline-none ${
                  !isEnabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title={t?.('common.remove') ?? 'Remove'}
              >
                <img
                  src={remove}
                  alt={t?.('common.remove') ?? 'Remove'}
                  className="h-2.5 w-2.5"
                />
              </button>
            </div>
          )}
          {showValidationError && (
            <p className="owt-field-error text-sm mt-1">{error[0]}</p>
          )}
          {touched && error.length > 0 && !isEmptyRequired && (
            <p className="owt-field-error text-sm mt-1">{error[0]}</p>
          )}
        </div>
      </div>
    </div>
  );
};
