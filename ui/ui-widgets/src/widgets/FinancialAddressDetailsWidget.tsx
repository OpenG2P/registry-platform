import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import { useWidgetContext } from '../components/WidgetProvider';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { setValue } from '../store/widgetSlice';
import { owtFieldInputClass } from '../theme';
import { BaseWidgetConfig } from '../types';
import { tSchema } from '../utils/tSchema';

type DetailsMode = 'none' | 'ifsc' | 'json';

type TypeMeta = { schema: unknown; kind: string; providerRequired: boolean };
type ProviderOption = { code: string; label: string; services: string[] };

let typeMeta: Record<string, TypeMeta> | null = null;
let typeMetaPromise: Promise<void> | null = null;
let providerOptions: ProviderOption[] | null = null;
let providerOptionsPromise: Promise<void> | null = null;

function modeFromSchema(schema: unknown): DetailsMode {
  if (!schema || typeof schema !== 'object') return 'none';
  const properties = (schema as { properties?: Record<string, unknown> }).properties;
  if (!properties || !Object.keys(properties).length) return 'none';
  if (properties.ifsc) return 'ifsc';
  return 'json';
}

interface WidgetProps {
  config: BaseWidgetConfig;
}

function typeCodeFrom(widgetConfig: BaseWidgetConfig): string {
  const fixed = (widgetConfig as { 'widget-address-type'?: string })['widget-address-type'];
  if (fixed) return fixed;
  const rowValues = (widgetConfig as { 'widget-row-values'?: Record<string, string> })['widget-row-values'] || {};
  const typeField = (widgetConfig as { 'widget-type-field'?: string })['widget-type-field'] || 'financial_address_type';
  return rowValues[typeField] || '';
}

export const FinancialAddressDetailsWidget = ({ config }: WidgetProps) => {
  const { value, onChange, config: widgetConfig } = useBaseWidget({ config });
  const { dataSourceRequestHandler, t } = useWidgetContext();
  const typeCode = typeCodeFrom(widgetConfig);
  const details = (value && typeof value === 'object' ? value : {}) as Record<string, string>;
  const [mode, setMode] = useState<DetailsMode>('none');
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [providerRequired, setProviderRequired] = useState(false);
  const [providerKind, setProviderKind] = useState('');

  useEffect(() => {
    if (!typeCode || !dataSourceRequestHandler) {
      setMode('none');
      setProviderRequired(false);
      return;
    }
    let cancelled = false;
    const loadTypes = typeMeta
      ? Promise.resolve()
      : (typeMetaPromise ??= dataSourceRequestHandler(
          'attributes',
          'values',
          'POST',
          { attribute_id: 'FINANCIAL_ADDRESS_TYPE' },
        ).then((rows) => {
          const next: Record<string, TypeMeta> = {};
          for (const row of Array.isArray(rows) ? rows : []) {
            if (!row?.value_code) continue;
            next[row.value_code] = {
              schema: row.attributes?.details_schema ?? null,
              kind: String(row.attributes?.kind || ''),
              providerRequired: Boolean(row.attributes?.provider_required),
            };
          }
          typeMeta = next;
        }).catch(() => {
          typeMeta = {};
        }));
    const loadProviders = providerOptions
      ? Promise.resolve()
      : (providerOptionsPromise ??= dataSourceRequestHandler(
          'attributes',
          'values',
          'POST',
          { attribute_id: 'FINANCIAL_SERVICE_PROVIDER' },
        ).then((rows) => {
          providerOptions = (Array.isArray(rows) ? rows : []).flatMap((row) => {
            const code = String(row?.value_code || '');
            if (!code) return [];
            const services = Array.isArray(row.attributes?.services) ? row.attributes.services.map(String) : [];
            return [{ code, label: String(row.value_display || code), services }];
          });
        }).catch(() => {
          providerOptions = [];
        }));
    Promise.all([loadTypes, loadProviders]).then(() => {
      if (cancelled) return;
      const meta = typeMeta?.[typeCode];
      const nextMode = modeFromSchema(meta?.schema);
      setMode(nextMode);
      setProviderKind(meta?.kind || '');
      setProviderRequired(Boolean(meta?.providerRequired) && nextMode !== 'ifsc');
      setProviders(providerOptions || []);
    });
    return () => {
      cancelled = true;
    };
  }, [typeCode, dataSourceRequestHandler]);

  const rowValues = (widgetConfig as { 'widget-row-values'?: Record<string, unknown> })['widget-row-values'] || {};
  const setRowValue = (widgetConfig as { 'widget-set-row-value'?: (columnKey: string, value: unknown) => void })['widget-set-row-value'];
  const matchingProviders = providers.filter((provider) => providerKind && provider.services.includes(providerKind));

  if (!typeCode || (!providerRequired && mode === 'none')) {
    return null;
  }

  const rowDetails = rowValues.details;
  const savedDetails = rowDetails && typeof rowDetails === 'object' && !Array.isArray(rowDetails)
    ? rowDetails as Record<string, string>
    : {};
  const shownDetails = Object.keys(details).length ? details : savedDetails;

  const providerField = providerRequired ? (
    <ProviderChoice
      label={tSchema(t, 'provider_code')}
      options={matchingProviders}
      value={String(rowValues.provider_code || '')}
      onChange={(code) => setRowValue?.('provider_code', code)}
    />
  ) : null;

  if (mode === 'ifsc') {
    const rowIfsc = String(shownDetails.ifsc || '');
    return (
      <IfscBranchPicker
        config={config}
        initialProvider={String(rowValues.provider_code || '')}
        initialIfsc={String(details.ifsc || rowIfsc || '')}
        onDetails={(ifsc) => onChange({ ...(shownDetails || {}), ifsc })}
      />
    );
  }

  return (
    <>
      {providerField}
      {mode === 'json' && (
        <DetailsJsonField value={shownDetails} onChange={onChange} label={tSchema(t, widgetConfig['widget-label'] || 'details')} />
      )}
    </>
  );
}

