import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Provider } from 'react-redux';
import { JsonEditor } from 'json-edit-react';
import { SectionConfig } from '../../types';
import { SectionRenderer } from '../SectionRenderer';
import { WidgetProvider, useWidgetContext } from '../WidgetProvider';
import { useOwtThemeRootProps } from '../../hooks/useWidgetTheme';
import { createWidgetStore, type WidgetStore } from '../../store';
import { resetIcon, previewIcon } from '../../assets';

if (typeof document !== 'undefined') {
  const styleId = 'json-editor-constraints';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .json-editor-scroll-container {
        display: flex !important;
        flex-direction: column !important;
        height: 100% !important;
        max-height: 100% !important;
        overflow: auto !important;
      }
      .json-editor-scroll-container .jer-editor-container {
        max-width: 100% !important;
        width: 100% !important;
        height: auto !important;
        max-height: none !important;
        flex-shrink: 0 !important;
        background-color: var(--owt-color-bg) !important;
      }
      .json-editor-scroll-container .jer-component {
        width: 100% !important;
      }
    `;
    document.head.appendChild(style);
  }
}
import {
  sectionSchema,
  WIDGET_TYPES,
  ORIENTATIONS,
  DATA_SOURCE_TYPES,
  VALIDATION_TYPES,
  CHARACTER_TYPES,
  CASE_CONTROLS,
  NUMERIC_TYPES,
  BOOLEAN_REPRESENTATIONS,
  BOOLEAN_CONTROL_TYPES,
  CONDITION_OPERATORS,
} from './schemas';

interface JSONEditorPanelProps {
  section: SectionConfig;
  onChange: (section: SectionConfig) => void;
  onReset?: () => void;
  context?: 'section' | 'panel' | 'widget';
}

export const JSONEditorPanel: React.FC<JSONEditorPanelProps> = ({
  section,
  onChange,
  onReset,
  context = 'section',
}) => {
  const [jsonData, setJsonData] = useState<SectionConfig>(section);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [rawJsonView, setRawJsonView] = useState<boolean>(false);
  const [rawJsonText, setRawJsonText] = useState<string>('');
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [editorKey, setEditorKey] = useState<number>(0);
  const themeRoot = useOwtThemeRootProps();

  const originalSectionRef = useRef<SectionConfig>(section);

  let widgetContext;
  try {
    widgetContext = useWidgetContext();
  } catch {
    widgetContext = {
      dataSourceRequestHandler: undefined,
      schemaData: undefined,
      t: undefined,
    };
  }

  const previewStore = useMemo(() => createWidgetStore(), []);

  const isInitialMount = useRef(true);

  useEffect(() => {

    if (isInitialMount.current) {
      originalSectionRef.current = JSON.parse(JSON.stringify(section));
      isInitialMount.current = false;
    }

    setJsonData(section);
    setRawJsonText(JSON.stringify(section, null, 2));

    setEditorKey(prev => prev + 1);
  }, [section]);

  const handleReset = useCallback(() => {

    if (onReset) {
      onReset();

      setEditorKey(prev => prev + 1);
      return;
    }

    const original = JSON.parse(JSON.stringify(originalSectionRef.current));

    setJsonData(original);
    setRawJsonText(JSON.stringify(original, null, 2));

    setEditorKey(prev => prev + 1);

    onChange(original);
  }, [onChange, onReset]);

  useEffect(() => {
    if (!showPreview) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPreview(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showPreview]);

  const makeSectionEditable = useCallback((section: SectionConfig): SectionConfig => {
    const processWidget = (widget: any): any => {
      if (!widget || typeof widget !== 'object') return widget;

      const editableWidget = {
        ...widget,
        'widget-readonly': false,
      };

      if (widget.widgets && Array.isArray(widget.widgets)) {
        editableWidget.widgets = widget.widgets.map(processWidget);
      }

      if (widget['widget-item']) {
        editableWidget['widget-item'] = processWidget(widget['widget-item']);
      }

      if (widget['widget-data-columns'] && Array.isArray(widget['widget-data-columns'])) {
        editableWidget['widget-data-columns'] = widget['widget-data-columns'].map((col: any) => {
          if (col && typeof col === 'object' && col.widget) {
            return processWidget(col);
          }
          return col;
        });
      }

      return editableWidget;
    };

    const processPanel = (panel: any): any => {
      if (!panel || typeof panel !== 'object') return panel;

      const editablePanel = { ...panel };

      if (panel.widgets && Array.isArray(panel.widgets)) {
        editablePanel.widgets = panel.widgets.map(processWidget);
      }

      if (panel.panels && Array.isArray(panel.panels)) {
        editablePanel.panels = panel.panels.map(processPanel);
      }

      return editablePanel;
    };

    return {
      ...section,
      'section-editable': true,
      panels: section.panels ? section.panels.map(processPanel) : [],
    };
  }, []);

  const autoPopulateWidgetType = useCallback((data: any): any => {
    if (!data || typeof data !== 'object') return data;

    const processWidget = (widget: any): any => {
      if (!widget || typeof widget !== 'object') return widget;

      const widgetType = widget.widget;
      if (widgetType && !widget['widget-type']) {

        const widgetTypeMap: Record<string, 'input' | 'layout' | 'table' | 'group'> = {
          'text': 'input',
          'textarea': 'input',
          'number': 'input',
          'boolean': 'input',
          'date': 'input',
          'datetime': 'input',
          'select': 'input',
          'radio': 'input',
          'checkbox': 'input',
          'file': 'input',
          'phone': 'input',
          'display': 'input',
          'table': 'table',
          'dialog-table': 'table',
          'profile': 'layout',
        };

        widget = {
          ...widget,
          'widget-type': widgetTypeMap[widgetType] || 'input',
        };
      }

      if (widget.widgets && Array.isArray(widget.widgets)) {
        widget = {
          ...widget,
          widgets: widget.widgets.map(processWidget),
        };
      }

      if (widget['widget-item']) {
        widget = {
          ...widget,
          'widget-item': processWidget(widget['widget-item']),
        };
      }

      if (widget['widget-data-columns'] && Array.isArray(widget['widget-data-columns'])) {
        widget = {
          ...widget,
          'widget-data-columns': widget['widget-data-columns'].map((col: any) => {
            if (col && typeof col === 'object' && col.widget && !col['widget-type']) {
              const widgetTypeMap: Record<string, 'input' | 'layout' | 'table' | 'group'> = {
                'text': 'input',
                'number': 'input',
                'date': 'input',
                'select': 'input',
                'boolean': 'input',
              };
              return {
                ...col,
                'widget-type': widgetTypeMap[col.widget] || 'input',
              };
            }
            return col;
          }),
        };
      }

      return widget;
    };

    const processPanel = (panel: any): any => {
      if (!panel || typeof panel !== 'object') return panel;

      let processed = { ...panel };

      if (processed.widgets && Array.isArray(processed.widgets)) {
        processed.widgets = processed.widgets.map(processWidget);
      }

      if (processed.panels && Array.isArray(processed.panels)) {
        processed.panels = processed.panels.map(processPanel);
      }

      return processed;
    };

    if (data.panels && Array.isArray(data.panels)) {
      return {
        ...data,
        panels: data.panels.map(processPanel),
      };
    }

    return data;
  }, []);

  const handleJsonChange = useCallback((data: any) => {

    let unwrappedData = data?.root ? data.root : data;

    unwrappedData = autoPopulateWidgetType(unwrappedData);

    setJsonData(unwrappedData);
    setRawJsonText(JSON.stringify(unwrappedData, null, 2));

    const errors: string[] = [];
    if (!unwrappedData['section-id']) {
      errors.push('section-id is required');
    }
    if (!unwrappedData.panels || !Array.isArray(unwrappedData.panels)) {
      errors.push('panels must be an array');
    }

    setValidationErrors(errors);

    if (errors.length === 0) {
      onChange(unwrappedData);
    }
  }, [onChange, autoPopulateWidgetType]);

  const handleRawJsonChange = useCallback((text: string) => {
    setRawJsonText(text);

    try {
      const parsed = JSON.parse(text);
      const errors: string[] = [];

      if (!parsed['section-id']) {
        errors.push('section-id is required');
      }
      if (!parsed.panels || !Array.isArray(parsed.panels)) {
        errors.push('panels must be an array');
      }

      setValidationErrors(errors);

      const processed = autoPopulateWidgetType(parsed);

      if (errors.length === 0) {
        setJsonData(processed);
        onChange(processed);
      }
    } catch (error) {
      setValidationErrors([`Invalid JSON: ${error instanceof Error ? error.message : 'Parse error'}`]);
    }
  }, [onChange, autoPopulateWidgetType]);

  const toggleRawJsonView = useCallback(() => {
    if (!rawJsonView) {

      setRawJsonText(JSON.stringify(jsonData, null, 2));
    }
    setRawJsonView(!rawJsonView);
  }, [rawJsonView, jsonData]);

  const enumConfig = useCallback(() => {
    return {

      'section-id': undefined,
      'section-title': undefined,
      'section-editable': undefined,
      'section-column-span': undefined,

      'panel-id': undefined,
      'panel-orientation': ORIENTATIONS,
      'panel-column-span': undefined,

      'widget': WIDGET_TYPES,
      'widget-type': ['input', 'layout', 'table', 'group'],
      'widget-id': undefined,
      'widget-label': undefined,
      'widget-orientation': ORIENTATIONS,
      'widget-required': undefined,
      'widget-readonly': undefined,

      'widget-data-source.type': DATA_SOURCE_TYPES,
      'widget-data-source.method': ['GET', 'POST', 'PUT', 'DELETE'],

      'widget-data-validation.validationType': VALIDATION_TYPES,

      'widget-data-format.inputType': ['text', 'email', 'password', 'number', 'tel', 'url', 'search', 'file'],
      'widget-data-format.characterType': CHARACTER_TYPES,
      'widget-data-format.caseControl': CASE_CONTROLS,
      'widget-data-format.numericType': NUMERIC_TYPES,
      'widget-data-format.roundingMode': ['round', 'truncate'],
      'widget-data-format.textAlign': ['left', 'right'],
      'widget-data-format.booleanRepresentation': BOOLEAN_REPRESENTATIONS,
      'widget-data-format.booleanControlType': BOOLEAN_CONTROL_TYPES,
      'widget-data-format.layout': ['vertical', 'horizontal', 'grid'],
      'widget-data-format.inputMethod': ['picker', 'manual', 'hybrid'],
      'widget-data-format.dateConstraint': ['any', 'past-only', 'future-only'],
      'widget-data-format.dateTimeConstraint': ['any', 'past-only', 'future-only'],

      'widget-data-options.action': ['show', 'hide', 'enable', 'disable', 'require'],
      'widget-data-options.condition.operator': CONDITION_OPERATORS,
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        minHeight: 0,
        borderRight: '0px',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          background: 'var(--owt-color-bg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--owt-color-text)' }}>
            JSON Editor
          </div>
          {validationErrors.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--owt-color-success)' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: 'var(--owt-color-success)',
                }}
              />
              <span style={{ fontSize: '12px' }}>Valid JSON Schema</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--owt-color-error)' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: 'var(--owt-color-error)',
                }}
              />
              <span style={{ fontSize: '12px' }}>Validation Errors</span>
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <button
            onClick={handleReset}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--owt-color-border-light)',
              borderRadius: '10px',
              background: 'var(--owt-color-bg-alt)',
              color: 'var(--owt-color-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--owt-color-bg-alt)';
              e.currentTarget.style.borderColor = 'var(--owt-color-border)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--owt-color-bg)';
              e.currentTarget.style.borderColor = 'var(--owt-color-border-light)';
            }}
            title="Reset to original JSON"
          >
            <img
              src={resetIcon}
              alt="Reset"
              className="w-3.5 h-3.5 grayscale opacity-70"
            />
            Reset
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-6 py-1.5 bg-[var(--owt-color-info)] hover:bg-[var(--owt-color-info)] text-[var(--owt-color-text)] font-bold rounded-full transition-all owt-shadow-sm"
            title="Preview Section"
          >
            <span className="text-[14px]">Preview</span>
            <img
              src={previewIcon}
              alt="Preview"
              className="w-3 h-3.5"
            />
          </button>
          <span
            style={{
              fontSize: '12px',
              color: !rawJsonView ? 'var(--owt-color-info)' : 'var(--owt-color-text-muted)',
              fontWeight: !rawJsonView ? 600 : 400,
              transition: 'color 0.2s',
            }}
          >
            Tree
          </span>
          <div
            onClick={toggleRawJsonView}
            style={{
              position: 'relative',
              width: '44px',
              height: '24px',
              background: rawJsonView ? 'var(--owt-color-info)' : 'var(--owt-color-border)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '2px',
                left: rawJsonView ? '22px' : '2px',
                width: '20px',
                height: '20px',
                background: 'var(--owt-color-bg)',
                borderRadius: '50%',
                transition: 'left 0.2s',
                boxShadow: '0 2px 4px var(--owt-color-shadow)',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '12px',
              color: rawJsonView ? 'var(--owt-color-info)' : 'var(--owt-color-text-muted)',
              fontWeight: rawJsonView ? 600 : 400,
              transition: 'color 0.2s',
            }}
          >
            Raw
          </span>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          maxHeight: '100%',
          overflow: 'hidden',
          background: 'var(--owt-color-bg)',
          border: '1px solid var(--owt-color-border-light)',
          borderRadius: '10px',
          padding: rawJsonView ? '0' : '20px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {rawJsonView ? (
          <textarea
            value={rawJsonText}
            onChange={(e) => handleRawJsonChange(e.target.value)}
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--owt-color-bg)',
              color: 'var(--owt-color-text)',
              border: 'none',
              padding: '20px',
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
              fontSize: '13px',
              lineHeight: '1.5',
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
              borderRadius: '10px',
            }}
            spellCheck={false}
          />
        ) : (
          <div
            className="json-editor-scroll-container"
            style={{
              width: '100%',
              height: '100%',
              minHeight: 0,
              maxHeight: '100%',
              overflow: 'auto',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              flex: '1 1 0',
            }}
          >
            <JsonEditor
              key={`editor-${editorKey}`}
              data={jsonData}
              setData={handleJsonChange}
              {...({ enumOptions: enumConfig() } as any)}
            />
          </div>
        )}
      </div>
      {showPreview && createPortal(
        <div
          className={`${themeRoot.className} section-builder-preview-backdrop`}
          style={{
            ...themeRoot.style,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--owt-color-overlay)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowPreview(false)}
        >
          <div
            className="section-builder-preview-modal"
            style={{
              background: 'var(--owt-color-bg)',
              borderRadius: '8px',
              width: '100%',
              minWidth: '700px',
              maxWidth: '90vw',
              height: '90vh',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 20px var(--owt-color-shadow)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="section-builder-preview-header"
              style={{
                padding: '15px 20px',
                borderBottom: '1px solid var(--owt-color-border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--owt-color-bg-alt)',
              }}
            >
              <h2 className="section-builder-preview-title" style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--owt-color-text)' }}>
                Section Preview
              </h2>
              <button
                className="section-builder-preview-close"
                onClick={() => setShowPreview(false)}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  background: 'var(--owt-color-error)',
                  color: 'var(--owt-color-bg)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
            <div
              className="section-builder-preview-content"
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '20px',
              }}
            >
              <Provider store={previewStore}>
                <WidgetProvider
                  store={previewStore}
                  dataSourceRequestHandler={widgetContext.dataSourceRequestHandler}
                  schemaData={widgetContext.schemaData}
                  t={widgetContext.t}
                >
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <SectionRenderer
                      section={makeSectionEditable(jsonData)}
                      hideEditButton={true}
                      onValueChange={(widgetId, value) => {

                        console.log('Preview value changed:', widgetId, value);
                      }}
                    />
                  </div>
                </WidgetProvider>
              </Provider>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
