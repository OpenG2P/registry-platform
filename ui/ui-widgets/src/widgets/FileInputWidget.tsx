import React, { useState, useEffect, useMemo } from 'react';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import { FilePreviewModal } from '../components/FilePreviewModal';
import { canPreviewInWeb } from '../utils/filePreview';
import { serializeValue, deserializeValue, isSerializedFile, isFile, deserializeFile } from '../utils/fileSerialization';
import { uploadIcon, fileIcon } from '../assets';

/**
 * File input widget
 * 
 * Usage in schema:
 * {
 *   "widget": "file",
 *   "widget-type": "input",
 *   "widget-label": "Upload Document",
 *   "widget-id": "document",
 *   "widget-data-path": "form.document",
 *   "widget-data-options": {
 *     "accept": ".pdf,.doc,.docx",
 *     "multiple": false,
 *     "maxSize": 5242880  // 5MB in bytes
 *   }
 * }
 */
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

  // Check if this is a supporting document widget
  const isSupportingDocument = widgetConfig['widget-id']?.startsWith('supporting-doc-') || false;

  // State for preview modal
  const [previewFile, setPreviewFile] = useState<File | string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Local state to hold actual File objects (for preview) separate from Redux
  const [localFiles, setLocalFiles] = useState<File[] | File | null>(null);

  // Deserialize value from Redux (convert serialized files back to File objects)
  const deserializedValue = useMemo(() => {
    if (!value) return null;
    return deserializeValue(value);
  }, [value]);

  // Update local files when deserialized value changes
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

    // Validate file size if specified
    if (maxSize) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].size > maxSize) {
          // You might want to show an error here
          console.error(`File ${files[i].name} exceeds maximum size of ${maxSize} bytes`);
          return;
        }
      }
    }

    const fileArray = Array.from(files);

    // Store actual File objects locally for preview
    if (multiple) {
      setLocalFiles(fileArray);
    } else {
      setLocalFiles(fileArray[0]);
    }

    // Serialize and store in Redux
    try {
      const serialized = await serializeValue(multiple ? fileArray : fileArray[0]);
      onChange(serialized);
    } catch (error) {
      console.error('Error serializing file:', error);
      // Fallback: store file metadata only (not the full file)
      if (multiple) {
        onChange(fileArray.map(f => ({ name: f.name, size: f.size, type: f.type })));
      } else {
        onChange({ name: fileArray[0].name, size: fileArray[0].size, type: fileArray[0].type });
      }
    }
  };

  // Get files for display and preview - prefer local files, fallback to deserialized
  const getFiles = (): (File | string)[] => {
    console.log('getFiles called - multiple:', multiple, 'localFiles:', localFiles, 'deserializedValue:', deserializedValue);

    // First try local files (actual File objects) - these are the most recent
    if (localFiles) {
      if (multiple && Array.isArray(localFiles)) {
        console.log('Returning localFiles array (multiple)');
        return localFiles;
      } else if (!multiple && localFiles instanceof File) {
        console.log('Returning [localFiles] (single file)');
        return [localFiles];
      } else {
        console.log('localFiles exists but conditions not met - multiple:', multiple, 'isArray:', Array.isArray(localFiles), 'isFile:', localFiles instanceof File);
      }
    }

    // Fallback to deserialized value from Redux
    if (deserializedValue) {
      if (multiple) {
        if (Array.isArray(deserializedValue)) {
          // Filter to get only File objects or strings
          const filtered = deserializedValue.filter((v): v is File | string =>
            v instanceof File || typeof v === 'string'
          );
          console.log('Returning filtered deserializedValue array:', filtered);
          return filtered;
        }
        console.log('deserializedValue is not array for multiple mode');
        return [];
      } else {
        if (deserializedValue instanceof File) {
          console.log('Returning [deserializedValue] (single file)');
          return [deserializedValue];
        }
        // If it's a string (URL or path), return it
        if (typeof deserializedValue === 'string') {
          console.log('Returning [deserializedValue] (string)');
          return [deserializedValue];
        }
        // If it's a serialized file object, try to deserialize it
        if (deserializedValue && typeof deserializedValue === 'object' && isSerializedFile(deserializedValue)) {
          try {
            const file = deserializeFile(deserializedValue);
            console.log('Deserialized file:', file);
            return [file];
          } catch (e) {
            console.error('Error deserializing file:', e);
          }
        }
      }
    }

    console.log('getFiles returning empty array');
    return [];
  };

  const files = getFiles();
  const displayValue = files.length > 0
    ? files.map((f) => f instanceof File ? f.name : f.split('/').pop() || f).join(', ')
    : '';

  // Debug: log files availability
  useEffect(() => {
    console.log('Files available for preview:', files.length, files);
    console.log('Local files:', localFiles, 'Type:', typeof localFiles, 'Is File:', localFiles instanceof File, 'Is Array:', Array.isArray(localFiles));
    console.log('Deserialized value:', deserializedValue, 'Type:', typeof deserializedValue, 'Is File:', deserializedValue instanceof File);
    console.log('Multiple:', multiple);
  }, [files, localFiles, deserializedValue, multiple]);

  // Debug modal state
  useEffect(() => {
    console.log('=== MODAL STATE UPDATE ===');
    console.log('Modal state - previewFile:', previewFile, 'isPreviewOpen:', isPreviewOpen);
    console.log('Will render modal:', isPreviewOpen && !!previewFile);
    console.log('previewFile type:', typeof previewFile, 'is File:', previewFile instanceof File);
    console.log('Condition check - isOpen && !!file:', isPreviewOpen && !!previewFile);
  }, [previewFile, isPreviewOpen]);

  // Handle file click for preview
  const handleFileClick = (file: File | string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Ensure we have a valid file
    if (!file) {
      console.warn('No file provided to preview');
      return;
    }

    const canPreview = canPreviewInWeb(file);
    console.log('File clicked:', file instanceof File ? file.name : file, 'Type:', file instanceof File ? file.type : 'string', 'Can preview:', canPreview);

    if (canPreview) {
      console.log('Setting preview file and opening modal');
      setPreviewFile(file);
      setIsPreviewOpen(true);
      console.log('State set - previewFile:', file, 'isPreviewOpen: true');
    } else {
      console.warn('File cannot be previewed:', file instanceof File ? file.name : file);
    }
  };

  // Render file name(s) with preview capability
  const renderFileDisplay = () => {
    console.log('renderFileDisplay called, files.length:', files.length, 'files:', files);

    if (files.length === 0) {
      console.log('No files to display');
      return null;
    }

    if (files.length === 1) {
      const file = files[0];
      const fileName = file instanceof File ? file.name : file.split('/').pop() || file;
      const canPreview = canPreviewInWeb(file);

      console.log('Single file:', fileName, 'canPreview:', canPreview);

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
              onClick={(e) => {
                console.log('Button clicked!', file);
                handleFileClick(file, e);
              }}
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
    } else {
      // Multiple files
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
    }
  };

  // For readonly mode, render as display only (no upload button)
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
          {/* {widgetConfig['widget-data-helptext'] && (
            <p className="text-gray-500 text-sm mt-1">
              {translateConfig(widgetConfig['widget-data-helptext'])}
            </p>
          )} */}
        </div>

        {/* Preview Modal - Always render, let modal handle visibility */}
        <FilePreviewModal
          file={previewFile}
          isOpen={isPreviewOpen && !!previewFile}
          onClose={() => {
            console.log('Closing preview modal');
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
          {/* {widgetConfig['widget-data-helptext'] && (
            <p className="text-gray-500 text-sm mt-1">
              {translateConfig(widgetConfig['widget-data-helptext'])}
            </p>
          )} */}
          {maxSize && (
            <p className="hidden sm:block text-gray-400 text-xs mt-1">
              {translate('common.maxFileSize', { size: (maxSize / 1024 / 1024).toFixed(2) })}
            </p>
          )}
        </div>
      </div>

      {/* Preview Modal - Always render, let modal handle visibility */}
      <FilePreviewModal
        key={`modal-${previewFile ? (previewFile instanceof File ? previewFile.name : previewFile) : 'none'}`}
        file={previewFile}
        isOpen={isPreviewOpen && !!previewFile}
        onClose={() => {
          console.log('Closing preview modal');
          setIsPreviewOpen(false);
          setPreviewFile(null);
        }}
      />
    </div>
  );
};
