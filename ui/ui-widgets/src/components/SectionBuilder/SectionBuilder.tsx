import React, { useState, useCallback, useEffect, useRef } from 'react';
import { SectionConfig, PanelConfig, BaseWidgetConfig } from '../../types';
import { JSONEditorPanel } from './JSONEditorPanel';
import { VisualBuilderPanel } from './VisualBuilderPanel';
import { TreeNode } from './SectionTree';
import { themeToCSSVariables, OWT_FIELD_STYLES } from '../../theme';
import { useWidgetTheme } from '../../hooks/useWidgetTheme';

export interface SectionBuilderProps {
  initialSection?: SectionConfig;
  onChange?: (section: SectionConfig) => void;
  onSave?: (section: SectionConfig) => void;
}

export const SectionBuilder: React.FC<SectionBuilderProps> = ({
  initialSection,
  onChange,
  onSave,
}) => {
  const defaultSection: SectionConfig = {
    'section-id': 'new-section',
    'section-title': '',
    'section-editable': false,
    panels: [],
  };

  const [section, setSection] = useState<SectionConfig>(
    initialSection || defaultSection
  );
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const theme = useWidgetTheme();

  const originalSectionRef = useRef<SectionConfig>(
    initialSection ? JSON.parse(JSON.stringify(initialSection)) : defaultSection
  );
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (initialSection) {
      if (isInitialMount.current) {
        originalSectionRef.current = JSON.parse(JSON.stringify(initialSection));
        isInitialMount.current = false;
      }
      setSection(initialSection);
    }
  }, [initialSection]);

  const handleSectionChange = useCallback(
    (updatedSection: SectionConfig) => {
      setSection(updatedSection);
      if (onChange) {
        onChange(updatedSection);
      }
    },
    [onChange]
  );

  const handleReset = useCallback(() => {
    const original = JSON.parse(JSON.stringify(originalSectionRef.current));
    setSection(original);
    setSelectedNode(null);
    if (onChange) {
      onChange(original);
    }
  }, [onChange]);

  const handleAddPanel = useCallback(
    (parentId: string, parentType: 'section' | 'panel' | 'widget') => {
      const updatedSection = JSON.parse(JSON.stringify(section));
      const newPanel: PanelConfig = {
        'panel-id': `panel-${Date.now()}`,
        'panel-orientation': 'vertical',
        widgets: [],
      };

      if (parentType === 'section') {
        updatedSection.panels = [...(updatedSection.panels || []), newPanel];
      } else if (parentType === 'panel') {
        const addPanelToParent = (panels: PanelConfig[]): boolean => {
          for (const panel of panels) {
            if (panel['panel-id'] === parentId) {
              panel.panels = [...(panel.panels || []), newPanel];
              return true;
            }
            if (panel.panels && addPanelToParent(panel.panels)) {
              return true;
            }
          }
          return false;
        };
        if (updatedSection.panels) {
          addPanelToParent(updatedSection.panels);
        }
      }

      handleSectionChange(updatedSection);
    },
    [section, handleSectionChange]
  );

  const handleAddWidget = useCallback(
    (parentId: string) => {
      const updatedSection = JSON.parse(JSON.stringify(section));
      const newWidget: BaseWidgetConfig = {
        widget: 'text',
        'widget-id': `widget-${Date.now()}`,
        'widget-label': 'New Widget',
        'widget-data-path': '',
      };

      const addWidgetToPanel = (panels: PanelConfig[]): boolean => {
        for (const panel of panels) {
          if (panel['panel-id'] === parentId) {
            panel.widgets = [...(panel.widgets || []), newWidget];
            return true;
          }
          if (panel.panels && addWidgetToPanel(panel.panels)) {
            return true;
          }
        }
        return false;
      };

      if (updatedSection.panels) {
        addWidgetToPanel(updatedSection.panels);
      }

      handleSectionChange(updatedSection);
    },
    [section, handleSectionChange]
  );

  const handleDeleteNode = useCallback(
    (node: TreeNode) => {
      const updatedSection = JSON.parse(JSON.stringify(section));

      if (node.type === 'section') {

        return;
      }

      const deleteFromSection = (current: any): boolean => {
        if (current.panels) {
          const panelIndex = current.panels.findIndex(
            (p: PanelConfig) => p['panel-id'] === node.id
          );
          if (panelIndex !== -1 && node.type === 'panel') {
            current.panels.splice(panelIndex, 1);
            return true;
          }

          for (const panel of current.panels) {
            if (panel['panel-id'] === node.id && node.type === 'panel') {

              const index = current.panels.indexOf(panel);
              if (index !== -1) {
                current.panels.splice(index, 1);
                return true;
              }
            }

            if (panel.widgets) {
              const widgetIndex = panel.widgets.findIndex(
                (w: BaseWidgetConfig) => w['widget-id'] === node.id
              );
              if (widgetIndex !== -1 && node.type === 'widget') {
                panel.widgets.splice(widgetIndex, 1);
                return true;
              }
            }

            if (panel.panels && deleteFromSection(panel)) {
              return true;
            }
          }
        }

        return false;
      };

      deleteFromSection(updatedSection);
      handleSectionChange(updatedSection);
      setSelectedNode(null);
    },
    [section, handleSectionChange]
  );

  const handleDuplicateNode = useCallback(
    (node: TreeNode) => {
      const updatedSection = JSON.parse(JSON.stringify(section));

      if (node.type === 'section') {
        return;
      }

      const duplicateInSection = (current: any): boolean => {
        if (current.panels) {
          for (const panel of current.panels) {
            if (panel['panel-id'] === node.id && node.type === 'panel') {
              const duplicated: PanelConfig = {
                ...panel,
                'panel-id': `${panel['panel-id']}-copy-${Date.now()}`,
              };
              const index = current.panels.indexOf(panel);
              current.panels.splice(index + 1, 0, duplicated);
              return true;
            }

            if (panel.widgets) {
              for (const widget of panel.widgets) {
                if (widget['widget-id'] === node.id && node.type === 'widget') {
                  const duplicated: BaseWidgetConfig = {
                    ...widget,
                    'widget-id': `${widget['widget-id']}-copy-${Date.now()}`,
                  };
                  const index = panel.widgets.indexOf(widget);
                  panel.widgets.splice(index + 1, 0, duplicated);
                  return true;
                }
              }
            }

            if (panel.panels && duplicateInSection(panel)) {
              return true;
            }
          }
        }
        return false;
      };

      duplicateInSection(updatedSection);
      handleSectionChange(updatedSection);
    },
    [section, handleSectionChange]
  );

  const toggleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isMaximized) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMaximized(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMaximized]);

  return (
    <div className="openg2p-widget-theme-root" style={themeToCSSVariables(theme)}>
      <style>{OWT_FIELD_STYLES}</style>
      {isMaximized && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--owt-color-overlay)',
            zIndex: 9998,
          }}
          onClick={toggleMaximize}
        />
      )}
      <div
        style={{
          display: 'flex',
          height: isMaximized ? '100vh' : '100%',
          width: isMaximized ? '100vw' : '100%',
          minHeight: 0,
          background: 'var(--owt-color-bg)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          overflow: 'hidden',
          border: 'none',
          position: isMaximized ? 'fixed' : 'relative',
          top: isMaximized ? 0 : 'auto',
          left: isMaximized ? 0 : 'auto',
          zIndex: isMaximized ? 9999 : 'auto',
        }}
      >

      <div style={{
        width: '50%',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        padding: '10px 10px 10px 10px',
        flexDirection: 'column',
        borderRight: '0px',
      }}>
        <JSONEditorPanel
          section={section}
          onChange={handleSectionChange}
          onReset={handleReset}
        />
      </div>

      <div style={{
        width: '50%',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <VisualBuilderPanel
          section={section}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
          onSectionChange={handleSectionChange}
          onAddPanel={handleAddPanel}
          onAddWidget={handleAddWidget}
          onDeleteNode={handleDeleteNode}
          onDuplicateNode={handleDuplicateNode}
          onSave={onSave}
          isMaximized={isMaximized}
          onToggleMaximize={toggleMaximize}
        />
      </div>
      </div>
    </div>
  );
};
