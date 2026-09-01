import { tSchema } from '../utils/tSchema';
import { useWidgetContext } from '../components/WidgetProvider';
import { BaseWidgetConfig } from '../types';
import { useGeoHierarchy } from '../hooks/useGeoHierarchy';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import {
  GeoFormStep,
  GeoLevel,
  encodeGeoSelectValue,
  parseGeoSelectValue,
} from '../utils/geoHierarchy';

interface GeoHierarchyWidgetProps {
  config: BaseWidgetConfig;
}

const selectClassName = (showError: boolean, disabled: boolean) =>
  `w-full sm:w-[180px] max-w-full h-[30px] px-3 border shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
    showError
      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
      : 'border-gray-300'
  } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`;

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
  const option = options[levelId]?.find((item) => item.value === selected)?.label;
  if (option) {
    return option;
  }
  if (resolvedLabels[selected]) {
    return resolvedLabels[selected];
  }
  return loading ? '-' : selected;
}

function ReadonlyLevelRow({
  level,
  displayValue,
}: {
  level: GeoLevel;
  displayValue: string;
}) {
  return (
    <div className="mb-[10px] SelectDisplayWidget flex flex-col sm:flex-row sm:items-start">
      <div
        className="text-base text-gray-600 font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0"
        style={{ fontFamily: 'Roboto, sans-serif' }}
        title={level.level_mnemonic}
      >
        {level.level_mnemonic}:
      </div>
      <div className="flex-1">
        <div
          className="text-base text-gray-900 font-medium"
          style={{ fontFamily: 'Roboto, sans-serif' }}
          title={displayValue}
        >
          {displayValue}
        </div>
      </div>
    </div>
  );
}

