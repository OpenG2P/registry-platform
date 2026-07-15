import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tSchema } from '../utils/tSchema';
import { useSelector, useDispatch } from 'react-redux';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig, DataSource } from '../types';
import { WidgetRootState } from '../store';
import { setValues } from '../store/widgetSlice';
import { useWidgetContext } from '../components/WidgetProvider';
import { getValueByPath, setValueByPath } from '../utils/pathUtils';
import {
  getStaticDataSource,
  getApiDataSource,
  getSchemaDataSource,
  transformDataSourceOptions,
} from '../utils/dataSource';
import {
  isFile,
  isSerializedFile,
  serializeFile,
} from '../utils/fileSerialization';
import { dummyProfile } from '../assets';

interface FieldConfig {
  'data-source'?: DataSource;
  [key: string]: any;
}

interface HeaderSectionWidgetProps {
  config: BaseWidgetConfig;
}

const DEFAULT_STATUS_COLORS: Record<string, string> = {
  active: '#16A34A',
  inactive: '#D97706',
  archived: '#6B7280',
};

const DEFAULT_LABELS: Record<string, string> = {
  functionalId: 'Functional Record ID',
  status: 'Record Status',
  statusReason: 'Status Reason',
  select: 'Select',
  enterReason: 'Enter Reason',
  createdBy: 'Created by',
  createdAt: 'Created at',
  lastApprovedBy: 'Last Approved by',
  lastApprovedAt: 'Last Approved at',
};

function useFieldDataSource(
  fieldKey: string,
  fieldConfig: FieldConfig | undefined,
  isReadonly: boolean,
) {
  const [options, setOptions] = useState<Array<{ value: any; label: string }>>([]);
  const { dataSourceRequestHandler, schemaData } = useWidgetContext();
  const values = useSelector((state: WidgetRootState) => state.widget.values);

  const dataSource = fieldConfig?.['data-source'] as DataSource | undefined;
  const dsType = dataSource?.type;
  const dsKey = dataSource
    ? `${fieldKey}-${dsType}-${JSON.stringify(dataSource)}`
    : '';

  useEffect(() => {
    if (!dataSource) {
      setOptions([]);
      return;
    }

    if (dataSource.type === 'api' && isReadonly) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        let raw: any[] = [];

        if (dataSource.type === 'static') {
          raw = getStaticDataSource(dataSource as any);
        } else if (dataSource.type === 'api') {
          if (!dataSourceRequestHandler) return;
          raw = await getApiDataSource(
            dataSource as any,
            values,
            dataSourceRequestHandler,
          );
        } else if (dataSource.type === 'schema') {
          raw = getSchemaDataSource(dataSource as any, schemaData || {});
        }

        const transformed = transformDataSourceOptions(
          raw,
          (dataSource as any).valueKey,
          (dataSource as any).labelKey,
        );

        if (!cancelled) setOptions(transformed);
      } catch (err) {
        console.error(
          `[HeaderSectionWidget] Error loading data-source for field "${fieldKey}":`,
          err,
        );
        if (!cancelled) setOptions([]);
      }
    };

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsKey, isReadonly, dataSourceRequestHandler]);

  return options;
}

