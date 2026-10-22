import { Fragment, type CSSProperties } from 'react';
import { PanelConfig, DataSourceRequestHandler } from '../types';
import { UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { WidgetRenderer } from './WidgetRenderer';

export interface PanelRendererProps {
  panel: PanelConfig;
  dataSourceRequestHandler?: DataSourceRequestHandler;
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
  isEditMode?: boolean;
}

const PANEL_LAYOUT_CSS = `
.panel-horizontal-grid {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
.panel-horizontal-grid > .panel-nested {
  min-width: 0;
  max-width: 100%;
  position: relative;
}
.panel-horizontal-divider {
  display: none;
}
.panel-widget-row {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  gap: 0;
}
@media (min-width: 1024px) {
  .panel-horizontal-grid {
    grid-template-columns: repeat(var(--panel-columns, 1), minmax(0, 1fr));
    gap: 0;
  }
  .panel-horizontal-grid > .panel-nested {
    grid-column: span var(--panel-span, 1);
  }
  .panel-horizontal-grid > .panel-nested.panel-nested-pad-left {
    padding-left: 40px;
  }
  .panel-horizontal-grid > .panel-nested.panel-nested-pad-right {
    padding-right: 40px;
  }
  .panel-horizontal-divider {
    display: block;
  }
  .panel-widget-row {
    flex-direction: row;
    gap: 16px;
  }
}
`;

export const PanelRenderer = ({
  panel,
  dataSourceRequestHandler,
  schemaData,
  onValueChange,
  isEditMode = false,
}: PanelRendererProps) => {
  const orientation = panel['panel-orientation'] || 'vertical';
  const nestedPanels = panel.panels || [];
  const widgets = panel.widgets || [];
  const isHorizontalGrid = orientation === 'horizontal' && nestedPanels.length > 0;

  const getContainerClassAndStyle = (): { className: string; style: CSSProperties } => {
    if (isHorizontalGrid) {
      let totalColumns = 0;
      nestedPanels.forEach((nestedPanel) => {
        const columnSpan = nestedPanel['panel-column-span'] || 1;
        totalColumns += columnSpan;
      });

      totalColumns = Math.max(totalColumns, nestedPanels.length);

      return {
        className: 'panel-horizontal-grid',
        style: { ['--panel-columns' as string]: String(totalColumns) },
      };
    }
    return {
      className: orientation === 'horizontal' ? 'panel-widget-row' : 'flex flex-col',
      style: {},
    };
  };

  const { className: containerClass, style: containerStyle } = getContainerClassAndStyle();

  const content = (
    <div
      className={containerClass}
      style={{
        width: '100%',
        ...containerStyle,
      }}
    >
      {nestedPanels.map((nestedPanel, index) => {
        const isLastPanel = index === nestedPanels.length - 1;
        const isFirstPanel = index === 0;
        const columnSpan = nestedPanel['panel-column-span'] || 1;

        const nestedPanelStyle: CSSProperties = isHorizontalGrid
          ? { ['--panel-span' as string]: String(columnSpan) }
          : { width: '100%', maxWidth: '100%', minWidth: 0 };

        const nestedClassName = isHorizontalGrid
          ? [
              'panel-nested',
              !isFirstPanel ? 'panel-nested-pad-left' : '',
              !isLastPanel ? 'panel-nested-pad-right' : '',
            ]
              .filter(Boolean)
              .join(' ')
          : 'w-full min-w-0';

        return (
          <Fragment key={nestedPanel['panel-id'] || `panel-${index}`}>
            <div
              className={nestedClassName}
              style={nestedPanelStyle}
              data-panel-column-span={columnSpan > 1 ? columnSpan : undefined}
            >
              <PanelRenderer
                panel={nestedPanel}
                dataSourceRequestHandler={dataSourceRequestHandler}
                schemaData={schemaData}
                onValueChange={onValueChange}
                isEditMode={isEditMode}
              />
              {orientation === 'horizontal' && !isLastPanel && (
                <div
                  className="panel-horizontal-divider"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: '5px',
                    width: '1px',
                    backgroundColor: isEditMode
                      ? 'var(--owt-color-primary-dark)'
                      : 'var(--owt-panel-divider-color)',
                  }}
                />
              )}
            </div>
          </Fragment>
        );
      })}

      {widgets.map((widgetConfig, index) => (
        <WidgetRenderer
          key={widgetConfig['widget-id'] || `widget-${index}`}
          config={widgetConfig}
          dataSourceRequestHandler={dataSourceRequestHandler}
          schemaData={schemaData}
          onValueChange={onValueChange}
        />
      ))}
    </div>
  );

  return (
    <div
      className={`panel panel-${orientation}`}
      data-panel-id={panel['panel-id']}
      style={{ width: '100%', minWidth: 0, maxWidth: '100%' }}
    >
      <style>{PANEL_LAYOUT_CSS}</style>
      {content}
    </div>
  );
};
