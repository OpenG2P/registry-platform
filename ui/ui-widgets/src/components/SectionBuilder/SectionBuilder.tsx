import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Provider } from 'react-redux';
import { SectionConfig, PanelConfig, BaseWidgetConfig } from '../../types';
import { JSONEditorPanel } from './JSONEditorPanel';
import { VisualBuilderPanel } from './VisualBuilderPanel';
import { TreeNode } from './SectionTree';
import { SectionRenderer } from '../SectionRenderer';
import { WidgetProvider, useWidgetContext } from '../WidgetProvider';
import { createWidgetStore } from '../../store';
import { themeToCSSVariables, OWT_FIELD_STYLES } from '../../theme';
import { useWidgetTheme } from '../../hooks/useWidgetTheme';
import { createDefaultWidgetConfig } from '../../registry/widgetTypes';
import { parseSectionJson } from './validate/parseSectionJson';

export type BuilderNotifyType = 'success' | 'error' | 'info' | 'warn';

export interface SectionBuilderProps {
  initialSection?: SectionConfig;
  onChange?: (section: SectionConfig) => void;
  onSave?: (section: SectionConfig) => void;
  onNotify?: (message: string, type: BuilderNotifyType) => void;
}

type BuilderMode = 'graphical' | 'raw';

export const SectionBuilder: React.FC<SectionBuilderProps> = ({
  initialSection,
  onChange,
  onSave,
  onNotify,
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
  const [mode, setMode] = useState<BuilderMode>('graphical');
  const [rawDraft, setRawDraft] = useState<string>('');
  const [rawIsValid, setRawIsValid] = useState<boolean>(true);
  const [rawErrors, setRawErrors] = useState<string[]>([]);
  const [rawEditorKey, setRawEditorKey] = useState(0);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const theme = useWidgetTheme();

  const originalSectionRef = useRef<SectionConfig>(
    initialSection ? JSON.parse(JSON.stringify(initialSection)) : defaultSection
  );
  const isInitialMount = useRef(true);

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
  const t = widgetContext.t;

  const makeSectionEditable = useCallback((s: SectionConfig): SectionConfig => {
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
          if (col && typeof col === 'object' && col.widget) return processWidget(col);
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
      ...s,
      panels: Array.isArray(s.panels) ? s.panels.map(processPanel) : [],
    };
  }, []);

  useEffect(() => {
    if (initialSection) {
      if (isInitialMount.current) {
        originalSectionRef.current = JSON.parse(JSON.stringify(initialSection));
        isInitialMount.current = false;
      }
      setSection(initialSection);
      if (mode === 'raw') {
        setRawDraft(JSON.stringify(initialSection, null, 2));
      }
    }
  }, [initialSection, mode]);

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
    setRawDraft(JSON.stringify(original, null, 2));
    setRawErrors([]);
    setRawIsValid(true);
    setRawEditorKey((key) => key + 1);
    if (onChange) {
      onChange(original);
    }
    onNotify?.(t?.('sectionBuilder.notifyReset') || 'Section reset to last saved state', 'info');
  }, [onChange, onNotify, t]);

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
    (parentId: string, widgetType = 'text') => {
      const updatedSection = JSON.parse(JSON.stringify(section));
      const newWidget: BaseWidgetConfig = createDefaultWidgetConfig(widgetType);

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

  const handleMoveNode = useCallback(
    (args: { kind: 'panel' | 'widget'; parentPanelId: string | null; activeId: string; overId: string }) => {
      const updatedSection: SectionConfig = JSON.parse(JSON.stringify(section));

      const findPanelById = (panels: PanelConfig[] | undefined, id: string): PanelConfig | null => {
        if (!panels) return null;
        for (const p of panels) {
          if (p['panel-id'] === id) return p;
          const found = findPanelById(p.panels, id);
          if (found) return found;
        }
        return null;
      };

      const moveWithin = <T,>(arr: T[], fromIdx: number, toIdx: number): T[] => {
        const copy = arr.slice();
        const [moved] = copy.splice(fromIdx, 1);
        copy.splice(toIdx, 0, moved);
        return copy;
      };

      if (args.kind === 'panel') {
        const container =
          args.parentPanelId === null
            ? updatedSection
            : findPanelById(updatedSection.panels, args.parentPanelId);
        if (!container || !Array.isArray((container as any).panels)) return;
        const panelsArr: PanelConfig[] = (container as any).panels;
        const fromIdx = panelsArr.findIndex((p) => p['panel-id'] === args.activeId);
        const toIdx = panelsArr.findIndex((p) => p['panel-id'] === args.overId);
        if (fromIdx < 0 || toIdx < 0) return;
        (container as any).panels = moveWithin(panelsArr, fromIdx, toIdx);
      } else {
        const parentPanel = findPanelById(updatedSection.panels, args.parentPanelId ?? '');
        if (!parentPanel || !Array.isArray(parentPanel.widgets)) return;
        const widgetsArr: BaseWidgetConfig[] = parentPanel.widgets;
        const fromIdx = widgetsArr.findIndex((w) => w['widget-id'] === args.activeId);
        const toIdx = widgetsArr.findIndex((w) => w['widget-id'] === args.overId);
        if (fromIdx < 0 || toIdx < 0) return;
        parentPanel.widgets = moveWithin(widgetsArr, fromIdx, toIdx);
      }

      handleSectionChange(updatedSection);
    },
    [section, handleSectionChange]
  );

  const toggleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev);
  }, []);

  const applyRawDraftToSection = useCallback((): SectionConfig | null => {
    const validation = parseSectionJson(rawDraft);
    if (!validation.isValid || !validation.parsed) {
      return null;
    }
    handleSectionChange(validation.parsed);
    return validation.parsed;
  }, [handleSectionChange, rawDraft]);

  const switchToGraphical = useCallback(() => {
    if (mode === 'graphical') return;
    if (!rawIsValid) {
      onNotify?.(
        t?.('sectionBuilder.notifyFixJsonBeforeSwitch', { errors: rawErrors.join('; ') }) ||
          `Fix JSON errors before switching: ${rawErrors.join('; ')}`,
        'error'
      );
      return;
    }
    const applied = applyRawDraftToSection();
    if (!applied) {
      onNotify?.(
        t?.('sectionBuilder.notifyCannotSwitchGraphical') ||
          'Cannot switch to Graphical mode until JSON is valid',
        'error'
      );
      return;
    }
    setMode('graphical');
  }, [applyRawDraftToSection, mode, onNotify, rawErrors, rawIsValid, t]);

  const switchToRaw = useCallback(() => {
    if (mode === 'raw') return;
    const nextDraft = JSON.stringify(section, null, 2);
    setRawDraft(nextDraft);
    setRawErrors([]);
    setRawIsValid(true);
    setRawEditorKey((key) => key + 1);
    setMode('raw');
    setSelectedNode(null);
  }, [mode, section]);

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
    <div
      className="openg2p-widget-theme-root"
      style={{
        ...themeToCSSVariables(theme),
        flex: '1 1 0%',
        minHeight: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{OWT_FIELD_STYLES}</style>
      {isMaximized && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9998,
          }}
          onClick={toggleMaximize}
        />
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: isMaximized ? undefined : '1 1 0%',
          height: isMaximized ? '100vh' : undefined,
          width: isMaximized ? '100vw' : '100%',
          minHeight: 0,
          background: 'var(--owt-color-bg, #FFFFFF)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          overflow: 'hidden',
          border: 'none',
          position: isMaximized ? 'fixed' : 'relative',
          top: isMaximized ? 0 : 'auto',
          left: isMaximized ? 0 : 'auto',
          zIndex: isMaximized ? 9999 : 'auto',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--owt-color-border-light, #E4E4E4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--owt-color-bg, #FFFFFF)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--owt-color-text, #011627)' }}>
              {t?.('sectionBuilder.title') || 'Section Builder'}
            </div>
            <div style={{ display: 'flex', gap: '6px', background: 'var(--owt-color-bg-alt, #F6F6F6)', padding: '4px', borderRadius: '9999px' }}>
              <button
                type="button"
                onClick={switchToGraphical}
                style={{
                  padding: '6px 10px',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  background: mode === 'graphical' ? 'var(--owt-color-text, #011627)' : 'transparent',
                  color: mode === 'graphical' ? 'var(--owt-color-bg, #FFFFFF)' : 'var(--owt-color-text, #011627)',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {t?.('sectionBuilder.graphical') || 'Graphical'}
              </button>
              <button
                type="button"
                onClick={switchToRaw}
                style={{
                  padding: '6px 10px',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  background: mode === 'raw' ? 'var(--owt-color-text, #011627)' : 'transparent',
                  color: mode === 'raw' ? 'var(--owt-color-bg, #FFFFFF)' : 'var(--owt-color-text, #011627)',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {t?.('sectionBuilder.rawJson') || 'Raw JSON'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--owt-color-primary-accent, #EE7C22)',
                color: 'var(--owt-color-bg, #FFFFFF)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700,
              }}
              title={t?.('sectionBuilder.previewSection') || 'Preview Section'}
            >
              {t?.('sectionBuilder.preview') || 'Preview'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid var(--owt-color-border, #C4C4C4)',
                background: 'var(--owt-color-bg, #FFFFFF)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--owt-color-text, #011627)',
              }}
            >
              {t?.('sectionBuilder.reset') || 'Reset'}
            </button>
            {onSave && (
              <button
                type="button"
                onClick={() => {
                  if (mode === 'raw') {
                    const validation = parseSectionJson(rawDraft);
                    if (!validation.isValid || !validation.parsed) {
                      onNotify?.(
                        validation.errors[0] ??
                          (t?.('sectionBuilder.notifyCannotSaveInvalidJson') || 'Cannot save until JSON is valid'),
                        'error'
                      );
                      return;
                    }
                    handleSectionChange(validation.parsed);
                    onSave(validation.parsed);
                    return;
                  }
                  onSave(section);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--owt-color-text, #011627)',
                  color: 'var(--owt-color-bg, #FFFFFF)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {t?.('sectionBuilder.save') || 'Save'}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flex: '1 1 0%', minHeight: 0, overflow: 'hidden' }}>
          {mode === 'raw' ? (
            <div style={{ flex: '1 1 0%', width: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <JSONEditorPanel
                key={rawEditorKey}
                initialText={rawDraft || JSON.stringify(section, null, 2)}
                onChange={handleSectionChange}
                onRawDraftChange={setRawDraft}
                onRawValidationChange={(next) => {
                  setRawIsValid(next.isValid);
                  setRawErrors(next.errors);
                }}
                onNotify={onNotify}
                isMaximized={isMaximized}
                onToggleMaximize={toggleMaximize}
              />
            </div>
          ) : (
            <div style={{ flex: '1 1 0%', width: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <VisualBuilderPanel
                section={section}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
                onSectionChange={handleSectionChange}
                onAddPanel={handleAddPanel}
                onAddWidget={handleAddWidget}
                onDeleteNode={handleDeleteNode}
                onDuplicateNode={handleDuplicateNode}
                onMoveNode={handleMoveNode}
                isMaximized={isMaximized}
                onToggleMaximize={toggleMaximize}
              />
            </div>
          )}
        </div>
      </div>
      {showPreview && createPortal(
        <div
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
            style={{
              background: 'var(--owt-color-bg, #FFFFFF)',
              borderRadius: '8px',
              width: '100%',
              minWidth: '700px',
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
              style={{
                padding: '15px 20px',
                borderBottom: '1px solid var(--owt-color-border-light, #E4E4E4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--owt-color-bg-alt, #F6F6F6)',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--owt-color-text, #011627)' }}>
                {t?.('sectionBuilder.previewTitle') || 'Preview'}
              </h2>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '5px 10px',
                  color: 'var(--owt-color-text-muted, #727474)',
                }}
                aria-label={t?.('sectionBuilder.closePreview') || 'Close preview'}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              <Provider store={previewStore}>
                <WidgetProvider
                  store={previewStore}
                  dataSourceRequestHandler={widgetContext.dataSourceRequestHandler}
                  schemaData={widgetContext.schemaData}
                  t={widgetContext.t}
                >
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <SectionRenderer
                      section={makeSectionEditable(section)}
                      hideEditButton={true}
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
