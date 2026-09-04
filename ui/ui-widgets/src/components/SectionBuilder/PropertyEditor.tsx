import React, { useState, useEffect } from 'react';
import { SectionConfig, PanelConfig, BaseWidgetConfig, ApiDataSource } from '../../types';
import { TreeNode, TreeNodeType } from './SectionTree';
import { WIDGET_TYPES, ORIENTATIONS } from './schemas';
import { SearchableSelect } from './SearchableSelect';
import { getWidgetCategory } from '../../registry/widgetTypes';
import { useWidgetContext } from '../WidgetProvider';

interface PropertyEditorProps {
  node: TreeNode | null;
  onChange: (node: TreeNode, updates: Partial<SectionConfig | PanelConfig | BaseWidgetConfig>) => void;
  onDelete: (node: TreeNode) => void;
  onDuplicate: (node: TreeNode) => void;
}

export const PropertyEditor: React.FC<PropertyEditorProps> = ({
  node,
  onChange,
  onDelete,
  onDuplicate,
}) => {
  const { t } = useWidgetContext();
  const [localData, setLocalData] = useState<any>(null);

  useEffect(() => {
    if (node) {
      setLocalData({ ...node.data });
    }
  }, [node]);

  if (!node || !localData) {
    return (
      <div
        style={{
          flex: '1 1 0%',
          minHeight: 0,
          padding: '15px',
          background: 'var(--owt-color-bg-alt)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--owt-color-text-muted)',
        }}
      >
        {t?.('sectionBuilder.selectItemToEdit') || 'Select an item to edit properties'}
      </div>
    );
  }

  const handleChange = (field: string, value: any) => {
    const updated = { ...localData, [field]: value };
    setLocalData(updated);
    onChange(node, updated);
  };

  const handleNestedChange = (field: string, nestedField: string, value: any) => {
    const updated = {
      ...localData,
      [field]: {
        ...(localData[field] || {}),
        [nestedField]: value,
      },
    };
    setLocalData(updated);
    onChange(node, updated);
  };

  const ensureNestedObject = (field: string) => {
    if (!localData[field]) {
      const updated = {
        ...localData,
        [field]: {},
      };
      setLocalData(updated);
      onChange(node, updated);
    }
  };

  const renderSectionProperties = () => {
    const section = localData as SectionConfig;
    return (
      <>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            {t?.('sectionBuilder.sectionId') || 'Section ID'} <span style={{ color: 'var(--owt-color-error)' }}>*</span>
          </label>
          <input
            type="text"
            value={section['section-id'] || ''}
            onChange={(e) => handleChange('section-id', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--owt-color-border)',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'var(--owt-widget-input-bg)',
              color: 'var(--owt-color-text)',
            }}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            {t?.('sectionBuilder.sectionTitle') || 'Section Title'}
          </label>
          <input
            type="text"
            value={section['section-title'] || ''}
            onChange={(e) => handleChange('section-title', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--owt-color-border)',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'var(--owt-widget-input-bg)',
              color: 'var(--owt-color-text)',
            }}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={section['section-editable'] || false}
              onChange={(e) => handleChange('section-editable', e.target.checked)}
            />
            <span>{t?.('sectionBuilder.editable') || 'Editable'}</span>
          </label>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            {t?.('sectionBuilder.columnSpan') || 'Column Span'}
          </label>
          <input
            type="number"
            value={section['section-column-span'] || 1}
            onChange={(e) => handleChange('section-column-span', parseInt(e.target.value) || 1)}
            min="1"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--owt-color-border)',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'var(--owt-widget-input-bg)',
              color: 'var(--owt-color-text)',
            }}
          />
        </div>
      </>
    );
  };

  const renderPanelProperties = () => {
    const panel = localData as PanelConfig;
    return (
      <>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            {t?.('sectionBuilder.panelId') || 'Panel ID'} <span style={{ color: 'var(--owt-color-error)' }}>*</span>
          </label>
          <input
            type="text"
            value={panel['panel-id'] || ''}
            onChange={(e) => handleChange('panel-id', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--owt-color-border)',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'var(--owt-widget-input-bg)',
              color: 'var(--owt-color-text)',
            }}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            {t?.('sectionBuilder.orientation') || 'Orientation'}
          </label>
          <select
            value={panel['panel-orientation'] || 'vertical'}
            onChange={(e) => handleChange('panel-orientation', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--owt-color-border)',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'var(--owt-widget-input-bg)',
            }}
          >
            {ORIENTATIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            {t?.('sectionBuilder.columnSpan') || 'Column Span'}
          </label>
          <input
            type="number"
            value={panel['panel-column-span'] || 1}
            onChange={(e) => handleChange('panel-column-span', parseInt(e.target.value) || 1)}
            min="1"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--owt-color-border)',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'var(--owt-widget-input-bg)',
              color: 'var(--owt-color-text)',
            }}
          />
        </div>
      </>
    );
  };

  const renderWidgetProperties = () => {
    const widget = localData as BaseWidgetConfig;

    const handleWidgetTypeChange = (newWidgetType: string) => {
      const updated: any = {
        ...widget,
        widget: newWidgetType,
        'widget-type': getWidgetCategory(newWidgetType),
      };

      if (!['select', 'radio', 'checkbox', 'multi-select'].includes(newWidgetType)) {
        delete updated['widget-data-source'];
      }
      if (!['table', 'dialog-table'].includes(newWidgetType)) {
        delete updated['widget-data-columns'];
      }

      setLocalData(updated);
      onChange(node, updated);
    };

    return (
      <>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            {t?.('sectionBuilder.widgetType') || 'Widget Type'} <span style={{ color: 'var(--owt-color-error)' }}>*</span>
          </label>
          <SearchableSelect
            options={WIDGET_TYPES}
            value={widget.widget || ''}
            onChange={handleWidgetTypeChange}
            placeholder={t?.('sectionBuilder.searchWidgetType') || 'Search widget type...'}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            {t?.('sectionBuilder.widgetId') || 'Widget ID'} <span style={{ color: 'var(--owt-color-error)' }}>*</span>
          </label>
          <input
            type="text"
            value={widget['widget-id'] || ''}
            onChange={(e) => handleChange('widget-id', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--owt-color-border)',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'var(--owt-widget-input-bg)',
              color: 'var(--owt-color-text)',
            }}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            {t?.('sectionBuilder.widgetLabel') || 'Widget Label'}
          </label>
          <input
            type="text"
            value={widget['widget-label'] || ''}
            onChange={(e) => handleChange('widget-label', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--owt-color-border)',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'var(--owt-widget-input-bg)',
              color: 'var(--owt-color-text)',
            }}
            placeholder={t?.('sectionBuilder.enterLabel') || 'Enter label...'}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            {t?.('sectionBuilder.dataPath') || 'Data Path'}
          </label>
          <input
            type="text"
            value={typeof widget['widget-data-path'] === 'string' ? widget['widget-data-path'] : ''}
            onChange={(e) => handleChange('widget-data-path', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--owt-color-border)',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'var(--owt-widget-input-bg)',
              color: 'var(--owt-color-text)',
            }}
            placeholder={t?.('sectionBuilder.dataPathPlaceholder') || 'person.name'}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            {t?.('sectionBuilder.placeholder') || 'Placeholder'}
          </label>
          <input
            type="text"
            value={widget['widget-data-placeholder'] || ''}
            onChange={(e) => handleChange('widget-data-placeholder', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--owt-color-border)',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'var(--owt-widget-input-bg)',
              color: 'var(--owt-color-text)',
            }}
            placeholder={t?.('sectionBuilder.enterPlaceholder') || 'Enter placeholder...'}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={widget['widget-required'] || false}
              onChange={(e) => handleChange('widget-required', e.target.checked)}
            />
            <span>{t?.('sectionBuilder.required') || 'Required'}</span>
          </label>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={widget['widget-readonly'] || false}
              onChange={(e) => handleChange('widget-readonly', e.target.checked)}
            />
            <span>{t?.('sectionBuilder.readonly') || 'Readonly'}</span>
          </label>
        </div>

        {['select', 'radio', 'checkbox', 'multi-select'].includes(widget.widget) && (
          <div style={{ marginBottom: '20px', padding: '10px', background: 'var(--owt-color-primary-light)', borderRadius: '4px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>
              {t?.('sectionBuilder.dataSourceRequired', { widgetType: widget.widget }) ||
                `Data Source (Required for ${widget.widget})`}
            </label>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                {t?.('sectionBuilder.sourceType') || 'Source Type'}
              </label>
              <select
                value={widget['widget-data-source']?.type || 'static'}
                onChange={(e) => {
                  ensureNestedObject('widget-data-source');
                  handleNestedChange('widget-data-source', 'type', e.target.value);
                }}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid var(--owt-color-border)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  background: 'var(--owt-widget-input-bg)',
                }}
              >
                <option value="static">{t?.('sectionBuilder.static') || 'Static'}</option>
                <option value="api">{t?.('sectionBuilder.api') || 'API'}</option>
                <option value="schema">{t?.('sectionBuilder.schema') || 'Schema'}</option>
              </select>
            </div>
            {widget['widget-data-source']?.type === 'static' && (
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                  {t?.('sectionBuilder.optionsJson') ||
                    'Options (JSON array format: see placeholder below)'}
                </label>
                <textarea
                  value={JSON.stringify(widget['widget-data-source']?.options || [], null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      handleNestedChange('widget-data-source', 'options', parsed);
                    } catch {

                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid var(--owt-color-border)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    minHeight: '80px',
                    background: 'var(--owt-widget-input-bg)',
                    color: 'var(--owt-color-text)',
                  }}
                  placeholder={
                    t?.('sectionBuilder.optionsPlaceholder') ||
                    '[{"value": "opt1", "label": "Option 1"}]'
                  }
                />
              </div>
            )}
            {widget['widget-data-source']?.type === 'api' && (() => {
              const apiSource = widget['widget-data-source'] as ApiDataSource;
              return (
                <>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                      {t?.('sectionBuilder.apiUrl') || 'API URL'}
                    </label>
                    <input
                      type="text"
                      value={apiSource.url || ''}
                      onChange={(e) =>
                        handleNestedChange('widget-data-source', 'url', e.target.value)
                      }
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        border: '1px solid var(--owt-color-border)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        background: 'var(--owt-widget-input-bg)',
                        color: 'var(--owt-color-text)',
                      }}
                      placeholder={
                        t?.('sectionBuilder.apiUrlPlaceholder') ||
                        'https://api.example.com/options'
                      }
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                      {t?.('sectionBuilder.valueLabelKeys') ||
                        'Value/Label Keys (e.g., "id"/"name")'}
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={apiSource.valueKey || ''}
                        onChange={(e) =>
                          handleNestedChange('widget-data-source', 'valueKey', e.target.value)
                        }
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          border: '1px solid var(--owt-color-border)',
                          borderRadius: '4px',
                          fontSize: '11px',
                          background: 'var(--owt-widget-input-bg)',
                          color: 'var(--owt-color-text)',
                        }}
                        placeholder={t?.('sectionBuilder.valueKeyPlaceholder') || 'value key'}
                      />
                      <input
                        type="text"
                        value={apiSource.labelKey || ''}
                        onChange={(e) =>
                          handleNestedChange('widget-data-source', 'labelKey', e.target.value)
                        }
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          border: '1px solid var(--owt-color-border)',
                          borderRadius: '4px',
                          fontSize: '11px',
                          background: 'var(--owt-widget-input-bg)',
                          color: 'var(--owt-color-text)',
                        }}
                        placeholder={t?.('sectionBuilder.labelKeyPlaceholder') || 'label key'}
                      />
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {['table', 'dialog-table'].includes(widget.widget) && (
          <div style={{ marginBottom: '20px', padding: '10px', background: 'var(--owt-color-primary-light)', borderRadius: '4px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>
              {t?.('sectionBuilder.tableColumns') || 'Table Columns'}
            </label>
            <div style={{ fontSize: '11px', color: 'var(--owt-color-text-muted)', marginBottom: '10px' }}>
              {t?.('sectionBuilder.tableColumnsHint') ||
                'Define columns as JSON array (see placeholder below)'}
            </div>
            <textarea
              value={JSON.stringify(widget['widget-data-columns'] || [], null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleChange('widget-data-columns', parsed);
                } catch {

                }
              }}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid var(--owt-color-border)',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'monospace',
                minHeight: '100px',
                background: 'var(--owt-widget-input-bg)',
                color: 'var(--owt-color-text)',
              }}
              placeholder={
                t?.('sectionBuilder.columnsPlaceholder') ||
                '[{"column-key": "col1", "widget-label": "Column 1", "widget": "text"}]'
              }
            />
          </div>
        )}

        {widget.widget === 'number' && (
          <div style={{ marginBottom: '20px', padding: '10px', background: 'var(--owt-color-primary-light)', borderRadius: '4px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>
              {t?.('sectionBuilder.numberValidation') || 'Number Validation'}
            </label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                  {t?.('sectionBuilder.minValue') || 'Min Value'}
                </label>
                <input
                  type="number"
                  value={widget['widget-data-validation']?.min ?? ''}
                  onChange={(e) =>
                    handleNestedChange('widget-data-validation', 'min', e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid var(--owt-color-border)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    background: 'var(--owt-widget-input-bg)',
                    color: 'var(--owt-color-text)',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                  {t?.('sectionBuilder.maxValue') || 'Max Value'}
                </label>
                <input
                  type="number"
                  value={widget['widget-data-validation']?.max ?? ''}
                  onChange={(e) =>
                    handleNestedChange('widget-data-validation', 'max', e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid var(--owt-color-border)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    background: 'var(--owt-widget-input-bg)',
                    color: 'var(--owt-color-text)',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {['date', 'datetime'].includes(widget.widget) && (
          <div style={{ marginBottom: '20px', padding: '10px', background: 'var(--owt-color-success-light)', borderRadius: '4px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>
              {t?.('sectionBuilder.dateRangeOptions') || 'Date Range Options'}
            </label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                  {t?.('sectionBuilder.minDate') || 'Min Date'}
                </label>
                <input
                  type="date"
                  value={widget['widget-data-options']?.minDate || ''}
                  onChange={(e) =>
                    handleNestedChange('widget-data-options', 'minDate', e.target.value || undefined)
                  }
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid var(--owt-color-border)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    background: 'var(--owt-widget-input-bg)',
                    color: 'var(--owt-color-text)',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                  {t?.('sectionBuilder.maxDate') || 'Max Date'}
                </label>
                <input
                  type="date"
                  value={widget['widget-data-options']?.maxDate || ''}
                  onChange={(e) =>
                    handleNestedChange('widget-data-options', 'maxDate', e.target.value || undefined)
                  }
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid var(--owt-color-border)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    background: 'var(--owt-widget-input-bg)',
                    color: 'var(--owt-color-text)',
                  }}
                />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
              <input
                type="checkbox"
                checked={widget['widget-data-options']?.showCalendar || false}
                onChange={(e) =>
                  handleNestedChange('widget-data-options', 'showCalendar', e.target.checked)
                }
              />
              <span>{t?.('sectionBuilder.showCalendar') || 'Show Calendar'}</span>
            </label>
          </div>
        )}

        <div style={{ marginBottom: '20px', padding: '10px', background: 'var(--owt-color-bg-alt)', borderRadius: '4px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>
            {t?.('sectionBuilder.validation') || 'Validation'}
          </label>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={widget['widget-data-validation']?.required || false}
                onChange={(e) => {
                  if (!widget['widget-data-validation']) {
                    handleChange('widget-data-validation', { required: e.target.checked });
                  } else {
                    handleNestedChange('widget-data-validation', 'required', e.target.checked);
                  }
                }}
              />
              <span>{t?.('sectionBuilder.required') || 'Required'}</span>
            </label>
          </div>
          {['text', 'textarea'].includes(widget.widget) && (
            <>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                  {t?.('sectionBuilder.minLength') || 'Min Length'}
                </label>
                <input
                  type="number"
                  value={widget['widget-data-validation']?.minLength || ''}
                  onChange={(e) => {
                    const validation = widget['widget-data-validation'] || {};
                    handleChange('widget-data-validation', {
                      ...validation,
                      minLength: e.target.value ? parseInt(e.target.value) : undefined,
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid var(--owt-color-border)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    background: 'var(--owt-widget-input-bg)',
                    color: 'var(--owt-color-text)',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                  {t?.('sectionBuilder.maxLength') || 'Max Length'}
                </label>
                <input
                  type="number"
                  value={widget['widget-data-validation']?.maxLength || ''}
                  onChange={(e) => {
                    const validation = widget['widget-data-validation'] || {};
                    handleChange('widget-data-validation', {
                      ...validation,
                      maxLength: e.target.value ? parseInt(e.target.value) : undefined,
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid var(--owt-color-border)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    background: 'var(--owt-widget-input-bg)',
                    color: 'var(--owt-color-text)',
                  }}
                />
              </div>
            </>
          )}
        </div>
      </>
    );
  };

  const getHeaderColor = () => {
    switch (node.type) {
      case 'section':
        return 'var(--owt-color-info)';
      case 'panel':
        return 'var(--owt-color-warning)';
      case 'widget':
        return 'var(--owt-color-success)';
    }
  };

  return (
    <div
      style={{
        flex: '1 1 0%',
        minHeight: 0,
        padding: '15px',
        overflowY: 'auto',
        background: 'var(--owt-color-bg-alt)',
      }}
    >
      <h3 style={{ fontSize: '14px', marginBottom: '15px', color: 'var(--owt-color-text)' }}>
        {t?.('sectionBuilder.properties') || 'Properties'}
      </h3>
      <div
        style={{
          background: getHeaderColor(),
          color: 'var(--owt-color-bg)',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '20px',
          fontWeight: 600,
          fontSize: '13px',
        }}
      >
        {node.type === 'section' &&
          (t?.('sectionBuilder.headerSection', { id: (node.data as SectionConfig)['section-id'] }) ||
            `Section: ${(node.data as SectionConfig)['section-id']}`)}
        {node.type === 'panel' &&
          (t?.('sectionBuilder.headerPanel', { id: (node.data as PanelConfig)['panel-id'] }) ||
            `Panel: ${(node.data as PanelConfig)['panel-id']}`)}
        {node.type === 'widget' &&
          (t?.('sectionBuilder.headerWidget', { id: (node.data as BaseWidgetConfig)['widget-id'] }) ||
            `Widget: ${(node.data as BaseWidgetConfig)['widget-id']}`)}
      </div>

      {node.type === 'section' && renderSectionProperties()}
      {node.type === 'panel' && renderPanelProperties()}
      {node.type === 'widget' && renderWidgetProperties()}

      <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
        <button
          onClick={() => onDelete(node)}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            borderRadius: '10px',
            background: 'var(--owt-color-error)',
            color: 'var(--owt-color-bg)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          {t?.('sectionBuilder.delete') || 'Delete'}
        </button>
        <button
          onClick={() => onDuplicate(node)}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            borderRadius: '10px',
            background: 'var(--owt-color-warning)',
            color: 'var(--owt-color-bg)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          {t?.('sectionBuilder.duplicate') || 'Duplicate'}
        </button>
      </div>
    </div>
  );
};
