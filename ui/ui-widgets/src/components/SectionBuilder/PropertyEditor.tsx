import React, { useState, useEffect } from 'react';
import { SectionConfig, PanelConfig, BaseWidgetConfig, ApiDataSource } from '../../types';
import { TreeNode, TreeNodeType } from './SectionTree';
import { WIDGET_TYPES, ORIENTATIONS } from './schemas';

interface PropertyEditorProps {
  node: TreeNode | null;
  onChange: (node: TreeNode, updates: Partial<SectionConfig | PanelConfig | BaseWidgetConfig>) => void;
  onDelete: (node: TreeNode) => void;
  onDuplicate: (node: TreeNode) => void;
}

/**
 * Property editor component for editing selected node properties
 */
export const PropertyEditor: React.FC<PropertyEditorProps> = ({
  node,
  onChange,
  onDelete,
  onDuplicate,
}) => {
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
          padding: '15px',
          background: '#f8f9fa',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
        }}
      >
        Select an item to edit properties
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
            Section ID <span style={{ color: '#e74c3c' }}>*</span>
          </label>
          <input
            type="text"
            value={section['section-id'] || ''}
            onChange={(e) => handleChange('section-id', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'white',
              color: '#333',
            }}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            Section Title
          </label>
          <input
            type="text"
            value={section['section-title'] || ''}
            onChange={(e) => handleChange('section-title', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'white',
              color: '#333',
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
            <span>Editable</span>
          </label>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            Column Span
          </label>
          <input
            type="number"
            value={section['section-column-span'] || 1}
            onChange={(e) => handleChange('section-column-span', parseInt(e.target.value) || 1)}
            min="1"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'white',
              color: '#333',
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
            Panel ID <span style={{ color: '#e74c3c' }}>*</span>
          </label>
          <input
            type="text"
            value={panel['panel-id'] || ''}
            onChange={(e) => handleChange('panel-id', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'white',
              color: '#333',
            }}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            Orientation
          </label>
          <select
            value={panel['panel-orientation'] || 'vertical'}
            onChange={(e) => handleChange('panel-orientation', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'white',
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
            Column Span
          </label>
          <input
            type="number"
            value={panel['panel-column-span'] || 1}
            onChange={(e) => handleChange('panel-column-span', parseInt(e.target.value) || 1)}
            min="1"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'white',
              color: '#333',
            }}
          />
        </div>
      </>
    );
  };

  const renderWidgetProperties = () => {
    const widget = localData as BaseWidgetConfig;
    return (
      <>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            Widget Type <span style={{ color: '#e74c3c' }}>*</span>
          </label>
          <select
            value={widget.widget || ''}
            onChange={(e) => {
              const newWidgetType = e.target.value;
              // When widget type changes, preserve common fields but clear widget-specific ones
              const updated: any = {
                ...widget,
                widget: newWidgetType,
              };
              
              // Clear widget-specific fields that don't apply to the new type
              if (!['select', 'radio', 'checkbox'].includes(newWidgetType)) {
                delete updated['widget-data-source'];
              }
              if (newWidgetType !== 'table') {
                delete updated['widget-data-columns'];
              }
              
              setLocalData(updated);
              onChange(node, updated);
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'white',
            }}
          >
            {WIDGET_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            Widget ID <span style={{ color: '#e74c3c' }}>*</span>
          </label>
          <input
            type="text"
            value={widget['widget-id'] || ''}
            onChange={(e) => handleChange('widget-id', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'white',
              color: '#333',
            }}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            Widget Label
          </label>
          <input
            type="text"
            value={widget['widget-label'] || ''}
            onChange={(e) => handleChange('widget-label', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'white',
              color: '#333',
            }}
            placeholder="Enter label..."
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            Data Path
          </label>
          <input
            type="text"
            value={typeof widget['widget-data-path'] === 'string' ? widget['widget-data-path'] : ''}
            onChange={(e) => handleChange('widget-data-path', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'white',
              color: '#333',
            }}
            placeholder="person.name"
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 500 }}>
            Placeholder
          </label>
          <input
            type="text"
            value={widget['widget-data-placeholder'] || ''}
            onChange={(e) => handleChange('widget-data-placeholder', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'white',
              color: '#333',
            }}
            placeholder="Enter placeholder..."
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={widget['widget-required'] || false}
              onChange={(e) => handleChange('widget-required', e.target.checked)}
            />
            <span>Required</span>
          </label>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={widget['widget-readonly'] || false}
              onChange={(e) => handleChange('widget-readonly', e.target.checked)}
            />
            <span>Readonly</span>
          </label>
        </div>
        {/* Widget-specific fields based on widget type */}
        {['select', 'radio', 'checkbox'].includes(widget.widget) && (
          <div style={{ marginBottom: '20px', padding: '10px', background: '#e3f2fd', borderRadius: '4px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>
              Data Source (Required for {widget.widget})
            </label>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                Source Type
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
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '11px',
                  background: 'white',
                }}
              >
                <option value="static">Static</option>
                <option value="api">API</option>
                <option value="schema">Schema</option>
              </select>
            </div>
            {widget['widget-data-source']?.type === 'static' && (
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                  Options (JSON array format: see placeholder below)
                </label>
                <textarea
                  value={JSON.stringify(widget['widget-data-source']?.options || [], null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      handleNestedChange('widget-data-source', 'options', parsed);
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    minHeight: '80px',
                    background: 'white',
                    color: '#333',
                  }}
                  placeholder='[{"value": "opt1", "label": "Option 1"}]'
                />
              </div>
            )}
            {widget['widget-data-source']?.type === 'api' && (() => {
              const apiSource = widget['widget-data-source'] as ApiDataSource;
              return (
                <>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                      API URL
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
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '11px',
                        background: 'white',
                        color: '#333',
                      }}
                      placeholder="https://api.example.com/options"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                      Value/Label Keys (e.g., "id"/"name")
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
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: '11px',
                          background: 'white',
                          color: '#333',
                        }}
                        placeholder="value key"
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
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: '11px',
                          background: 'white',
                          color: '#333',
                        }}
                        placeholder="label key"
                      />
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {widget.widget === 'table' && (
          <div style={{ marginBottom: '20px', padding: '10px', background: '#fff3e0', borderRadius: '4px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>
              Table Columns
            </label>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px' }}>
              Configure columns in JSON editor or add via code
            </div>
            <textarea
              value={JSON.stringify(widget['widget-data-columns'] || [], null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleChange('widget-data-columns', parsed);
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'monospace',
                minHeight: '100px',
                background: 'white',
                color: '#333',
              }}
              placeholder='[{"column-key": "col1", "widget-label": "Column 1", "widget": "text"}]'
            />
          </div>
        )}

        {widget.widget === 'number' && (
          <div style={{ marginBottom: '20px', padding: '10px', background: '#f3e5f5', borderRadius: '4px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>
              Number Validation
            </label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                  Min Value
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
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '11px',
                    background: 'white',
                    color: '#333',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                  Max Value
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
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '11px',
                    background: 'white',
                    color: '#333',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {['date', 'datetime'].includes(widget.widget) && (
          <div style={{ marginBottom: '20px', padding: '10px', background: '#e8f5e9', borderRadius: '4px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>
              Date Range Options
            </label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                  Min Date
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
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '11px',
                    background: 'white',
                    color: '#333',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                  Max Date
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
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '11px',
                    background: 'white',
                    color: '#333',
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
              <span>Show Calendar</span>
            </label>
          </div>
        )}

        {/* Validation section - show for all widgets */}
        <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>
            Validation
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
              <span>Required</span>
            </label>
          </div>
          {['text', 'textarea'].includes(widget.widget) && (
            <>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                  Min Length
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
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '11px',
                    background: 'white',
                    color: '#333',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
                  Max Length
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
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '11px',
                    background: 'white',
                    color: '#333',
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
        return '#2196f3';
      case 'panel':
        return '#ff9800';
      case 'widget':
        return '#4caf50';
    }
  };

  return (
    <div
      style={{
        padding: '15px',
        overflowY: 'auto',
        background: '#f8f9fa',
        height: '100%',
      }}
    >
      <h3 style={{ fontSize: '14px', marginBottom: '15px', color: '#2c3e50' }}>Properties</h3>
      <div
        style={{
          background: getHeaderColor(),
          color: 'white',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '20px',
          fontWeight: 600,
          fontSize: '13px',
        }}
      >
        {node.type === 'section' && `Section: ${(node.data as SectionConfig)['section-id']}`}
        {node.type === 'panel' && `Panel: ${(node.data as PanelConfig)['panel-id']}`}
        {node.type === 'widget' && `Widget: ${(node.data as BaseWidgetConfig)['widget-id']}`}
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
            background: '#f44336',
            color: 'white',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Delete
        </button>
        <button
          onClick={() => onDuplicate(node)}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            borderRadius: '10px',
            background: '#ff9800',
            color: 'white',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Duplicate
        </button>
      </div>
    </div>
  );
};
