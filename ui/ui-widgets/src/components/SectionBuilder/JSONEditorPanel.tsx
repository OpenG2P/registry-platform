import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Provider } from 'react-redux';
import { JsonEditor } from 'json-edit-react';
import { SectionConfig } from '../../types';
import { SectionRenderer } from '../SectionRenderer';
import { WidgetProvider, useWidgetContext } from '../WidgetProvider';
import { createWidgetStore, type WidgetStore } from '../../store';
import { resetIcon, previewIcon } from '../../assets';

// Inject styles to constrain json-edit-react container
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
        background-color: white !important;
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
  onReset?: () => void; // Optional reset handler from parent
  context?: 'section' | 'panel' | 'widget';
}

/**
 * JSON Editor Panel - Left side of Section Builder
 */
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
  const [editorKey, setEditorKey] = useState<number>(0); // Key to force JsonEditor re-render on reset

  // Store the original section when component mounts or section prop changes
  const originalSectionRef = useRef<SectionConfig>(section);

  // Get WidgetProvider context for preview modal (optional - may not be available)
  let widgetContext;
  try {
    widgetContext = useWidgetContext();
  } catch {
    widgetContext = {
      dataSourceRequestHandler: undefined,
      schemaData: undefined,
      translate: undefined,
    };
  }

  // Create a store for the preview modal if we're not in a Provider
  // This ensures SectionRenderer has access to Redux
  const previewStore = useMemo(() => createWidgetStore(), []);

  // Track if this is the initial mount
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Only update original section on initial mount (when page loads)
    // This ensures reset works until save is clicked
    // Don't update original when user makes edits (those come through onChange)
    if (isInitialMount.current) {
      originalSectionRef.current = JSON.parse(JSON.stringify(section)); // Deep copy
      isInitialMount.current = false;
    }
    // Always sync the display with the section prop (for external updates like reset from parent)
    setJsonData(section);
    setRawJsonText(JSON.stringify(section, null, 2));
    // Force JsonEditor to update when section prop changes (e.g., from parent reset)
    setEditorKey(prev => prev + 1);
  }, [section]);

  // Reset to original section
  const handleReset = useCallback(() => {
    // If parent provides onReset, use it (this will reset both JSON editor and visual builder)
    if (onReset) {
      onReset();
      // Also force JsonEditor to remount to ensure it picks up the reset
      setEditorKey(prev => prev + 1);
      return;
    }

    // Fallback: reset only this panel (for standalone usage)
    const original = JSON.parse(JSON.stringify(originalSectionRef.current)); // Deep copy to ensure new reference

    // Update state immediately
    setJsonData(original);
    setRawJsonText(JSON.stringify(original, null, 2));

    // Force JsonEditor to completely remount by changing key
    // This is critical because json-edit-react maintains internal state that doesn't sync with props
    setEditorKey(prev => prev + 1);

    // Notify parent
    onChange(original);
  }, [onChange, onReset]);

  // Handle Escape key to close preview
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

  // Make section editable for preview - remove readonly flags from widgets
  const makeSectionEditable = useCallback((section: SectionConfig): SectionConfig => {
    const processWidget = (widget: any): any => {
      if (!widget || typeof widget !== 'object') return widget;

      const editableWidget = {
        ...widget,
        'widget-readonly': false, // Make all widgets editable in preview
      };

      // Process nested widgets
      if (widget.widgets && Array.isArray(widget.widgets)) {
        editableWidget.widgets = widget.widgets.map(processWidget);
      }

      if (widget['widget-item']) {
        editableWidget['widget-item'] = processWidget(widget['widget-item']);
      }

      // Process table columns
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

  // Auto-populate widget-type based on widget selection
  const autoPopulateWidgetType = useCallback((data: any): any => {
    if (!data || typeof data !== 'object') return data;

    const processWidget = (widget: any): any => {
      if (!widget || typeof widget !== 'object') return widget;

      const widgetType = widget.widget;
      if (widgetType && !widget['widget-type']) {
        // Auto-determine widget-type based on widget name
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
          'currency': 'input',
          'display': 'input',
          'table': 'table',
          'simple-table': 'table',
          'array-widget': 'group',
          'iterable-accordion': 'group',
          'profile': 'layout',
        };

        widget = {
          ...widget,
          'widget-type': widgetTypeMap[widgetType] || 'input',
        };
      }

      // Process nested widgets
      if (widget.widgets && Array.isArray(widget.widgets)) {
        widget = {
          ...widget,
          widgets: widget.widgets.map(processWidget),
        };
      }

      // Process widget-item
      if (widget['widget-item']) {
        widget = {
          ...widget,
          'widget-item': processWidget(widget['widget-item']),
        };
      }

      // Process table columns
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

      // Process widgets in panel
      if (processed.widgets && Array.isArray(processed.widgets)) {
        processed.widgets = processed.widgets.map(processWidget);
      }

      // Process nested panels
      if (processed.panels && Array.isArray(processed.panels)) {
        processed.panels = processed.panels.map(processPanel);
      }

      return processed;
    };

    // Process section
    if (data.panels && Array.isArray(data.panels)) {
      return {
        ...data,
        panels: data.panels.map(processPanel),
      };
    }

    return data;
  }, []);

  const handleJsonChange = useCallback((data: any) => {
    // json-edit-react may wrap the data in a "root" key - unwrap it if present
    let unwrappedData = data?.root ? data.root : data;

    // Auto-populate widget-type for widgets that don't have it
    unwrappedData = autoPopulateWidgetType(unwrappedData);

    setJsonData(unwrappedData);
    setRawJsonText(JSON.stringify(unwrappedData, null, 2));

    // Basic validation
    const errors: string[] = [];
    if (!unwrappedData['section-id']) {
      errors.push('section-id is required');
    }
    if (!unwrappedData.panels || !Array.isArray(unwrappedData.panels)) {
      errors.push('panels must be an array');
    }

    setValidationErrors(errors);

    // Only update if valid
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

      // Auto-populate widget-type
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
      // Switching to raw view - update text from current data
      setRawJsonText(JSON.stringify(jsonData, null, 2));
    }
    setRawJsonView(!rawJsonView);
  }, [rawJsonView, jsonData]);

  // Create enum configuration for json-edit-react
  // This maps field paths to their allowed enum values
  const enumConfig = useCallback(() => {
    return {
      // Section level
      'section-id': undefined, // string, no enum
      'section-title': undefined, // string, no enum
      'section-editable': undefined, // boolean, no enum
      'section-column-span': undefined, // number, no enum

      // Panel level - can be nested in panels array
      'panel-id': undefined, // string, no enum
      'panel-orientation': ORIENTATIONS, // enum: ['horizontal', 'vertical']
      'panel-column-span': undefined, // number, no enum

      // Widget level - can be nested in widgets array or widget-item
      'widget': WIDGET_TYPES, // enum: all widget types
      'widget-type': ['input', 'layout', 'table', 'group'], // enum
      'widget-id': undefined, // string, no enum
      'widget-label': undefined, // string, no enum
      'widget-orientation': ORIENTATIONS, // enum: ['horizontal', 'vertical']
      'widget-required': undefined, // boolean, no enum
      'widget-readonly': undefined, // boolean, no enum

      // Widget data source type
      'widget-data-source.type': DATA_SOURCE_TYPES, // enum: ['static', 'api', 'schema']
      'widget-data-source.method': ['GET', 'POST', 'PUT', 'DELETE'], // HTTP methods

      // Widget validation
      'widget-data-validation.validationType': VALIDATION_TYPES, // enum: ['email', 'phone', 'url']

      // Widget format options
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

      // Widget options
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
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontWeight: 600, fontSize: '16px', color: '#2c3e50' }}>
            JSON Editor
          </div>
          {validationErrors.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#28a745' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#28a745',
                }}
              />
              <span style={{ fontSize: '12px' }}>Valid JSON Schema</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e74c3c' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#e74c3c',
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
              border: '1px solid #ddd',
              borderRadius: '10px',
              background: '#f3f3f3',
              color: '#666',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8f9fa';
              e.currentTarget.style.borderColor = '#999';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.borderColor = '#ddd';
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
            className="flex items-center gap-2 px-6 py-1.5 bg-[#4A90E2] hover:bg-[#357ABD] text-[#000000] font-bold rounded-full transition-all shadow-sm"
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
              color: !rawJsonView ? '#007bff' : '#6c757d',
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
              background: rawJsonView ? '#007bff' : '#ccc',
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
                background: 'white',
                borderRadius: '50%',
                transition: 'left 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '12px',
              color: rawJsonView ? '#007bff' : '#6c757d',
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
          background: 'white',
          border: '1px solid #E1E1E1',
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
              background: 'white',
              color: '#333',
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
              key={`editor-${editorKey}`} // Force re-render on reset - use string key for better remounting
              data={jsonData}
              setData={handleJsonChange}
              {...({ enumOptions: enumConfig() } as any)}
            />
          </div>
        )}
      </div>
      {showPreview && createPortal(
        <div
          className="section-builder-preview-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
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
              background: 'white',
              borderRadius: '8px',
              width: '100%',
              minWidth: '700px', // Ensure enough width for 600px content + padding
              maxWidth: '90vw',
              height: '90vh',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="section-builder-preview-header"
              style={{
                padding: '15px 20px',
                borderBottom: '1px solid #ddd',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8f9fa',
              }}
            >
              <h2 className="section-builder-preview-title" style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#2c3e50' }}>
                Section Preview
              </h2>
              <button
                className="section-builder-preview-close"
                onClick={() => setShowPreview(false)}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  background: '#e74c3c',
                  color: 'white',
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
                  translate={widgetContext.translate}
                >
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <SectionRenderer
                      section={makeSectionEditable(jsonData)}
                      hideEditButton={true} // Hide edit button in preview - widgets are already editable
                      onValueChange={(widgetId, value) => {
                        // Handle value changes in preview (optional - for tracking)
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