function ProviderChoice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ProviderOption[];
  value: string;
  onChange: (code: string) => void;
}) {
  const { t } = useWidgetContext();
  const known = options.some((option) => option.code === value);
  return (
    <div className="mb-[10px]">
      <div className="flex flex-col sm:flex-row sm:items-start">
        <WidgetFieldLabel
          className="text-base font-medium owt-field-label md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
          label={label}
          required
        />
        <select
          className={owtFieldInputClass({
            className: 'w-full sm:w-[180px] max-w-full h-[30px] px-3 owt-shadow-sm',
          })}
          style={{ borderRadius: '10px' }}
          value={known ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{options.length === 0 ? (t?.('loading') || 'Loading') : (t?.('select') || 'Select')}</option>
          {options.map((option) => (
            <option key={option.code} value={option.code}>{option.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function DetailsJsonField({
  value,
  onChange,
  label,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  label: string;
}) {
  const { t } = useWidgetContext();
  const serialized = JSON.stringify(value && Object.keys(value).length ? value : {}, null, 2);
  const [text, setText] = useState(serialized);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(serialized);
    setInvalid(false);
  }, [serialized]);

  return (
    <div className="mb-[10px]">
      <div className="flex flex-col sm:flex-row sm:items-start">
        <span className="text-base font-medium owt-field-label md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0">{label}</span>
        <textarea
          className={owtFieldInputClass({
            error: invalid,
            className: 'min-h-[72px] w-full sm:w-[180px] max-w-full px-3 py-2 text-sm',
          })}
          style={{ borderRadius: '10px', fontFamily: 'Roboto, monospace' }}
          rows={3}
          value={text}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            try {
              const parsed = JSON.parse(next);
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                setInvalid(false);
                onChange(parsed);
              } else {
                setInvalid(true);
              }
            } catch {
              setInvalid(true);
            }
          }}
        />
      </div>
      {invalid && <p className="owt-field-error text-sm mt-1">{t?.('invalid_json') || 'Enter valid JSON. Text values need quotes, for example {"rail": "RAAST"}'}</p>}
    </div>
  );
};

function DetailsSummary({
  details,
}: {
  details: Record<string, string>;
}) {
  const text = Object.entries(details)
    .filter(([, entry]) => entry)
    .map(([key, entry]) => `${key}: ${entry}`)
    .join(', ');
  return <span className="text-sm">{text || '—'}</span>;
}

type DirectoryRow = {
  value_id?: string;
  value_code?: string;
  value_display?: string;
  parent_value_id?: string | null;
};

const IfscBranchPicker = ({
  config,
  onDetails,
  initialProvider = '',
  initialIfsc = '',
}: {
  config: BaseWidgetConfig;
  onDetails?: (ifsc: string) => void;
  initialProvider?: string;
  initialIfsc?: string;
}) => {
  const { config: widgetConfig } = useBaseWidget({ config });
  const { dataSourceRequestHandler, t } = useWidgetContext();
  const dispatch = useDispatch();
  const [banks, setBanks] = useState<DirectoryRow[]>([]);
  const [branches, setBranches] = useState<DirectoryRow[]>([]);
  const [bank, setBank] = useState('');
  const [bankLabel, setBankLabel] = useState('');
  const [branchLabel, setBranchLabel] = useState(initialIfsc);
  const selectedBank = useRef<DirectoryRow | null>(null);
  const bankSearch = useRef(0);
  const branchSearch = useRef(0);
  const searchBanks = (q: string) => {
    const request = ++bankSearch.current;
    fetchValues('', q).then((rows) => {
      if (bankSearch.current === request) setBanks(rows);
    });
  };
  const searchBranches = (q: string) => {
    const parent = bank;
    const request = ++branchSearch.current;
    fetchValues(parent, q).then((rows) => {
      if (branchSearch.current === request) setBranches(rows);
    });
  };
  const [loadingBanks, setLoadingBanks] = useState(false);
  const service = (widgetConfig as { 'widget-service'?: string })['widget-service'] || 'attributes';
  const attributeId = (widgetConfig as { 'widget-attribute-id'?: string })['widget-attribute-id'] || 'IFSC_DIRECTORY';
  const providerPath = (widgetConfig as { 'widget-provider-path'?: string })['widget-provider-path'] || 'provider_code';
  const setRowValue = (widgetConfig as { 'widget-set-row-value'?: (columnKey: string, value: unknown) => void })['widget-set-row-value'];
  const writeProvider = (code: string) => {
    if (setRowValue) setRowValue(providerPath, code);
    else dispatch(setValue({ widgetId: providerPath, value: code }));
  };
  const ifscPath = (widgetConfig as { 'widget-ifsc-path'?: string })['widget-ifsc-path'] || 'details.ifsc';

  const fetchValues = async (parent: string, q: string): Promise<DirectoryRow[]> => {
    if (!dataSourceRequestHandler) return [];
    const response = await dataSourceRequestHandler(service, 'values', 'POST', {
      attribute_id: attributeId,
      parent_value_id: parent,
      q: q || undefined,
    });
    const rows = Array.isArray(response)
      ? response
      : response?.attribute_values
        || response?.response_body?.response_payload?.attribute_values
        || [];
    return Array.isArray(rows) ? rows : [];
  };

  useEffect(() => {
    let cancelled = false;
    setLoadingBanks(true);
    fetchValues('', '')
      .then((rows) => {
        if (!cancelled) setBanks(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingBanks(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hydratedKey = useRef('');
  const bankChosenByUser = useRef(false);
  useEffect(() => {
    if (bankChosenByUser.current || banks.length === 0) return;
    const code = (initialProvider || initialIfsc.slice(0, 4)).toUpperCase();
    if (!code) return;
    const match = banks.find((item) => (item.value_code || '').toUpperCase() === code);
    if (!match?.value_id) return;
    const key = `${match.value_id}:${initialIfsc.toUpperCase()}`;
    if (hydratedKey.current === key) return;
    hydratedKey.current = key;
    selectedBank.current = match;
    setBank(match.value_id);
    setBankLabel(match.value_display || match.value_code || code);
    writeProvider(match.value_code || code);
    if (initialIfsc) setBranchLabel(initialIfsc);
    fetchValues(match.value_id, '').then((rows) => {
      const branch = rows.find((item) => (item.value_code || '').toUpperCase() === initialIfsc.toUpperCase());
      setBranches(rows);
      if (branch) setBranchLabel(branch.value_display || initialIfsc);
      if (initialIfsc) onDetails?.(initialIfsc);
    });
  }, [banks, initialProvider, initialIfsc]);

  const chooseBranch = (row: DirectoryRow) => {
    const provider = selectedBank.current?.value_code || '';
    const ifsc = row.value_code || '';
    dispatch(setValue({ widgetId: ifscPath, value: ifsc }));
    writeProvider(provider);
    onDetails?.(ifsc);
    setBranchLabel(row.value_display || ifsc);
  };

  return (
    <div className="fa-details-stack flex w-full flex-col gap-4" style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '1rem' }}>
      <SearchChoice
        label={t?.('bank') || 'Bank'}
        required
        placeholder={loadingBanks ? (t?.('loading') || 'Loading') : (t?.('select') || 'Select')}
        options={banks}
        selectedLabel={bankLabel}
        disabled={loadingBanks}
        onQuery={searchBanks}
        onSelect={async (row) => {
          const next = row.value_id || '';
          bankChosenByUser.current = true;
          selectedBank.current = row;
          setBank(next);
          setBankLabel(row.value_display || row.value_code || '');
          setBranchLabel('');
          onDetails?.('');
          setBranches(next ? await fetchValues(next, '') : []);
          writeProvider(row.value_code || '');
        }}
      />
      <SearchChoice
        label={t?.('branch') || 'Branch'}
        required
        placeholder={t?.('branch_search_placeholder') || 'Branch name or IFSC'}
        options={branches}
        selectedLabel={branchLabel}
        disabled={!bank}
        onQuery={searchBranches}
        onSelect={chooseBranch}
      />
    </div>
  );
};

function SearchChoice({
  label,
  placeholder,
  options,
  selectedLabel,
  disabled,
  required,
  onQuery,
  onSelect,
}: {
  label: string;
  placeholder: string;
  options: DirectoryRow[];
  selectedLabel: string;
  disabled?: boolean;
  required?: boolean;
  onQuery?: (query: string) => void;
  onSelect: (row: DirectoryRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [typing, setTyping] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const queryTimer = useRef<number | undefined>(undefined);
  const placeMenu = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuBox({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  };
  const search = (next: string) => {
    window.clearTimeout(queryTimer.current);
    queryTimer.current = window.setTimeout(() => onQuery?.(next.trim()), 300);
  };

  return (
    <div className="mb-[10px] w-full">
      <div className="flex w-full flex-col sm:flex-row sm:items-start">
        <WidgetFieldLabel
          className="text-base font-medium owt-field-label md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
          label={label}
          required={required}
        />
        <div className="relative w-full min-w-0 sm:w-[180px]" ref={anchorRef}>
        <input
          className={owtFieldInputClass({
            disabled,
            className: 'w-full sm:w-[180px] max-w-full h-[30px] px-3 owt-shadow-sm',
          })}
          style={{ borderRadius: '10px' }}
          placeholder={selectedLabel ? undefined : placeholder}
          title={selectedLabel || undefined}
          disabled={disabled}
          value={typing ? query : selectedLabel}
          onFocus={() => {
            setTyping(false);
            setQuery('');
            placeMenu();
            setOpen(true);
          }}
          onChange={(event) => {
            const next = event.target.value;
            setTyping(true);
            setQuery(next);
            search(next);
            placeMenu();
            setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false);
              setTyping(false);
              setQuery('');
            }, 150);
          }}
        />
        {open && !disabled && menuBox && (
          <div
            className="owt-field-input overflow-y-auto"
            style={{
              position: 'fixed',
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
              zIndex: 80,
              maxHeight: '20rem',
              borderRadius: '10px',
            }}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-neutral-500">—</div>
            ) : (
              options.map((row) => (
                <button
                  key={row.value_id || row.value_code}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-neutral-900 hover:bg-neutral-100"
                  title={row.value_display || row.value_code}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    window.clearTimeout(queryTimer.current);
                    onSelect(row);
                    setTyping(false);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  {row.value_display || row.value_code}
                  {row.value_code && row.value_display ? ` · ${row.value_code}` : ''}
                </button>
              ))
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

/** Bank and branch picker when the selected type's details schema includes ifsc. */
export const BankBranchWidget = ({ config }: WidgetProps) => {
  return <FinancialAddressDetailsWidget config={config} />;
};
