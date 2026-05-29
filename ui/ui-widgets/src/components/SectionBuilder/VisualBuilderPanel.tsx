import React from 'react';
import { SectionConfig, PanelConfig, BaseWidgetConfig } from '../../types';
import { SectionTree, TreeNode } from './SectionTree';
import { PropertyEditor } from './PropertyEditor';
import { maximizeIcon, minimizeIcon } from '../../assets';

interface VisualBuilderPanelProps {
  section: SectionConfig;
  selectedNode: TreeNode | null;
  onSelectNode: (node: TreeNode | null) => void;
  onSectionChange: (section: SectionConfig) => void;
  onAddPanel: (parentId: string, parentType: 'section' | 'panel' | 'widget') => void;
  onAddWidget: (parentId: string) => void;
  onDeleteNode: (node: TreeNode) => void;
  onDuplicateNode: (node: TreeNode) => void;
  onSave?: (section: SectionConfig) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

/**
 * Visual Builder Panel - Right side of Section Builder
 */
export const VisualBuilderPanel: React.FC<VisualBuilderPanelProps> = ({
  section,
  selectedNode,
  onSelectNode,
  onSectionChange,
  onAddPanel,
  onAddWidget,
  onDeleteNode,
  onDuplicateNode,
  onSave,
  isMaximized = false,
  onToggleMaximize,
}) => {
  // Validate section before saving
  const validateSection = (sectionToValidate: SectionConfig): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!sectionToValidate['section-id']) {
      errors.push('Section ID is required');
    }

    if (!sectionToValidate.panels || sectionToValidate.panels.length === 0) {
      errors.push('Section must have at least one panel');
    }

    // Validate panels
    const validatePanels = (panels: PanelConfig[]): void => {
      panels.forEach((panel, index) => {
        if (!panel['panel-id']) {
          errors.push(`Panel at index ${index} is missing panel-id`);
        }
        if (panel.panels) {
          validatePanels(panel.panels);
        }
        if (panel.widgets) {
          panel.widgets.forEach((widget, widgetIndex) => {
            if (!widget['widget-id']) {
              errors.push(`Widget at panel ${panel['panel-id'] || index}, index ${widgetIndex} is missing widget-id`);
            }
            if (!widget.widget) {
              errors.push(`Widget ${widget['widget-id'] || widgetIndex} is missing widget type`);
            }
          });
        }
      });
    };

