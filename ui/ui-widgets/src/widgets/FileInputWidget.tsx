import React, { useState, useEffect, useMemo, useRef } from 'react';
import { tSchema } from '../utils/tSchema';
import { useWidgetContext } from '../components/WidgetProvider';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import { openFileInNewTab } from '../utils/filePreview';
import { serializeValue, deserializeValue, isSerializedFile, deserializeFile } from '../utils/fileSerialization';
import { isStoredDocumentRef, StoredDocumentRef } from '../utils/storedDocument';
import { uploadIcon, attachmentIcon, remove } from '../assets';

interface FileInputWidgetProps {
  config: BaseWidgetConfig;
}

const getFileName = (file: File | string): string =>
  file instanceof File ? file.name : file.split('/').pop() || file;

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

  const storedDocument: StoredDocumentRef | null = useMemo(() => {
    if (isStoredDocumentRef(deserializedValue)) return deserializedValue;
    if (isStoredDocumentRef(value)) return value;
    return null;
  }, [deserializedValue, value]);

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

  const getFile = (): File | string | null => {
    if (localFile instanceof File) {
      return localFile;
    }

    if (deserializedValue instanceof File) {
      return deserializedValue;
    }
    if (typeof deserializedValue === 'string') {
      return deserializedValue;
    }
    if (storedDocument) {
      return storedDocument.presigned_url;
    }
    if (deserializedValue && typeof deserializedValue === 'object' && isSerializedFile(deserializedValue)) {
      try {
        return deserializeFile(deserializedValue);
      } catch (e) {
        console.error('Error deserializing file:', e);
      }
    }

    return null;
  };

  const file = getFile();
  const hasFile = !!file || !!storedDocument;
  const displayFileName = storedDocument
    ? storedDocument.source_filename || storedDocument.label
    : file
      ? getFileName(file)
      : '';
  const isEmptyRequired = isRequired && !hasFile;
  const showValidationError = touched && error.length > 0 && isEmptyRequired;
  const label = tSchema(t, widgetConfig['widget-label']);

  const handlePreview = (previewFile: File | string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!previewFile) return;
    openFileInNewTab(previewFile);
  };

  if (isReadonly) {
    return (
      <div className="mb-[10px] FileDisplayWidget flex flex-row items-start w-full">
        {label && (
          <div
            className="w-1/2 min-w-0 pr-2 text-base owt-field-label font-medium truncate"
            style={{ fontFamily: 'Roboto, sans-serif' }}
            title={label}
          >
            {label}:
          </div>
        )}
        <div className="w-1/2 min-w-0 flex items-center min-h-[1.5rem]">
          {hasFile && file ? (
            <>
              <span
                className="w-10/12 min-w-0 truncate text-base owt-text font-medium"
                title={displayFileName}
              >
                {displayFileName}
              </span>
              <button
                type="button"
                onClick={(e) => handlePreview(file, e)}
                className={`w-2/12 ${iconButtonClass}`}
                title={displayFileName}
              >
                <img src={attachmentIcon} alt={t?.('common.view') ?? 'View'} className="h-4 w-4" />
              </button>
            </>
          ) : (
            <span className="text-base owt-text font-medium">-</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-[10px]">
      <div className="flex flex-row items-start w-full">
        <WidgetFieldLabel
          className="w-1/2 min-w-0 pr-2 text-base font-medium owt-field-label"
          label={label}
          required={isRequired}
        />
        <div className="w-1/2 min-w-0 flex flex-col justify-center min-h-[1.5rem]">
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
          {hasFile && file && (
            <div
              className={`${docControlClass} gap-2 border owt-border owt-bg`}
              title={displayFileName}
            >
              <button
                type="button"
                onClick={(e) => handlePreview(file, e)}
                className={`${iconButtonClass} min-w-0 flex-1 gap-2 justify-start`}
                title={displayFileName}
              >
                <img
                  src={attachmentIcon}
                  alt=""
                  className="h-4 w-4 shrink-0"
                />
                <span className="min-w-0 truncate text-sm font-medium owt-text">
                  {displayFileName}
                </span>
              </button>
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
