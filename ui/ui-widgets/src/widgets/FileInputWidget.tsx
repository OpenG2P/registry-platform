import React, { useState, useEffect, useMemo } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import { FilePreviewModal } from '../components/FilePreviewModal';
import { canPreviewInWeb } from '../utils/filePreview';
import { serializeValue, deserializeValue, isSerializedFile, deserializeFile } from '../utils/fileSerialization';
import { uploadIcon, fileIcon } from '../assets';

interface FileInputWidgetProps {
  config: BaseWidgetConfig;
}

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

  const { translate, translateConfig } = useWidgetTranslation();

  const accept = widgetConfig['widget-data-options']?.accept;
  const multiple = widgetConfig['widget-data-options']?.multiple || false;
  const maxSize = widgetConfig['widget-data-options']?.maxSize;

  const isSupportingDocument = widgetConfig['widget-id']?.startsWith('supporting-doc-') || false;

  const [previewFile, setPreviewFile] = useState<File | string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [localFiles, setLocalFiles] = useState<File[] | File | null>(null);

  const deserializedValue = useMemo(() => {
    if (!value) return null;
    return deserializeValue(value);
  }, [value]);

  useEffect(() => {
    if (deserializedValue) {
      if (multiple) {
        if (Array.isArray(deserializedValue)) {
          const files = deserializedValue.filter((v): v is File => v instanceof File);
          setLocalFiles(files.length > 0 ? files : null);
        } else {
          setLocalFiles(null);
        }
      } else {
        if (deserializedValue instanceof File) {
          setLocalFiles(deserializedValue);
        } else {
          setLocalFiles(null);
        }
      }
    } else {
      setLocalFiles(null);
    }
  }, [deserializedValue, multiple]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      onChange(null);
      setLocalFiles(null);
      return;
    }

    if (maxSize) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].size > maxSize) {
          console.error(`File ${files[i].name} exceeds maximum size of ${maxSize} bytes`);
          return;
        }
      }
    }

    const fileArray = Array.from(files);

    if (multiple) {
      setLocalFiles(fileArray);
    } else {
      setLocalFiles(fileArray[0]);
    }

    try {
      const serialized = await serializeValue(multiple ? fileArray : fileArray[0]);
      onChange(serialized);
    } catch (error) {
      console.error('Error serializing file:', error);
      if (multiple) {
        onChange(fileArray.map(f => ({ name: f.name, size: f.size, type: f.type })));
      } else {
        onChange({ name: fileArray[0].name, size: fileArray[0].size, type: fileArray[0].type });
      }
    }
  };

  const getFiles = (): (File | string)[] => {
    if (localFiles) {
      if (multiple && Array.isArray(localFiles)) {
        return localFiles;
      }
      if (!multiple && localFiles instanceof File) {
        return [localFiles];
      }
    }

    if (deserializedValue) {
      if (multiple) {
        if (Array.isArray(deserializedValue)) {
          return deserializedValue.filter((v): v is File | string =>
            v instanceof File || typeof v === 'string'
          );
        }
        return [];
      }

      if (deserializedValue instanceof File) {
        return [deserializedValue];
      }
      if (typeof deserializedValue === 'string') {
        return [deserializedValue];
      }
      if (deserializedValue && typeof deserializedValue === 'object' && isSerializedFile(deserializedValue)) {
        try {
          return [deserializeFile(deserializedValue)];
        } catch (e) {
          console.error('Error deserializing file:', e);
        }
      }
    }

    return [];
  };

  const files = getFiles();
  const displayValue = files.length > 0
    ? files.map((f) => f instanceof File ? f.name : f.split('/').pop() || f).join(', ')
    : '';

  const handleFileClick = (file: File | string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!file) {
      return;
    }

    if (canPreviewInWeb(file)) {
      setPreviewFile(file);
      setIsPreviewOpen(true);
    }
  };

  const renderFileDisplay = () => {
    if (files.length === 0) {
      return null;
    }

    if (files.length === 1) {
      const file = files[0];
      const fileName = file instanceof File ? file.name : file.split('/').pop() || file;
      const canPreview = canPreviewInWeb(file);

      const fileIconElement = (
        <img
          src={fileIcon}
          alt="File icon"
          style={{
            width: '15px',
            height: '18px',
            aspectRatio: '5/6',
            marginRight: '8px',
            flexShrink: 0
          }}
        />
      );

      if (canPreview) {
        return (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {fileIconElement}
            <button
              type="button"
              onClick={(e) => handleFileClick(file, e)}
              className="text-sm hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded cursor-pointer"
              style={{ color: isSupportingDocument ? 'var(--owt-color-text, #011627)' : 'var(--owt-color-info, #2563eb)' }}
              title="Click to preview"
            >
              {fileName}
            </button>
          </div>
        );
      } else {
        return (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {fileIconElement}
            <span className="text-sm" style={{ color: isSupportingDocument ? 'var(--owt-color-text, #011627)' : '#4b5563' }}>
              {fileName}
            </span>
          </div>
        );
      }
    }

    return (
      <div className="flex flex-wrap gap-2">
          {files.map((file, index) => {
            const fileName = file instanceof File ? file.name : file.split('/').pop() || file;
            const canPreview = canPreviewInWeb(file);

            const fileIconElement = (
              <img
                src={fileIcon}
                alt="File icon"
                style={{
                  width: '15px',
                  height: '18px',
                  aspectRatio: '5/6',
                  marginRight: '8px',
                  flexShrink: 0
                }}
              />
            );

            if (canPreview) {
              return (
                <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                  {fileIconElement}
                  <button
                    type="button"
                    onClick={(e) => handleFileClick(file, e)}
                    className="text-sm hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded cursor-pointer"
                    style={{ color: isSupportingDocument ? 'var(--owt-color-text, #011627)' : 'var(--owt-color-info, #2563eb)' }}
                    title="Click to preview"
                  >
                    {fileName}
                  </button>
                </div>
              );
            } else {
              return (
                <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                  {fileIconElement}
                  <span className="text-sm" style={{ color: isSupportingDocument ? 'var(--owt-color-text, #011627)' : '#4b5563' }}>
                    {fileName}
                  </span>
                </div>
              );
            }
          })}
        </div>
      );
  };

  if (widgetConfig['widget-readonly']) {
    const label = translateConfig(widgetConfig['widget-label']);
    return (
      <div className="mb-[10px] FileDisplayWidget flex flex-col sm:flex-row sm:items-start">
        {label && (
          <div className="text-base text-gray-600 font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0" style={{ fontFamily: 'Roboto, sans-serif' }} title={label}>
            {label}:
          </div>
        )}
        <div className="flex-1" title={String(displayValue || '')}>
          {displayValue ? renderFileDisplay() : <span className="text-base text-gray-900 font-medium">-</span>}
          
        </div>

        <FilePreviewModal
          file={previewFile}
          isOpen={isPreviewOpen && !!previewFile}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewFile(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mb-[10px]">
      <div className="flex flex-col sm:flex-row sm:items-start">
        <WidgetFieldLabel
          className="text-base font-medium text-gray-700 md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
          label={translateConfig(widgetConfig['widget-label'])}
          required={isRequired}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:space-x-4">
            <label
              className={`cursor-pointer inline-flex items-center justify-between gap-2 border border-gray-300 shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${!isEnabled
                ? 'opacity-50 cursor-not-allowed'
                : ''
                }`}
              style={{
                width: '100%',
                maxWidth: '180px',
                height: '30px',
                paddingLeft: '12px',
                paddingRight: '12px',
                borderRadius: '10px'
              }}
            >
              <span style={{
                color: isSupportingDocument ? 'rgba(0, 0, 0, 0.50)' : 'rgba(0, 0, 0, 0.50)',
                fontFamily: 'Roboto',
                fontSize: '16px',
                fontStyle: 'normal',
                fontWeight: 400,
                lineHeight: '24px',
                textAlign: 'left'
              }}>{translate('common.uploadFile') || 'Upload File'}</span>
              <img
                src={uploadIcon}
                alt="Upload"
                style={{
                  width: '18px',
                  height: '18px',
                  aspectRatio: '1/1',
                  display: 'block',
                  flexShrink: 0
                }}
              />
              <input
                type="file"
                accept={accept}
                multiple={multiple}
                onChange={handleFileChange}
                onBlur={onBlur}
                disabled={!isEnabled}
                className="hidden"
              />
            </label>
            {displayValue && (
              <div className="flex-1 min-w-0">
                {renderFileDisplay()}
              </div>
            )}
          </div>
          {touched && error.length > 0 && (
            <p className="text-red-500 text-sm mt-1">{error[0]}</p>
          )}
          
          {maxSize && (
            <p className="hidden sm:block text-gray-400 text-xs mt-1">
              {translate('common.maxFileSize', { size: (maxSize / 1024 / 1024).toFixed(2) })}
            </p>
          )}
        </div>
      </div>

      <FilePreviewModal
        key={`modal-${previewFile ? (previewFile instanceof File ? previewFile.name : previewFile) : 'none'}`}
        file={previewFile}
        isOpen={isPreviewOpen && !!previewFile}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewFile(null);
        }}
      />
    </div>
  );
};
