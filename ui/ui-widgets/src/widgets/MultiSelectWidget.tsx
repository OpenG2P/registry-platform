import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { tSchema } from '../utils/tSchema';
import { useWidgetContext } from '../components/WidgetProvider';
import { createPortal } from 'react-dom';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';

type DropdownPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: 'bottom' | 'top';
};

interface MultiSelectWidgetProps {
  config: BaseWidgetConfig;
}

export const MultiSelectWidget = ({ config }: MultiSelectWidgetProps) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    isRequired,
    onChange,
    onBlur,
    dataSourceOptions,
    loading,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const { t } = useWidgetContext();

  const [isOpen, setIsOpen] = useState(false);
  const [isListPopupOpen, setIsListPopupOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
  const [listPopupPosition, setListPopupPosition] = useState<DropdownPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listPopupRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const formatConfig = widgetConfig['widget-data-format'];
  const sortOptions = formatConfig?.sortOptions ?? false;

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateDropdownPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openDown = spaceBelow >= 160 || spaceBelow >= spaceAbove;
    const availableSpace = openDown ? spaceBelow : spaceAbove;
    const maxHeight = Math.min(320, Math.max(160, availableSpace - 8));

    setDropdownPosition(
      openDown
        ? {
            top: rect.bottom + gap,
            left: rect.left,
            width: rect.width,
            maxHeight,
            placement: 'bottom',
          }
        : {
            bottom: window.innerHeight - rect.top + gap,
            left: rect.left,
            width: rect.width,
            maxHeight,
            placement: 'top',
          }
    );
  }, []);

  const updateListPopupPosition = useCallback(() => {
    const anchor = moreButtonRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openDown = spaceBelow >= 120 || spaceBelow >= spaceAbove;
    const availableSpace = openDown ? spaceBelow : spaceAbove;
    const maxHeight = Math.min(280, Math.max(120, availableSpace - 8));

    setListPopupPosition(
      openDown
        ? {
            top: rect.bottom + gap,
            left: rect.left,
            width: Math.max(rect.width, 220),
            maxHeight,
            placement: 'bottom',
          }
        : {
            bottom: window.innerHeight - rect.top + gap,
            left: rect.left,
            width: Math.max(rect.width, 220),
            maxHeight,
            placement: 'top',
          }
    );
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setDropdownPosition(null);
      setSearchQuery('');
      return;
    }

    updateDropdownPosition();

    const handleResize = () => updateDropdownPosition();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    if (!isListPopupOpen) {
      setListPopupPosition(null);
      return;
    }

    updateListPopupPosition();

    const handleResize = () => updateListPopupPosition();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isListPopupOpen, updateListPopupPosition]);

  useEffect(() => {
    if (!isOpen && !isListPopupOpen) return;

    const handleScroll = (event: Event) => {
      const target = event.target as Node;
      if (dropdownRef.current?.contains(target)) return;
      if (listPopupRef.current?.contains(target)) return;
      if (isOpen) setIsOpen(false);
      if (isListPopupOpen) setIsListPopupOpen(false);
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen, isListPopupOpen]);

  useEffect(() => {
    if (!isOpen && !isListPopupOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (isOpen) {
        if (containerRef.current?.contains(target)) return;
        if (dropdownRef.current?.contains(target)) return;
        setIsOpen(false);
      }
      if (isListPopupOpen) {
        if (listPopupRef.current?.contains(target)) return;
        if (moreButtonRef.current?.contains(target)) return;
        setIsListPopupOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isListPopupOpen]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const processedOptions = useMemo(() => {
    let options = dataSourceOptions.map((opt) => {
      const rawLabel = String(opt.label ?? opt.value ?? '');
      return {
        value: opt.value,
        label: tSchema(t, rawLabel),
        rawLabel,
      };
    });
    if (sortOptions) {
      options.sort((a, b) => a.label.localeCompare(b.label));
    }
    return options;
  }, [dataSourceOptions, sortOptions, t]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return processedOptions;
    const q = searchQuery.trim().toLowerCase();
    return processedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.rawLabel.toLowerCase().includes(q)
    );
  }, [processedOptions, searchQuery]);

  const selectedValues: any[] = useMemo(() => {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) return value;
    return [value];
  }, [value]);

  const allFilteredSelected = useMemo(() => {
    if (filteredOptions.length === 0) return false;
    return filteredOptions.every((opt) => selectedValues.includes(opt.value));
  }, [filteredOptions, selectedValues]);

  const handleToggle = useCallback(
    (optionValue: any, checked: boolean) => {
      if (checked) {
        onChange([...selectedValues, optionValue]);
      } else {
        onChange(selectedValues.filter((v: any) => v !== optionValue));
      }
    },
    [selectedValues, onChange]
  );

  const handleSelectAll = useCallback(() => {
    const filteredVals = filteredOptions.map((o) => o.value);
    const merged = Array.from(new Set([...selectedValues, ...filteredVals]));
    onChange(merged);
  }, [filteredOptions, selectedValues, onChange]);

  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const selectedLabels = useMemo(() => {
    return selectedValues.map((val) => {
      const opt = processedOptions.find((o) => o.value === val);
      return opt ? opt.label : tSchema(t, String(val));
    });
  }, [selectedValues, processedOptions, t]);

  const fullSelectionText = selectedLabels.join(', ');
  const visibleLabels = selectedLabels.slice(0, 5);
  const overflowCount = Math.max(0, selectedLabels.length - 10);
  const disabled = !isEnabled || loading || widgetConfig['widget-readonly'];

  const renderSelectedLabels = (options?: { readonly?: boolean }) => {
    if (selectedLabels.length === 0) return null;

    const readonly = options?.readonly ?? false;

    return (
      <div className={`flex flex-wrap gap-1 ${readonly ? '' : 'mt-1.5'}`}>
        {visibleLabels.map((label, index) => (
          <span
            key={`${selectedValues[index]}-${label}`}
            className="inline-flex max-w-full items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-800"
            title={label}
          >
            <span className="truncate">{label}</span>
            {!readonly && !disabled && (
              <button
                type="button"
                onClick={() => handleToggle(selectedValues[index], false)}
                className="shrink-0 text-blue-600 hover:text-blue-900 focus:outline-none"
                aria-label={t?.('common.removeItem', {
                  label,
                  defaultValue: `Remove ${label}`,
                })}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {overflowCount > 0 && (
          <button
            ref={moreButtonRef}
            type="button"
            onClick={() => setIsListPopupOpen((prev) => !prev)}
            className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {t?.('common.moreSelected', {
              count: overflowCount,
              defaultValue: `+${overflowCount} more`,
            })}
          </button>
        )}
      </div>
    );
  };

  const listPopupPanel =
    isListPopupOpen && listPopupPosition && mounted ? (
      <div
        ref={listPopupRef}
        className="fixed z-[201] bg-white border border-gray-300 shadow-lg"
        style={{
          ...(listPopupPosition.placement === 'bottom'
            ? { top: listPopupPosition.top }
            : { bottom: listPopupPosition.bottom }),
          left: listPopupPosition.left,
          width: listPopupPosition.width,
          maxWidth: '320px',
          maxHeight: listPopupPosition.maxHeight,
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="px-3 py-2 text-xs font-semibold text-gray-500 shrink-0"
          style={{ borderBottom: '1px solid #e5e7eb' }}
        >
          {t?.('common.allSelected', {
            count: selectedLabels.length,
            defaultValue: `All selected (${selectedLabels.length})`,
          })}
        </div>
        <div className="overflow-y-auto flex-1 min-h-0 py-1 overscroll-contain">
          {selectedLabels.map((label, index) => (
            <div
              key={`${selectedValues[index]}-${label}`}
              className="px-3 py-1.5 text-sm text-gray-700"
              title={label}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ) : null;

  if (widgetConfig['widget-readonly']) {
    const fieldLabel = widgetConfig['widget-label'];

    return (
      <div className="mb-[10px] MultiSelectDisplayWidget flex flex-col sm:flex-row sm:items-start">
        {fieldLabel && (
          <WidgetFieldLabel
            className="text-base text-gray-600 font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0"
            label={fieldLabel}
          />
        )}
        <div className="flex-1 min-w-0">
          {selectedLabels.length === 0 ? (
            <div className="text-base text-gray-900 font-medium">-</div>
          ) : (
            renderSelectedLabels({ readonly: true })
          )}
          {mounted && listPopupPanel && typeof document !== 'undefined'
            ? createPortal(listPopupPanel, document.body)
            : null}
        </div>
      </div>
    );
  }

  const optionsMaxHeight = dropdownPosition
    ? Math.min(280, dropdownPosition.maxHeight - 100)
    : 280;

  const dropdownPanel =
    isOpen && dropdownPosition && mounted ? (
      <div
        ref={dropdownRef}
        className="fixed z-[200] bg-white border border-gray-300 shadow-lg"
        style={{
          ...(dropdownPosition.placement === 'bottom'
            ? { top: dropdownPosition.top }
            : { bottom: dropdownPosition.bottom }),
          left: dropdownPosition.left,
          width: dropdownPosition.width,
          maxWidth: '280px',
          maxHeight: dropdownPosition.maxHeight,
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="px-3 pt-2 pb-1 shrink-0" style={{ borderBottom: '1px solid #e5e7eb' }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder={t?.('common.searchPlaceholder', { defaultValue: 'Search...' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[28px] px-2 text-sm border border-gray-300 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            style={{ borderRadius: '6px' }}
          />
        </div>

        <div
          className="flex items-center justify-between px-3 py-1 shrink-0"
          style={{ borderBottom: '1px solid #e5e7eb' }}
        >
          <button
            type="button"
            onClick={allFilteredSelected ? () => {
              const filteredVals = new Set(filteredOptions.map((o) => o.value));
              onChange(selectedValues.filter((v: any) => !filteredVals.has(v)));
            } : handleSelectAll}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 focus:outline-none"
          >
            {allFilteredSelected
              ? t?.('common.deselectAll', { defaultValue: 'Deselect All' })
              : t?.('common.selectAll', { defaultValue: 'Select All' })}
          </button>
          {selectedValues.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs font-medium text-red-500 hover:text-red-700 focus:outline-none"
            >
              {t?.('common.clearAll', { defaultValue: 'Clear All' })}
            </button>
          )}
        </div>

        <div
          className="overflow-y-auto flex-1 min-h-0 py-1 overscroll-contain"
          style={{ maxHeight: `${Math.max(80, optionsMaxHeight)}px` }}
        >
          {loading ? (
            <p className="text-sm text-gray-500 px-3 py-2">
              {t?.('common.loading')}
            </p>
          ) : filteredOptions.length === 0 ? (
            <p className="text-sm text-gray-400 px-3 py-2">
              {t?.('common.noOptionsFound', { defaultValue: 'No options found' })}
            </p>
          ) : (
            filteredOptions.map((option) => {
              const isChecked = selectedValues.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={`flex items-center gap-2 px-3 py-1 cursor-pointer hover:bg-blue-50 ${
                    isChecked ? 'bg-blue-50/60' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handleToggle(option.value, e.target.checked)}
                    className="h-4 w-4 shrink-0 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 leading-normal select-none">
                    {option.label}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </div>
    ) : null;

  return (
    <div className="mb-[10px]">
      <div className="flex flex-col sm:flex-row sm:items-start">
        <WidgetFieldLabel
          className="text-base font-medium text-gray-700 md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
          label={widgetConfig['widget-label'] ?? ''}
          required={isRequired}
        />

        <div className="flex-1 min-w-0" ref={containerRef}>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => {
              if (!disabled) setIsOpen((prev) => !prev);
            }}
            onBlur={() => {
              if (!isOpen) onBlur();
            }}
            disabled={disabled}
            className={`w-full sm:w-[280px] max-w-full h-[30px] px-3 border shadow-sm text-left flex items-center justify-between gap-2 ${
              (touched && error.length > 0) ||
              (widgetConfig['widget-required'] && selectedValues.length === 0)
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300'
            } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-pointer'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
            style={{ borderRadius: '10px' }}
            title={
              selectedValues.length > 0
                ? fullSelectionText
                : tSchema(t, widgetConfig['widget-data-tooltip'])
            }
          >
            <span
              className={`truncate text-sm ${
                selectedValues.length === 0 ? 'text-gray-400' : 'text-gray-900'
              }`}
            >
              {selectedLabels.length === 0
                ? t?.('common.select', { defaultValue: 'Select...' })
                : t?.('common.selectedCount', {
                    count: selectedLabels.length,
                    defaultValue: `${selectedLabels.length} selected`,
                  })}
            </span>
            <svg
              className={`w-4 h-4 flex-shrink-0 text-gray-500 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {mounted && dropdownPanel && typeof document !== 'undefined'
            ? createPortal(dropdownPanel, document.body)
            : null}

          {selectedLabels.length > 0 && renderSelectedLabels()}

          {mounted && listPopupPanel && typeof document !== 'undefined'
            ? createPortal(listPopupPanel, document.body)
            : null}

          {touched && error.length > 0 && (
            <p className="text-red-500 text-sm mt-1">{error[0]}</p>
          )}
          {loading && (
            <p className="text-sm text-gray-500 mt-1">{t?.('common.loadingOptions')}</p>
          )}
        </div>
      </div>
    </div>
  );
};
