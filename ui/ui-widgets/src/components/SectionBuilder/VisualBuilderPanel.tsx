import React, { useState } from 'react';
import { SectionConfig, PanelConfig, BaseWidgetConfig } from '../../types';
import { SectionTree, TreeNode } from './SectionTree';
import { PropertyEditor } from './PropertyEditor';
import { SearchableSelect } from './SearchableSelect';
import { maximizeIcon, minimizeIcon } from '../../assets';
import { WIDGET_TYPES } from './schemas';
import { useWidgetContext } from '../WidgetProvider';

interface VisualBuilderPanelProps {
  section: SectionConfig;
  selectedNode: TreeNode | null;
  onSelectNode: (node: TreeNode | null) => void;
  onSectionChange: (section: SectionConfig) => void;
  onAddPanel: (parentId: string, parentType: 'section' | 'panel' | 'widget') => void;
  onAddWidget: (parentId: string, widgetType?: string) => void;
  onDeleteNode: (node: TreeNode) => void;
  onDuplicateNode: (node: TreeNode) => void;
  onMoveNode?: (args: {
    kind: 'panel' | 'widget';
    parentPanelId: string | null;
    activeId: string;
    overId: string;
  }) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export const VisualBuilderPanel: React.FC<VisualBuilderPanelProps> = ({
  section,
  selectedNode,
  onSelectNode,
  onSectionChange,
  onAddPanel,
  onAddWidget,
  onDeleteNode,
  onDuplicateNode,
  onMoveNode,
  isMaximized = false,
  onToggleMaximize,
}) => {
  const { t } = useWidgetContext();
  const [paletteWidgetType, setPaletteWidgetType] = useState<string>(WIDGET_TYPES[0]);

  const handleNodeChange = (node: TreeNode, updates: Partial<SectionConfig | PanelConfig | BaseWidgetConfig>) => {
    const updatedSection = JSON.parse(JSON.stringify(section));

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
      onAddPanel(section['section-id'], 'section');
    }
  };

  const handleAddWidget = (widgetType = 'text') => {
    if (selectedNode) {
      if (selectedNode.type === 'panel') {
        onAddWidget(selectedNode.id, widgetType);
      } else if (selectedNode.type === 'section') {
        if (section.panels && section.panels.length > 0) {
          onAddWidget(section.panels[0]['panel-id'], widgetType);
        } else {
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
          onAddWidget(newPanel['panel-id'], widgetType);
        }
      }
    } else {
      if (section.panels && section.panels.length > 0) {
        onAddWidget(section.panels[0]['panel-id'], widgetType);
      }
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0%',
        width: '100%',
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: '20px',
          background: 'var(--owt-color-bg, #FFFFFF)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--owt-color-text, #011627)', paddingTop: '5px' }}>
          {t?.('sectionBuilder.visualBuilder') || 'Visual Builder'}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleAddPanel}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--owt-color-border, #C4C4C4)',
              borderRadius: '10px',
              background: 'var(--owt-btn-primary-bg, #FFFFFF)',
              color: 'var(--owt-btn-primary-color, #011627)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '12px',
              whiteSpace: 'nowrap',
            }}
          >
            {t?.('sectionBuilder.addPanel') || '+ Add Panel'}
          </button>
          <button
            onClick={() => handleAddWidget()}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--owt-color-border, #C4C4C4)',
              borderRadius: '10px',
              background: 'var(--owt-btn-primary-bg, #FFFFFF)',
              color: 'var(--owt-btn-primary-color, #011627)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '12px',
              whiteSpace: 'nowrap',
            }}
          >
            {t?.('sectionBuilder.addWidget') || '+ Add Widget'}
          </button>
          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              style={{
                padding: '8px',
                border: 'none',
                borderRadius: '4px',
                background: 'transparent',
                color: 'var(--owt-color-text-muted, #727474)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
              }}
              title={isMaximized ? (t?.('sectionBuilder.minimize') || 'Minimize') : (t?.('sectionBuilder.maximize') || 'Maximize')}
            >
              {isMaximized ? (
                <img src={minimizeIcon} alt={t?.('sectionBuilder.minimize') || 'Minimize'} width="16" height="16" />
              ) : (
                <img src={maximizeIcon} alt={t?.('sectionBuilder.maximize') || 'Maximize'} width="16" height="16" />
              )}
            </button>
          )}
        </div>
      </div>
      <div
        style={{
          flex: '1 1 0%',
          display: 'flex',
          overflow: 'hidden',
          border: '1px solid var(--owt-color-border, #C4C4C4)',
          borderRadius: '10px',
          minHeight: 0,
        }}
      >
        <div
          style={{
            flex: '1 1 0%',
            width: '45%',
            borderRight: '1px solid var(--owt-color-border, #C4C4C4)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 15px',
              borderBottom: '1px solid var(--owt-color-border-light, #E4E4E4)',
              background: 'var(--owt-color-bg, #FFFFFF)',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--owt-color-text, #011627)', marginBottom: '8px' }}>
              {t?.('sectionBuilder.widgetPalette') || 'Widget Palette'}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SearchableSelect
                  options={WIDGET_TYPES}
                  value={paletteWidgetType}
                  onChange={setPaletteWidgetType}
                  placeholder={t?.('sectionBuilder.searchWidgetType') || 'Search widget type...'}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (selectedNode?.type === 'panel') {
                    onAddWidget(selectedNode.id, paletteWidgetType);
                  } else {
                    handleAddWidget(paletteWidgetType);
                  }
                }}
                style={{
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'var(--owt-color-text, #011627)',
                  color: 'var(--owt-color-bg, #FFFFFF)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {t?.('sectionBuilder.add') || 'Add'}
              </button>
            </div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--owt-color-text-muted, #727474)' }}>
              {t?.('sectionBuilder.paletteTip') ||
                'Tip: select a panel first to control where widgets land.'}
            </div>
          </div>
          <div style={{ flex: '1 1 0%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <SectionTree
              section={section}
              selectedNode={selectedNode}
              onSelectNode={onSelectNode}
              onAddPanel={onAddPanel}
              onAddWidget={onAddWidget}
              onDeleteNode={onDeleteNode}
              onDuplicateNode={onDuplicateNode}
              onMoveNode={onMoveNode}
            />
          </div>
        </div>

        <div
          style={{
            flex: '1 1 0%',
            width: '55%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
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