    if (sectionToValidate.panels) {
      validatePanels(sectionToValidate.panels);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const handleSave = () => {
    const validation = validateSection(section);
    if (!validation.isValid) {
      console.error('Section validation failed:', validation.errors);
      alert(`Cannot save section. Please fix the following errors:\n\n${validation.errors.join('\n')}`);
      return;
    }

    if (onSave) {
      try {
        onSave(section);
      } catch (error) {
        console.error('Error saving section:', error);
        alert('An error occurred while saving the section. Please check the console for details.');
      }
    }
  };

  const handleNodeChange = (node: TreeNode, updates: Partial<SectionConfig | PanelConfig | BaseWidgetConfig>) => {
    // Create a deep copy of the section
    const updatedSection = JSON.parse(JSON.stringify(section));

    // Find and update the node in the section structure
    const updateInSection = (current: any, targetId: string, targetType: string): boolean => {
      if (targetType === 'section' && current['section-id'] === targetId) {
        Object.assign(current, updates);
        return true;
      }

      if (current.panels) {
        for (const panel of current.panels) {
          if (targetType === 'panel' && panel['panel-id'] === targetId) {
            Object.assign(panel, updates);
            return true;
          }
          if (updateInSection(panel, targetId, targetType)) {
            return true;
          }
          if (panel.widgets) {
            for (const widget of panel.widgets) {
              if (targetType === 'widget' && widget['widget-id'] === targetId) {
                Object.assign(widget, updates);
                return true;
              }
            }
          }
        }
      }

      if (current.widgets) {
        for (const widget of current.widgets) {
          if (targetType === 'widget' && widget['widget-id'] === targetId) {
            Object.assign(widget, updates);
            return true;
          }
        }
      }

      return false;
    };

    updateInSection(updatedSection, node.id, node.type);
    onSectionChange(updatedSection);
  };

  const handleAddPanel = () => {
    if (selectedNode) {
      if (selectedNode.type === 'section' || selectedNode.type === 'panel') {
        onAddPanel(selectedNode.id, selectedNode.type);
      }
    } else {
      // Add to root section
      onAddPanel(section['section-id'], 'section');
    }
  };

  const handleAddWidget = () => {
    if (selectedNode) {
      if (selectedNode.type === 'panel') {
        onAddWidget(selectedNode.id);
      } else if (selectedNode.type === 'section') {
        // Find first panel or create one
        if (section.panels && section.panels.length > 0) {
          onAddWidget(section.panels[0]['panel-id']);
        } else {
          // Create a panel first, then add widget
          const newPanel: PanelConfig = {
            'panel-id': `panel-${Date.now()}`,
            'panel-orientation': 'vertical',
            widgets: [],
          };
          const updatedSection = {
            ...section,
            panels: [...(section.panels || []), newPanel],
          };
          onSectionChange(updatedSection);
          onAddWidget(newPanel['panel-id']);
        }
      }
    } else {
      // Add to first panel or create one
      if (section.panels && section.panels.length > 0) {
        onAddWidget(section.panels[0]['panel-id']);
      }
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        minHeight: 0,
        paddingBottom: '10px',
        borderRight: '0px',
      }}
    >
      <div
        style={{
          padding: '20px 20px 20px 20px',

          background: '#ffffff',

          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: '16px', color: '#2c3e50', paddingTop: '5px' }}>
          Visual Builder
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleAddPanel}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '10px',
              background: '#2196f3',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '12px',
              whiteSpace: 'nowrap',
            }}
          >
            + Add Panel
          </button>
          <button
            onClick={handleAddWidget}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '10px',
              background: '#4caf50',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '12px',
              whiteSpace: 'nowrap',
            }}
          >
            + Add Widget
          </button>
          {onSave && (
            <button
              onClick={handleSave}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '10px',
                background: '#000000',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '12px',
                whiteSpace: 'nowrap',
              }}
            >
              Save
            </button>
          )}
          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              style={{
                padding: '8px',
                border: 'none',
                borderRadius: '4px',
                background: 'transparent',
                color: '#666',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
              }}
              title={isMaximized ? 'Minimize' : 'Maximize'}
            >
              {isMaximized ? (
                <img src={minimizeIcon} alt="Minimize" width="16" height="16" />
              ) : (
                <img src={maximizeIcon} alt="Maximize" width="16" height="16" />
              )}
            </button>
          )}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          border: '1px solid #ddd',
          borderRadius: '10px',
          minHeight: 0, // Important for flex children to respect overflow
        }}
      >
        {/* Tree View */}
        <div
          style={{
            width: '45%',
            borderRight: '1px solid #ddd',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0, // Important for flex children to respect overflow
            overflow: 'hidden',
          }}
        >
          <SectionTree
            section={section}
            selectedNode={selectedNode}
            onSelectNode={onSelectNode}
            onAddPanel={onAddPanel}
            onAddWidget={onAddWidget}
            onDeleteNode={onDeleteNode}
            onDuplicateNode={onDuplicateNode}
          />
        </div>

        {/* Properties Panel */}
        <div
          style={{
            width: '55%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0, // Important for flex children to respect overflow
            overflow: 'hidden',
          }}
        >
          <PropertyEditor
            node={selectedNode}
            onChange={handleNodeChange}
            onDelete={onDeleteNode}
            onDuplicate={onDuplicateNode}
          />
        </div>
      </div>
    </div>
  );
};
