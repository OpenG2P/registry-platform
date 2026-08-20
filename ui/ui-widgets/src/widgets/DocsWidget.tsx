import React, { useRef } from 'react';
import { tSchema } from '../utils/tSchema';
import { useWidgetContext } from '../components/WidgetProvider';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import { openFileInNewTab } from '../utils/filePreview';
import { serializeFile, deserializeFile, isSerializedFile, SerializedFile } from '../utils/fileSerialization';
import { attachmentIcon, remove, uploadIcon } from '../assets';
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
  source_filename?: string;
}

interface DocsWidgetProps {
  config: BaseWidgetConfig;
}

type DocsSlotValue = (SerializedFile & { label?: string }) | string | null;
type DocsValue = Record<string, DocsSlotValue>;

const getFileName = (file: File | string): string =>
  file instanceof File ? file.name : file.split('/').pop() || file;

const iconButtonClass =
  'inline-flex items-center justify-center shrink-0 p-0 border-0 bg-transparent focus:outline-none';

const docControlClass =
  'w-full h-9 min-w-0 flex items-center rounded-lg px-2.5 box-border';

export const DocsWidget = ({ config }: DocsWidgetProps) => {
  const {
    value,
    error,
    touched,
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
  const currentValue: DocsValue =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as DocsValue)
      : {};

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
        [`${docKey}_source_filename`]: file.name,
      };
      onChange(updated);
    } catch (err) {
      console.error('Error serializing file:', err);
    }

    if (fileInputRefs.current[docKey]) {
      fileInputRefs.current[docKey]!.value = '';
    }
  };

  const handleRemove = (docKey: string) => {
    const updated: DocsValue = {
      ...currentValue,
      [docKey]: null,
      [`${docKey}_source_filename`]: null,
    };
    onChange(updated);
  };

  const handlePreview = (file: File | string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    openFileInNewTab(file);
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

  const getSourceFilename = (docKey: string, file: File | string | null): string => {
    const stored = currentValue[`${docKey}_source_filename`];
    if (typeof stored === 'string' && stored) return stored;
    return file ? getFileName(file) : '';
  };

  const renderSlot = (doc: DocSlotConfig) => {
    const docKey = doc['document-key'];
    const label = doc['document-label'];
    const isRequired = doc['document-required'] ?? false;
    const accept = doc['document-accept'];
    const file = getDocValue(docKey);
    const hasFile = !!file;
    const displayFileName = getSourceFilename(docKey, file);
    const isEmptyRequired = isRequired && !hasFile;
    const showValidationError = touched && error.length > 0 && isEmptyRequired;

    if (isReadonly) {
      return (
        <div
          key={docKey}
          className="mb-[10px] FileDisplayWidget flex flex-row items-start w-full"
        >
          <div
            className="w-1/2 min-w-0 pr-2 text-base text-gray-600 font-medium truncate"
            style={{ fontFamily: 'Roboto, sans-serif' }}
            title={tSchema(t, label)}
          >
            {tSchema(t, label)}:
          </div>
          <div className="w-1/2 min-w-0 flex items-center min-h-[1.5rem]">
            {hasFile ? (
              <>
                <span
                  className="w-10/12 min-w-0 truncate text-base text-gray-900 font-medium"
                  title={displayFileName}
                >
                  {displayFileName}
                </span>
                <button
                  type="button"
                  onClick={(e) => handlePreview(file!, e)}
                  className={`w-2/12 ${iconButtonClass}`}
                  title={displayFileName}
                >
                  <img src={attachmentIcon} alt={t?.('common.view') ?? 'View'} className="h-4 w-4" />
                </button>
              </>
            ) : (
              <span className="text-base text-gray-900 font-medium">-</span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={docKey} className="mb-[10px]">
        <div className="flex flex-row items-start w-full">
          <WidgetFieldLabel
            className="w-1/2 min-w-0 pr-2 text-base font-medium text-gray-700"
            label={tSchema(t, label)}
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
                    ? 'var(--owt-widget-error-color, #B91C1C)'
                    : 'var(--owt-color-primary-dark, #F07B1A)',
                  backgroundColor: 'var(--owt-color-background, #FFFFFF)',
                }}
              >
                <img src={uploadIcon} alt="" className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium text-gray-900">
                  {t?.('common.upload') ?? 'Upload'}
                </span>
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
              <div
                className={`${docControlClass} gap-2 border border-gray-200 bg-white`}
                title={displayFileName}
              >
                <button
                  type="button"
                  onClick={(e) => handlePreview(file!, e)}
                  className={`${iconButtonClass} min-w-0 flex-1 gap-2 justify-start`}
                  title={displayFileName}
                >
                  <img
                    src={attachmentIcon}
                    alt=""
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0 truncate text-sm font-medium text-gray-900">
                    {displayFileName}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(docKey)}
                  disabled={!isEnabled}
                  className={`inline-flex items-center justify-center shrink-0 h-5 w-5 p-0 border-0 rounded-full bg-gray-200 hover:bg-gray-300 focus:outline-none ${
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
              <p className="text-red-500 text-sm mt-1">{error[0]}</p>
            )}
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
    </div>
  );
};
