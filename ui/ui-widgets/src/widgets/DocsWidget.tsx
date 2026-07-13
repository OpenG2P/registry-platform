import React, { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { tSchema } from '../utils/tSchema';
import { useWidgetContext } from '../components/WidgetProvider';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { WidgetRootState } from '../store';
import { getValueByPath } from '../utils/pathUtils';
import { BaseWidgetConfig } from '../types';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import { FilePreviewModal } from '../components/FilePreviewModal';
import { canPreviewInWeb } from '../utils/filePreview';
import { serializeFile, deserializeFile, isSerializedFile, SerializedFile } from '../utils/fileSerialization';
import { uploadIcon, fileIcon, closeSign} from '../assets';

export interface DocSlotConfig {
  'document-key': string;
  'document-label': string;
  'document-required'?: boolean;
  'document-accept': string;
  /**  maximum file size in bytes. */
  'document-max-size': number;
}

interface DocsWidgetProps {
  config: BaseWidgetConfig;
}

type DocsSlotValue = (SerializedFile & { label?: string }) | string | null;
type DocsValue = Record<string, DocsSlotValue>;

const getFileName = (file: File | string): string =>
  file instanceof File ? file.name : file.split('/').pop() || file;

export const DocsWidget = ({ config }: DocsWidgetProps) => {
  const {
    isEnabled,
    onChange,
    onBlur,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { t } = useWidgetContext();

  const documents: DocSlotConfig[] = widgetConfig['documents'] || [];
  const columns: number = widgetConfig['widget-docs-columns'] || 3;
  const isReadonly = Boolean(widgetConfig['widget-readonly']);
  const widgetId = widgetConfig['widget-id'];
  const dataPath = widgetConfig['widget-data-path'];
  
  const allValues = useSelector((state: WidgetRootState) => state.widget.values);
  const rawValue =
    typeof dataPath === 'string' ? getValueByPath(allValues, dataPath) : allValues[widgetId];
  const currentValue: DocsValue =
    rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
      ? (rawValue as DocsValue)
      : {};

  const [previewFile, setPreviewFile] = useState<File | string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileChange = async (docKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const doc = documents.find((d) => d['document-key'] === docKey);
    const maxSize = doc?.['document-max-size'];

    if (maxSize && file.size > maxSize) {
      console.error(`File "${file.name}" exceeds max size of ${maxSize} bytes`);
      return;
    }

    try {
      const serialized = await serializeFile(file);
      const updated: DocsValue = {
        ...currentValue,
        [docKey]: { ...serialized, label: doc?.['document-label'] ?? docKey },
      };
      onChange(updated);
      onBlur();
    } catch (err) {
      console.error('Error serializing file:', err);
    }

    if (fileInputRefs.current[docKey]) {
      fileInputRefs.current[docKey]!.value = '';
    }
  };

  const handleRemove = (docKey: string) => {
    const updated: DocsValue = { ...currentValue, [docKey]: null };
    onChange(updated);
  };

  const handlePreview = (file: File | string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (canPreviewInWeb(file)) {
      setPreviewFile(file);
      setIsPreviewOpen(true);
    } else if (typeof file === 'string') {
      window.open(file, '_blank', 'noopener,noreferrer');
    }
  };

  const getDocValue = (docKey: string): File | string | null => {
    const stored = currentValue[docKey];
    if (!stored) return null;
    if (typeof stored === 'string') return stored;
    if (isSerializedFile(stored)) {
      try {
        return deserializeFile(stored);
      } catch {
        return null;
      }
    }
    return null;
  };

  const renderSlot = (doc: DocSlotConfig) => {
    const docKey = doc['document-key'];
    const label = doc['document-label'];
    const isRequired = doc['document-required'] ?? false;
    const accept = doc['document-accept'];
    const file = getDocValue(docKey);
    const hasFile = !!file;
    const fileName = file ? getFileName(file) : '';
    const canPreview = file ? canPreviewInWeb(file) : false;

    if (isReadonly) {
      return (
        <div
          key={docKey}
          className="mb-[10px] FileDisplayWidget flex flex-col sm:flex-row sm:items-start"
        >
          <div
            className="text-base text-gray-600 font-medium w-full sm:w-1/2 sm:pr-4 mb-1 sm:mb-0 truncate"
            style={{ fontFamily: 'Roboto, sans-serif' }}
            title={tSchema(t, label)}
          >
            {tSchema(t, label)}:
          </div>
          <div className="flex-1 min-w-0">
            {hasFile ? (
              <button
                type="button"
                onClick={(e) => handlePreview(file!, e)}
                className="text-base font-medium hover:underline focus:outline-none"
                style={{ color: 'var(--owt-color-info, #2563eb)' }}
                title={fileName}
              >
                {t?.('common.view') ?? 'View'}
              </button>
            ) : (
              <span className="text-base text-gray-900 font-medium"></span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        key={docKey}
        className="flex flex-col gap-2 rounded-[10px] border border-gray-200 p-3 bg-white"
      >
        <WidgetFieldLabel
          label={tSchema(t, label)}
          required={isRequired}
          className="text-sm font-medium text-gray-700"
        />
        <div className="flex flex-col gap-1">
          <label
            className={`cursor-pointer inline-flex items-center justify-between gap-2 border border-gray-300 shadow-sm bg-white hover:bg-gray-50 ${
              !isEnabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
              width: '100%',
              maxWidth: 180,
              height: 30,
              paddingLeft: 12,
              paddingRight: 12,
              borderRadius: 10,
            }}
          >
            <span
              style={{
                color: 'rgba(0,0,0,0.50)',
                fontFamily: 'Roboto',
                fontSize: 16,
                fontWeight: 400,
                lineHeight: '24px',
              }}
            >
              {t?.('common.uploadFile') ?? 'Upload File'}
            </span>
            <img src={uploadIcon} alt="Upload" style={{ width: 18, height: 18, flexShrink: 0 }} />
            <input
              type="file"
              accept={accept}
              onChange={(e) => void handleFileChange(docKey, e)}
              onBlur={onBlur}
              disabled={!isEnabled}
              className="hidden"
              ref={(el) => {
                fileInputRefs.current[docKey] = el;
              }}
            />
          </label>
          {hasFile && (
            <div className="flex items-center gap-1 min-w-0 mt-1">
              <img src={fileIcon} alt="" style={{ width: 14, height: 17, flexShrink: 0 }} />
              {canPreview ? (
                <button
                  type="button"
                  onClick={(e) => handlePreview(file!, e)}
                  className="text-sm hover:underline focus:outline-none truncate flex-1"
                  style={{ color: 'var(--owt-color-info, #2563eb)' }}
                  title={fileName}
                >
                  {fileName}
                </button>
              ) : (
                <span className="text-sm text-gray-700 truncate flex-1" title={fileName}>
                  {fileName}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(docKey)}
                className="shrink-0 text-gray-400 hover:text-red-500 focus:outline-none ml-1"
                title="Remove"
              >
                <img src={closeSign} alt="Remove" style={{ width: 12, height: 12 }} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={isReadonly ? 'DocsDisplayWidget mb-[10px]' : 'DocsWidget mb-[10px]'}>
      <div
        className={`grid ${isReadonly ? 'gap-x-8 gap-y-0' : 'gap-4'}`}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {documents.map((doc) => renderSlot(doc))}
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
};
