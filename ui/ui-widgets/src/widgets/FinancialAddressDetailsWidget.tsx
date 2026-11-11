import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import { useWidgetContext } from '../components/WidgetProvider';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { setValue } from '../store/widgetSlice';
import { owtFieldInputClass } from '../theme';
import { BaseWidgetConfig } from '../types';
import { tSchema } from '../utils/tSchema';

const IFSC_TYPE = 'IFSC-BANK-ACCOUNT';

const NO_DETAILS = new Set([
  'MSISDN-WALLET',
  'UPI-VPA-BANK-ACCOUNT',
  'IBAN-BANK-ACCOUNT',
]);

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
  const { t } = useWidgetContext();
  const typeCode = typeCodeFrom(widgetConfig);
  const details = (value && typeof value === 'object' ? value : {}) as Record<string, string>;

  if (!typeCode || NO_DETAILS.has(typeCode)) {
    const note = !typeCode
      ? t?.('choose_financial_address_type')
      : t?.('financial_address_no_details');
    return <span className="text-sm owt-text-muted">{note}</span>;
  }

  const rowValues = (widgetConfig as { 'widget-row-values'?: Record<string, unknown> })['widget-row-values'] || {};
  const rowDetails = rowValues.details;
  const savedDetails = rowDetails && typeof rowDetails === 'object' && !Array.isArray(rowDetails)
    ? rowDetails as Record<string, string>
    : {};
  const shownDetails = Object.keys(details).length ? details : savedDetails;

  if (typeCode === IFSC_TYPE) {
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

  return <DetailsJsonField value={shownDetails} onChange={onChange} label={tSchema(t, widgetConfig['widget-label'] || 'details')} />;
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
          className="min-h-[72px] w-full flex-1 border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
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
  typeCode,
  details,
}: {
  typeCode: string;
  details: Record<string, string>;
}) {
  if (NO_DETAILS.has(typeCode)) {
    return <span className="text-sm owt-text-muted">—</span>;
  }
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
  const [branchLabel, setBranchLabel] = useState(initialIfsc);
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
  useEffect(() => {
    if (banks.length === 0) return;
    const code = (initialProvider || initialIfsc.slice(0, 4)).toUpperCase();
    if (!code) return;
    const match = banks.find((item) => (item.value_code || '').toUpperCase() === code);
    if (!match?.value_id) return;
    const key = `${match.value_id}:${initialIfsc.toUpperCase()}`;
    if (hydratedKey.current === key) return;
    hydratedKey.current = key;
    setBank(match.value_id);
    writeProvider(match.value_code || code);
    if (initialIfsc) setBranchLabel(initialIfsc);
    fetchValues(match.value_id, initialIfsc).then((rows) => {
      const branch = rows.find((item) => (item.value_code || '').toUpperCase() === initialIfsc.toUpperCase());
      setBranches(rows);
      if (branch) setBranchLabel(branch.value_display || initialIfsc);
      if (initialIfsc) onDetails?.(initialIfsc);
    });
  }, [banks, initialProvider, initialIfsc]);

  const chooseBranch = (row: DirectoryRow) => {
    const selectedBank = banks.find((item) => item.value_id === bank);
    const provider = selectedBank?.value_code || '';
    const ifsc = row.value_code || '';
    dispatch(setValue({ widgetId: ifscPath, value: ifsc }));
    writeProvider(provider);
    onDetails?.(ifsc);
    setBranchLabel(row.value_display || ifsc);
  };

  return (
    <div className="fa-details-stack flex w-full flex-col" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <SearchChoice
        label={t?.('bank') || 'Bank'}
        required
        placeholder={loadingBanks ? (t?.('loading') || 'Loading') : (t?.('select') || 'Select')}
        options={banks}
        selectedLabel={banks.find((item) => item.value_id === bank)?.value_display || ''}
        disabled={loadingBanks}
        onSelect={async (row) => {
          const next = row.value_id || '';
          setBank(next);
          setBranchLabel('');
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
  onSelect,
}: {
  label: string;
  placeholder: string;
  options: DirectoryRow[];
  selectedLabel: string;
  disabled?: boolean;
  required?: boolean;
  onSelect: (row: DirectoryRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = options.filter((row) => {
    const haystack = `${row.value_display || ''} ${row.value_code || ''}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="mb-[10px] w-full">
      <div className="flex w-full flex-col sm:flex-row sm:items-start">
        <WidgetFieldLabel
          className="text-base font-medium owt-field-label md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
          label={label}
          required={required}
        />
        <div className="relative w-full min-w-0 sm:w-[180px]">
        <input
          className={owtFieldInputClass({
            disabled,
            className: 'w-full sm:w-[180px] max-w-full h-[30px] px-3 owt-shadow-sm',
          })}
          style={{ borderRadius: '10px' }}
          placeholder={placeholder}
          disabled={disabled}
          value={open ? query : selectedLabel}
          onFocus={() => {
            setQuery('');
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
          }}
        />
        {open && !disabled && (
          <div
            className="owt-field-input absolute left-0 z-20 mt-1 max-h-40 w-full overflow-auto sm:w-[180px]"
            style={{ borderRadius: '10px' }}
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-neutral-500">—</div>
            ) : (
              filtered.map((row) => (
                <button
                  key={row.value_id || row.value_code}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-neutral-900 hover:bg-neutral-100"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(row);
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

/** Bank and branch picker. Only for IFSC accounts; other types use financial-address-details. */
export const BankBranchWidget = ({ config }: WidgetProps) => {
  const { config: widgetConfig } = useBaseWidget({ config });
  const typeCode = typeCodeFrom(widgetConfig);
  if (typeCode && typeCode !== IFSC_TYPE) {
    return <FinancialAddressDetailsWidget config={config} />;
  }
  return <IfscBranchPicker config={config} />;
};
