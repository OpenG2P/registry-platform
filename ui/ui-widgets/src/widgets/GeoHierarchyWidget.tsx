import { tSchema } from '../utils/tSchema';
import { useWidgetContext } from '../components/WidgetProvider';
import { BaseWidgetConfig } from '../types';
import { useGeoHierarchy } from '../hooks/useGeoHierarchy';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import { GeoLevel } from '../utils/geoHierarchy';

interface GeoHierarchyWidgetProps {
  config: BaseWidgetConfig;
}

function resolveDisplayValue(
  levelId: string,
  selectedValues: Record<string, string>,
  options: Record<string, Array<{ value: string; label: string }>>,
  resolvedLabels: Record<string, string>,
  loading: boolean,
): string {
  const selected = selectedValues[levelId];
  if (!selected) {
    return '-';
  }
  const option = options[levelId]?.find((item) => item.value === selected);
  if (option?.label) {
    return option.label;
  }
  if (resolvedLabels[selected]) {
    return resolvedLabels[selected];
  }
  return loading ? '-' : selected;
}

function renderLevelRows({
  columnLevels,
  levels,
  isReadonly,
  selectedValues,
  options,
  resolvedLabels,
  loadingLevels,
  loadingLevelId,
  isEnabled,
  isRequired,
  showValidationError,
  t,
  onBlur,
  handleLevelChange,
  isLevelEnabled,
  formatLevelLabel,
}: {
  columnLevels: GeoLevel[];
  levels: GeoLevel[];
  isReadonly: boolean;
  selectedValues: Record<string, string>;
  options: Record<string, Array<{ value: string; label: string }>>;
  resolvedLabels: Record<string, string>;
  loadingLevels: boolean;
  loadingLevelId: string | null;
  isEnabled: boolean;
  isRequired: boolean;
  showValidationError: boolean;
  t?: (key: string, options?: Record<string, unknown>) => string;
  onBlur: () => void;
  handleLevelChange: (levelIndex: number, nextValue: string | undefined) => void;
  isLevelEnabled: (levelIndex: number) => boolean;
  formatLevelLabel: (mnemonic: string) => string;
}) {
  return columnLevels.map((level) => {
    const levelIndex = levels.findIndex((item) => item.level_id === level.level_id);
    const levelLabel = formatLevelLabel(level.level_mnemonic);

    if (isReadonly) {
      const displayValue = resolveDisplayValue(
        level.level_id,
        selectedValues,
        options,
        resolvedLabels,
        loadingLevels,
      );

      return (
        <div
          key={level.level_id}
          className="mb-[10px] SelectDisplayWidget flex flex-col sm:flex-row sm:items-start"
        >
          <div
            className="text-base text-gray-600 font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0"
            style={{ fontFamily: 'Roboto, sans-serif' }}
            title={levelLabel}
          >
            {levelLabel}:
          </div>
          <div className="flex-1">
            <div
              className="text-base text-gray-900 font-medium"
              style={{ fontFamily: 'Roboto, sans-serif' }}
              title={displayValue}
            >
              {tSchema(t, displayValue)}
            </div>
          </div>
        </div>
      );
    }

    const levelOptions = options[level.level_id] || [];
    const isLoading = loadingLevelId === level.level_id;
    const levelEnabled = isLevelEnabled(levelIndex);
    const disabled = !isEnabled || loadingLevels || isLoading || !levelEnabled;

    return (
      <div key={level.level_id} className="mb-[10px]">
        <div className="flex flex-col sm:flex-row sm:items-start">
          <WidgetFieldLabel
            className="text-base font-medium text-gray-700 md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
            label={levelLabel}
            required={isRequired && levelIndex === 0}
          />
          <div className="flex-1 min-w-0">
            <select
              value={selectedValues[level.level_id] || ''}
              onChange={(event) => {
                const nextValue = event.target.value;
                void handleLevelChange(levelIndex, nextValue === '' ? undefined : nextValue);
              }}
              onBlur={onBlur}
              disabled={disabled}
              className={`w-full sm:w-[180px] max-w-full h-[30px] px-3 border shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                showValidationError
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300'
              } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
              style={{ borderRadius: '10px' }}
            >
              <option value="">{t?.('common.select')}</option>
              {levelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {tSchema(t, option.label)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  });
}

export const GeoHierarchyWidget = ({ config }: GeoHierarchyWidgetProps) => {
  const {
    isEnabled,
    isRequired,
    error,
    touched,
    onBlur,
    config: widgetConfig,
    levels,
    selectedValues,
    options,
    resolvedLabels,
    visibleColumns,
    loadingLevels,
    loadingLevelId,
    geoError,
    handleLevelChange,
    isLevelEnabled,
    formatLevelLabel,
  } = useGeoHierarchy({ config });

  const { t } = useWidgetContext();
  const showValidationError = Boolean(
    (touched && error.length > 0) ||
      (widgetConfig['widget-required'] &&
        !Object.values(selectedValues).some((value) => value)),
  );

  const isReadonly = Boolean(widgetConfig['widget-readonly']);
  const rowProps = {
    levels,
    isReadonly,
    selectedValues,
    options,
    resolvedLabels,
    loadingLevels,
    loadingLevelId,
    isEnabled,
    isRequired,
    showValidationError,
    t,
    onBlur,
    handleLevelChange,
    isLevelEnabled,
    formatLevelLabel,
  };

  const layoutColumnCount = Math.max(visibleColumns.length, 1);

  const content =
    visibleColumns.length <= 1 ? (
      renderLevelRows({
        ...rowProps,
        columnLevels: visibleColumns[0]?.levels ?? levels,
      })
    ) : (
      <div
        className="flex flex-col lg:grid w-full"
        style={{
          gridTemplateColumns: `repeat(${layoutColumnCount}, minmax(200px, 1fr))`,
        }}
      >
        {visibleColumns.map((column, position) => {
          const isLast = position === visibleColumns.length - 1;
          const columnClassName = [
            'flex flex-col min-w-0 relative',
            position > 0 ? 'lg:pl-10' : '',
            isLast ? '' : 'lg:pr-10',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={`geo-column-${column.index}`} className={columnClassName}>
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
              {renderLevelRows({ ...rowProps, columnLevels: column.levels })}
            </div>
          );
        })}
      </div>
    );

  return (
    <div className={isReadonly ? 'GeoHierarchyDisplayWidget' : 'GeoHierarchyWidget'}>
      {content}

      {loadingLevels && levels.length === 0 && (
        <p className="text-sm text-gray-500 mb-[10px]">{t?.('common.loading')}</p>
      )}

      {geoError && <p className="text-red-500 text-sm mb-[10px]">{geoError}</p>}

      {!isReadonly && touched && error.length > 0 && (
        <p className="text-red-500 text-sm mb-[10px]">{error[0]}</p>
      )}
    </div>
  );
};