export const HeaderSectionWidget = ({ config }: HeaderSectionWidgetProps) => {
  const {
    config: widgetConfig,
  } = useBaseWidget({ config });

  const dispatch = useDispatch();
  const { t } = useWidgetContext();
  const { schemaData } = useWidgetContext();
  const values = useSelector((state: WidgetRootState) => state.widget.values);

  const isReadonly = widgetConfig['widget-readonly'] !== false;
  const dataPath = widgetConfig['widget-data-path'];

  const configLabels = (widgetConfig as any)['widget-labels'] as Record<string, string> | undefined;
  const getLabel = useCallback(
    (key: string): string => {
      const englishDefault = DEFAULT_LABELS[key] || key;

      if (configLabels?.[key]) {
        const translated = tSchema(t, configLabels[key]);
        if (translated && translated !== configLabels[key]) return translated;
      }

      const translated = tSchema(t, englishDefault);
      return translated || englishDefault;
    },
    [configLabels, t],
  );

  const fieldConfigMap = useMemo<Record<string, FieldConfig>>(() => {
    return (widgetConfig as any)['widget-field-config'] || {};
  }, [(widgetConfig as any)['widget-field-config']]);

  const statusOptions = useFieldDataSource(
    'status',
    fieldConfigMap['status'],
    isReadonly,
  );

  const paths = useMemo(() => {
    if (!dataPath || typeof dataPath !== 'object') return {} as Record<string, string>;
    return dataPath as Record<string, string>;
  }, [dataPath]);

  const findValue = useCallback(
    (fieldKey: string): any => {
      const path = (paths as Record<string, string>)[fieldKey];
      if (!path) return undefined;

      const searchIn = (source: Record<string, any> | undefined): any => {
        if (!source) return undefined;
        let v = getValueByPath(source, path);
        if (v !== undefined) return v;
        for (const obj of Object.values(source)) {
          if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
            v = getValueByPath(obj, path);
            if (v !== undefined) return v;
          }
        }
        return undefined;
      };

      let result = searchIn(values);
      if (result === undefined) result = searchIn(schemaData);
      return result;
    },
    [paths, values, schemaData],
  );

  const imageUrlVal = findValue('imageUrl');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isFile(imageUrlVal)) {
      const url = URL.createObjectURL(imageUrlVal);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    if (isSerializedFile(imageUrlVal) && imageUrlVal.data) {
      setPreviewUrl(`data:${imageUrlVal.type};base64,${imageUrlVal.data}`);
      return;
    }
    setPreviewUrl(null);
  }, [imageUrlVal]);

  const displayImageUrl =
    previewUrl || (typeof imageUrlVal === 'string' && imageUrlVal ? imageUrlVal : null);

  const displayName = findValue('name') || '';
  const functionalId = findValue('functionalId') || '';
  const statusValue = findValue('status') || '';
  const statusReason = findValue('statusReason') || '';
  const completionScoreRaw = findValue('completionScore');
  const idealScoreRaw = findValue('idealScore');
  const createdBy = findValue('createdBy') || '';
  const createdAt = findValue('createdAt') || '';
  const lastApprovedBy = findValue('lastApprovedBy') || '';
  const lastApprovedAt = findValue('lastApprovedAt') || '';

  const initialStatusRef = useRef<string | null>(null);
  const initialReasonRef = useRef<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const [showReasonRequired, setShowReasonRequired] = useState(false);

  useEffect(() => {
    if (initialStatusRef.current === null) {
      const v = statusValue === undefined || statusValue === null ? '' : String(statusValue);
      initialStatusRef.current = v;
    }
  }, [statusValue]);

  useEffect(() => {
    if (initialReasonRef.current === null) {
      const v = statusReason === undefined || statusReason === null ? '' : String(statusReason);
      initialReasonRef.current = v;
    }
  }, [statusReason]);

  const isStatusChanged = useMemo(() => {
    const initial = initialStatusRef.current;
    if (initial === null) return false;
    return String(statusValue) !== initial;
  }, [statusValue]);

  const isReasonMissing = useMemo(() => {
    if (!isStatusChanged) return false;
    return String(statusReason || '').trim().length === 0;
  }, [isStatusChanged, statusReason]);

  useEffect(() => {
    if (isReadonly) return;
    if (initialStatusRef.current === null) return;

    const currentStatus = String(statusValue || '');
    if (prevStatusRef.current === currentStatus) return;
    prevStatusRef.current = currentStatus;

    const initialStatus = initialStatusRef.current;
    const initialReason = initialReasonRef.current ?? '';

    if (currentStatus === initialStatus) {
      if (String(statusReason || '') !== String(initialReason || '')) {
        updateFieldValue('statusReason', initialReason);
      }
      setShowReasonRequired(false);
      return;
    }

    if (String(statusReason || '').trim().length > 0) {
      updateFieldValue('statusReason', '');
    }
    setShowReasonRequired(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusValue, isReadonly]);

  const score = useMemo(() => {
    const toNum = (v: unknown): number | null => {
      if (v === null || v === undefined || String(v).trim() === '') return null;
      const n = typeof v === 'number' ? v : Number(String(v));
      return Number.isFinite(n) ? n : null;
    };
    const completion = toNum(completionScoreRaw);
    const ideal = toNum(idealScoreRaw);
    if (completion === null || ideal === null || ideal <= 0) return null;
    const ratio = completion / ideal;
    const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    const completionDisplay = Number.isInteger(completion) ? completion : Math.round(completion);
    const idealDisplay = Number.isInteger(ideal) ? ideal : Math.round(ideal);
    return { completion, ideal, completionDisplay, idealDisplay, percent };
  }, [completionScoreRaw, idealScoreRaw]);

  const format = (widgetConfig['widget-data-format'] || {}) as Record<string, any>;
  const imageSize = format.imageSize || 120;
  const nameColor = format.nameColor || 'var(--owt-color-primary-dark, #F07B1A)';
  const statusColors: Record<string, string> = {
    ...DEFAULT_STATUS_COLORS,
    ...(format.statusColors || {}),
  };

  const updateFieldValue = useCallback(
    (fieldKey: string, newValue: any) => {
      const path = (paths as Record<string, string>)[fieldKey];
      if (!path) return;
      const updated = setValueByPath({ ...values }, path, newValue);
      dispatch(setValues(updated));
    },
    [paths, values, dispatch],
  );

  const statusLabel = useMemo(() => {
    if (!statusValue) return '';
    const opt = statusOptions.find(
      (o) => String(o.value).toLowerCase() === String(statusValue).toLowerCase(),
    );
    return opt ? opt.label : String(statusValue);
  }, [statusValue, statusOptions]);

  const statusColor =
    statusColors[String(statusValue).toLowerCase()] || 'var(--owt-color-text-muted, #6B7280)';

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !paths.imageUrl) return;

      try {
        const serialized = await serializeFile(file);
        dispatch(setValues(setValueByPath({ ...values }, paths.imageUrl, serialized)));
      } catch (err) {
        console.error('[HeaderSectionWidget] Error serializing image:', err);
      } finally {
        e.target.value = '';
      }
    },
    [paths.imageUrl, values, dispatch],
  );

  const handleImageDelete = useCallback(() => {
    if (!paths.imageUrl) return;
    setPreviewUrl(null);
    dispatch(setValues(setValueByPath({ ...values }, paths.imageUrl, null)));
  }, [paths.imageUrl, values, dispatch]);

  const cls = `header-section-widget-${widgetConfig['widget-id']}`;

  return (
    <>
      <style>{`
        .${cls} {
          display: flex;
          flex-direction: row;
          gap: 1.5rem;
          width: 100%;
          font-family: Roboto, sans-serif;
          padding: 35px 0 16px 0;
        }

        .${cls} .hdr-left {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          gap: 1rem;
          flex: 1 1 50%;
          min-width: 0;
        }

        .${cls} .hdr-right {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex: 1 1 40%;
          min-width: 220px;
        }

        .${cls} .hdr-right-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          width: 100%;
        }

        .${cls} .hdr-meta-col {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex: 1 1 auto;
          min-width: 0;
        }

        .${cls} .hdr-score-ring {
          --ring-size: 54px;
          --ring-thickness: 7px;
          --ring-color: var(--owt-color-primary-dark, #F07B1A);
          --ring-track: rgba(2, 6, 23, 0.10);
          width: var(--ring-size);
          height: var(--ring-size);
          border-radius: 50%;
          background: conic-gradient(
            var(--ring-color) calc(var(--pct) * 1%),
            var(--ring-track) 0
          );
          position: relative;
          flex: 0 0 auto;
        }

        .${cls} .hdr-score-ring::before {
          content: "";
          position: absolute;
          inset: var(--ring-thickness);
          border-radius: 50%;
          background: var(--owt-color-bg, #FFFFFF);
        }

        .${cls} .hdr-score-value {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 700;
          color: var(--owt-color-text, #011627);
          font-family: Roboto, sans-serif;
        }

        .${cls} .hdr-avatar {
          width: ${imageSize}px;
          height: ${imageSize}px;
          border-radius: 8px;
          object-fit: cover;
          background-color: var(--owt-color-border-light, #e5e7eb);
          border: 2px solid var(--owt-color-border, #d1d5db);
          flex-shrink: 0;
        }

        .${cls} .hdr-avatar-placeholder {
          width: ${imageSize}px;
          height: ${imageSize}px;
          border-radius: 8px;
          background-color: var(--owt-color-border-light, #e5e7eb);
          border: 2px solid var(--owt-color-border, #d1d5db);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
        }

        .${cls} .hdr-avatar-placeholder img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 8px;
        }

        .${cls} .hdr-avatar-wrapper {
          position: relative;
          width: ${imageSize}px;
          height: ${imageSize}px;
          flex-shrink: 0;
        }

        .${cls} .hdr-avatar-overlay {
          position: absolute;
          inset: 0;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.55);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .${cls} .hdr-avatar-wrapper:hover .hdr-avatar-overlay {
          opacity: 1;
        }

        .${cls} .hdr-avatar-action {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 14px;
          border: none;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.92);
          color: #374151;
          font-size: 0.7rem;
          font-weight: 500;
          cursor: pointer;
          font-family: Roboto, sans-serif;
          transition: background 0.15s;
          white-space: nowrap;
        }

        .${cls} .hdr-avatar-action:hover {
          background: #fff;
        }

        .${cls} .hdr-avatar-action--delete {
          color: #DC2626;
        }

        .${cls} .hdr-info {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          min-width: 0;
          flex: 1;
        }

        .${cls} .hdr-name {
          font-size: 1.25rem;
          font-weight: 600;
          color: ${nameColor};
          line-height: 1.4;
          word-wrap: break-word;
        }

        .${cls} .hdr-field-row {
          display: flex;
          align-items: flex-start;
          font-size: 1rem;
          line-height: 1.6;
        }

        .${cls} .hdr-field-label {
          width: 50%;
          flex: 0 0 50%;
          color: rgba(0, 0, 0, 0.5);
          font-weight: 400;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding-right: 4px;
        }

        .${cls} .hdr-field-value {
          width: 50%;
          flex: 0 0 50%;
          color: var(--owt-color-text, #111827);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .${cls} .hdr-status-badge {
          display: inline-block;
          padding: 2px 12px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #fff;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .${cls} .hdr-meta-row {
          display: flex;
          align-items: baseline;
          font-size: 1rem;
          line-height: 1.6;
        }

        .${cls} .hdr-meta-label {
          width: 50%;
          flex: 0 0 50%;
          color: rgba(0, 0, 0, 0.5);
          font-weight: 400;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding-right: 4px;
        }

        .${cls} .hdr-meta-value {
          width: 50%;
          flex: 0 0 50%;
          color: var(--owt-color-text, #111827);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .${cls} .hdr-select {
          height: 32px;
          padding: 0 8px;
          border: 1px solid var(--owt-widget-input-border, #d1d5db);
          border-radius: 6px;
          font-size: 0.875rem;
          font-family: Roboto, sans-serif;
          background: var(--owt-widget-input-bg, #fff);
          min-width: 140px;
          color: var(--owt-btn-primary-color, #374151);
        }
        .${cls} .hdr-select:focus {
          outline: none;
          border-color: var(--owt-widget-input-focus-border, #F07B1A);
          box-shadow: 0 0 0 2px rgba(237, 124, 34, 0.15);
        }

        .${cls} .hdr-input {
          height: 32px;
          padding: 0 8px;
          border: 1px solid var(--owt-widget-input-border, #d1d5db);
          border-radius: 6px;
          font-size: 0.875rem;
          font-family: Roboto, sans-serif;
          background: var(--owt-widget-input-bg, #fff);
          min-width: 140px;
          color: var(--owt-btn-primary-color, #374151);
        }
        .${cls} .hdr-input:focus {
          outline: none;
          border-color: var(--owt-widget-input-focus-border, #F07B1A);
          box-shadow: 0 0 0 2px rgba(237, 124, 34, 0.15);
        }

        .${cls} .hdr-input--error {
          border-color: var(--owt-color-danger, #DC2626);
          box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.12);
        }

        .${cls} .hdr-error-text {
          margin-left: calc(0px);
          color: var(--owt-color-danger, #DC2626);
          font-size: 0.75rem;
          line-height: 1.2;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .${cls} {
            flex-direction: column;
          }
          .${cls} .hdr-right {
            min-width: 0;
          }
        }
      `}</style>

      <div className={cls}>
        <div className="hdr-left">
          <div className="hdr-avatar-wrapper">
            {displayImageUrl ? (
              <img
                src={displayImageUrl}
                alt={displayName || 'Profile'}
                className="hdr-avatar"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const placeholder = (e.target as HTMLImageElement)
                    .parentElement?.querySelector('.hdr-avatar-placeholder') as HTMLElement;
                  if (placeholder) placeholder.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="hdr-avatar-placeholder"
              style={{ display: displayImageUrl ? 'none' : 'flex' }}
            >
              <img src={dummyProfile} alt="Profile Placeholder" />
            </div>

            {!isReadonly && (
              <>
                <div className="hdr-avatar-overlay">
                  <button
                    type="button"
                    className="hdr-avatar-action"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload
                  </button>
                  <button
                    type="button"
                    className="hdr-avatar-action hdr-avatar-action--delete"
                    onClick={handleImageDelete}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Delete
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageUpload}
                />
              </>
            )}
          </div>
          <div className="hdr-info">
            {displayName && <div className="hdr-name">{displayName}</div>}
            <div className="hdr-field-row">
              <span className="hdr-field-label" title={`${getLabel('functionalId')} :`}>
                {getLabel('functionalId')} :
              </span>
              <span className="hdr-field-value" title={functionalId || '-'}>{functionalId || '-'}</span>
            </div>
            <div className="hdr-field-row">
              <span className="hdr-field-label" title={getLabel('status')}>
                {getLabel('status')}
              </span>
              {isReadonly ? (
                statusLabel ? (
                  <span
                    className="hdr-status-badge"
                    style={{ backgroundColor: statusColor }}
                    title={statusLabel}
                  >
                    {statusLabel}
                  </span>
                ) : (
                  <span className="hdr-field-value" title="-">-</span>
                )
              ) : (
                <select
                  className="hdr-select"
                  value={statusValue}
                  onChange={(e) => updateFieldValue('status', e.target.value)}
                >
                  <option value="">
                    {getLabel('select')}
                  </option>
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="hdr-field-row">
              <span className="hdr-field-label" title={`${getLabel('statusReason')} :`}>
                {getLabel('statusReason')} :
              </span>
              {isReadonly ? (
                <span className="hdr-field-value" title={statusReason || '-'}>{statusReason || '-'}</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <input
                    type="text"
                    className={`hdr-input ${(!isReadonly && (showReasonRequired || isReasonMissing) && isReasonMissing) ? 'hdr-input--error' : ''}`}
                    value={statusReason}
                    placeholder={getLabel('enterReason')}
                    required={isStatusChanged}
                    aria-required={isStatusChanged}
                    aria-invalid={!isReadonly && (showReasonRequired || isReasonMissing) && isReasonMissing}
                    onBlur={() => {
                      if (isReasonMissing) setShowReasonRequired(true);
                    }}
                    onChange={(e) => {
                      updateFieldValue('statusReason', e.target.value);
                      if (showReasonRequired && String(e.target.value || '').trim().length > 0) {
                        setShowReasonRequired(false);
                      }
                    }}
                  />
                  {!isReadonly && (showReasonRequired || isReasonMissing) && isReasonMissing ? (
                    <div className="hdr-error-text">
                      {getLabel('enterReason')}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="hdr-right">
          <div className="hdr-right-top">
            <div className="hdr-meta-col">
              <div className="hdr-meta-row">
                <span className="hdr-meta-label" title={`${getLabel('createdBy')} :`}>
                  {getLabel('createdBy')} :
                </span>
                <span className="hdr-meta-value" title={createdBy || '-'}>{createdBy || '-'}</span>
              </div>

              <div className="hdr-meta-row">
                <span className="hdr-meta-label" title={`${getLabel('createdAt')} :`}>
                  {getLabel('createdAt')} :
                </span>
                <span className="hdr-meta-value" title={createdAt || '-'}>{createdAt || '-'}</span>
              </div>

              <div className="hdr-meta-row">
                <span className="hdr-meta-label" title={`${getLabel('lastApprovedBy')} :`}>
                  {getLabel('lastApprovedBy')} :
                </span>
                <span className="hdr-meta-value" title={lastApprovedBy || '-'}>{lastApprovedBy || '-'}</span>
              </div>

              <div className="hdr-meta-row">
                <span className="hdr-meta-label" title={`${getLabel('lastApprovedAt')} :`}>
                  {getLabel('lastApprovedAt')} :
                </span>
                <span className="hdr-meta-value" title={lastApprovedAt || '-'}>{lastApprovedAt || '-'}</span>
              </div>
            </div>

            {score ? (
              <div
                className="hdr-score-ring"
                style={{ ['--pct' as any]: score.percent }}
                aria-label={`Completion score ${score.completionDisplay} of ${score.idealDisplay} (${score.percent}%)`}
                title={`${score.completionDisplay} / ${score.idealDisplay} (${score.percent}%)`}
              >
                <div className="hdr-score-value">{String(score.completionDisplay)}</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};