function renderFormSteps({
  columnSteps,
  selectedValues,
  options,
  loadingLevels,
  loadingLevelId,
  isEnabled,
  isRequired,
  isComplete,
  touched,
  hasError,
  t,
  onBlur,
  handleValueChange,
  formatLevelLabel,
}: {
  columnSteps: GeoFormStep[];
  selectedValues: Record<string, string>;
  options: Record<string, Array<{ value: string; label: string }>>;
  loadingLevels: boolean;
  loadingLevelId: string | null;
  isEnabled: boolean;
  isRequired: boolean;
  isComplete: boolean;
  touched: boolean;
  hasError: boolean;
  t?: (key: string, options?: Record<string, unknown>) => string;
  onBlur: () => void;
  handleValueChange: (levelId: string, nextValue: string | undefined) => void;
  formatLevelLabel: (mnemonic: string) => string;
}) {
  return columnSteps.map((step) => {
    if (step.kind === 'single') {
      const level = step.level;
      const levelOptions = options[level.level_id] || [];
      const isLoading = loadingLevelId === level.level_id;
      const parentId = level.parent_level_id;
      const parentUnselected = Boolean(parentId) && !selectedValues[parentId ?? ''];
      const disabled = !isEnabled || loadingLevels || isLoading || parentUnselected;
      const levelHasValue = Boolean(selectedValues[level.level_id]);
      const showLevelError =
        !parentUnselected &&
        ((isRequired && !isComplete && !levelHasValue) ||
          (touched && hasError && !levelHasValue));
      const label = formatLevelLabel(level.level_mnemonic);

      return (
        <div key={step.key} className="mb-[10px]">
          <div className="flex flex-col sm:flex-row sm:items-start">
            <WidgetFieldLabel
              className="text-base font-medium text-gray-700 md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
              label={label}
              required={isRequired}
            />
            <div className="flex-1 min-w-0">
              <select
                value={selectedValues[level.level_id] || ''}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  void handleValueChange(level.level_id, nextValue === '' ? undefined : nextValue);
                }}
                onBlur={onBlur}
                disabled={disabled}
                className={selectClassName(showLevelError, disabled)}
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
    }

    const chosen = step.levels.find((level) => selectedValues[level.level_id]);
    const activeLevel = chosen ?? step.levels[0];
    const encodedValue = chosen
      ? encodeGeoSelectValue(chosen.level_id, selectedValues[chosen.level_id])
      : '';
    const forkLoading = step.levels.some((level) => loadingLevelId === level.level_id);
    const parentUnselected = !selectedValues[step.parentLevel.level_id];
    const disabled = !isEnabled || loadingLevels || forkLoading || parentUnselected;
    const showLevelError =
      !parentUnselected &&
      ((isRequired && !isComplete && !encodedValue) ||
        (touched && hasError && !encodedValue));

    return (
      <div key={step.key} className="mb-[10px]">
        <div className="flex flex-col sm:flex-row sm:items-start">
            <WidgetFieldLabel
              className="text-base font-medium text-gray-700 md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
              label={formatLevelLabel(activeLevel.level_mnemonic)}
              required={isRequired}
            />
          <div className="flex-1 min-w-0">
            <select
              value={encodedValue}
              onChange={(event) => {
                const raw = event.target.value;
                if (!raw) {
                  const selectedLevel = chosen ?? step.levels[0];
                  void handleValueChange(selectedLevel.level_id, undefined);
                  return;
                }
                const parsed = parseGeoSelectValue(raw);
                if (!parsed) {
                  return;
                }
                void handleValueChange(parsed.levelId, parsed.valueId);
              }}
              onBlur={onBlur}
              disabled={disabled}
              className={selectClassName(showLevelError, disabled)}
              style={{ borderRadius: '10px' }}
            >
              <option value="">{t?.('common.select')}</option>
              {step.levels.map((level) => {
                const levelOptions = options[level.level_id] || [];
                if (levelOptions.length === 0 && !selectedValues[level.level_id]) {
                  return null;
                }
                return (
                  <optgroup key={level.level_id} label={formatLevelLabel(level.level_mnemonic)}>
                    {levelOptions.map((option) => (
                      <option
                        key={option.value}
                        value={encodeGeoSelectValue(level.level_id, option.value)}
                      >
                        {tSchema(t, option.label)}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
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
    handleValueChange,
    isComplete,
    selectedPath,
    formatLevelLabel,
  } = useGeoHierarchy({ config });

  const { t } = useWidgetContext();
  const hasError = error.length > 0 || (isRequired && levels.length > 0 && !isComplete);
  const isReadonly = Boolean(widgetConfig['widget-readonly']);

  const layoutColumnCount = Math.max(visibleColumns.length, 1);

  const editContent =
    visibleColumns.length <= 1 ? (
      renderFormSteps({
        columnSteps: visibleColumns[0]?.steps ?? [],
        selectedValues,
        options,
        loadingLevels,
        loadingLevelId,
        isEnabled,
        isRequired,
        isComplete,
        touched,
        hasError,
        t,
        onBlur,
        handleValueChange,
        formatLevelLabel,
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
                    backgroundColor: 'var(--owt-color-primary, #F5BB1A)',
                  }}
                />
              )}
              {renderFormSteps({
                columnSteps: column.steps,
                selectedValues,
                options,
                loadingLevels,
                loadingLevelId,
                isEnabled,
                isRequired,
                isComplete,
                touched,
                hasError,
                t,
                onBlur,
                handleValueChange,
                formatLevelLabel,
              })}
            </div>
          );
        })}
      </div>
    );

  const readonlyContent = selectedPath.map((level) => (
    <ReadonlyLevelRow
      key={level.level_id}
      level={{ ...level, level_mnemonic: formatLevelLabel(level.level_mnemonic) }}
      displayValue={tSchema(
        t,
        resolveDisplayValue(
          level.level_id,
          selectedValues,
          options,
          resolvedLabels,
          loadingLevels,
        ),
      )}
    />
  ));

  return (
    <div className={isReadonly ? 'GeoHierarchyDisplayWidget' : 'GeoHierarchyWidget'}>
      {isReadonly ? readonlyContent : editContent}

      {loadingLevels && levels.length === 0 && (
        <p className="text-sm text-gray-500 mb-[10px]">{t?.('common.loading')}</p>
      )}

      {geoError && <p className="text-red-500 text-sm mb-[10px]">{geoError}</p>}

      {!isReadonly && touched && hasError && (
        <p className="text-red-500 text-sm mb-[10px]">
          {error[0] || 'This field is required'}
        </p>
      )}
    </div>
  );
};
