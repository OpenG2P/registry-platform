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
const distributeDocsToColumns = (
  docs: DocSlotConfig[],
  totalDocs: number,
): DocSlotConfig[][] => {
  const total = totalDocs > 0 ? totalDocs : docs.length;
  const rowsPerColumn = Math.ceil(total / 3);
  if (rowsPerColumn <= 0) {
    return [];
  }

  const columns: DocSlotConfig[][] = [];
  for (let index = 0; index < 3; index += 1) {
    const column = docs.slice(index * rowsPerColumn, (index + 1) * rowsPerColumn);
    if (column.length > 0) {
      columns.push(column);
    }
  }
  return columns;
};

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
  const totalDocs: number = widgetConfig['widget-total-docs'] || documents.length;
  const docColumns = distributeDocsToColumns(documents, totalDocs);
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
                className="inline-flex items-center px-3 py-1 rounded-md border border-gray-300 text-sm font-medium text-gray-900 bg-gray-50 focus:outline-none"
                title={fileName}
              >
                {t?.('common.view') ?? 'View'}
              </button>
            ) : (
              <span className="text-base text-gray-900 font-medium">-</span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={docKey} className="mb-[10px]">
        <div className="flex flex-col sm:flex-row sm:items-start">
          <WidgetFieldLabel
            className="text-base font-medium text-gray-700 md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
            label={tSchema(t, label)}
            required={isRequired}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {!hasFile && (
                <label
                  className={`cursor-pointer inline-flex items-center px-3 py-1 rounded-md border border-gray-300 text-sm font-medium text-gray-900 bg-gray-50 ${
                    !isEnabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {t?.('common.upload') ?? 'Upload'}
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
              )}
              {hasFile && (
                <>
                  <button
                    type="button"
                    onClick={(e) => handlePreview(file!, e)}
                    className="inline-flex items-center px-3 py-1 rounded-md border border-gray-300 text-sm font-medium text-gray-900 bg-gray-50 focus:outline-none"
                    title={fileName}
                  >
                    {t?.('common.view') ?? 'View'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(docKey)}
                    className="inline-flex items-center px-3 py-1 rounded-md border border-gray-300 text-sm font-medium text-gray-900 bg-gray-50 focus:outline-none"
                    title="Remove"
                  >
                    {t?.('common.remove') ?? 'Remove'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={isReadonly ? 'DocsDisplayWidget mb-[10px]' : 'DocsWidget mb-[10px]'}>
      <div
        className="flex flex-col lg:grid w-full"
        style={{ gridTemplateColumns: `repeat(${docColumns.length || 1}, minmax(0, 1fr))` }}
      >
        {docColumns.map((column, columnIndex) => {
          const isLast = columnIndex === docColumns.length - 1;
          const columnClassName = [
            'flex flex-col min-w-0 relative',
            columnIndex > 0 ? 'lg:pl-10' : '',
            isLast ? '' : 'lg:pr-10',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={`docs-column-${columnIndex}`} className={columnClassName}>
              {!isLast && (
                <div
                  className="hidden lg:block absolute right-0 top-0 w-px"
                  style={{
                    bottom: '5px',
                    backgroundColor: isReadonly
                      ? 'var(--owt-panel-divider-color, #C4C4C4)'
                      : 'var(--owt-color-primary, #F5BB1A)',
                  }}
                />
              )}
              {column.map((doc) => renderSlot(doc))}
            </div>
          );
        })}
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
