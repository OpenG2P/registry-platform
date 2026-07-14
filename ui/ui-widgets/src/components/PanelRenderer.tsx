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

  const getContainerClassAndStyle = () => {
    if (orientation === 'horizontal' && nestedPanels.length > 0) {
      let totalColumns = 0;
      nestedPanels.forEach((nestedPanel) => {
        const columnSpan = nestedPanel['panel-column-span'] || 1;
        totalColumns += columnSpan;
      });

      totalColumns = Math.max(totalColumns, nestedPanels.length);

      return {
        className: 'grid',
        style: { gridTemplateColumns: `repeat(${totalColumns}, minmax(200px, 1fr))` },
      };
    }
    return {
      className: orientation === 'horizontal'
        ? 'flex flex-row'
        : 'flex flex-col',
      style: { gap: orientation === 'horizontal' ? '16px' : '0px' },
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
        const nestedOrientation = nestedPanel['panel-orientation'] || 'vertical';
        const columnSpan = nestedPanel['panel-column-span'];

        const getNestedPanelStyle = (): CSSProperties => {
          if (orientation === 'horizontal') {
            const baseStyle: CSSProperties = {
              minWidth: '200px',
              paddingRight: !isLastPanel ? '40px' : undefined,
              paddingLeft: !isFirstPanel ? '40px' : undefined,
              position: 'relative',
            };

            if (nestedOrientation === 'vertical' && columnSpan && columnSpan > 1) {
              return {
                ...baseStyle,
                gridColumn: `span ${columnSpan}`,
                minWidth: 'auto',
              };
            }

            return baseStyle;
          }

          if (columnSpan && columnSpan > 1) {
            const width = columnSpan * 200;
            return {
              width: `${width}px`,
              maxWidth: '100%',
              flexShrink: 0,
            };
          }
          return { width: '100%' };
        };

        const nestedPanelStyle = getNestedPanelStyle();

        return (
          <Fragment key={nestedPanel['panel-id'] || `panel-${index}`}>
            <div
              className={orientation === 'horizontal' ? 'min-w-200 relative' : 'w-full'}
              style={nestedPanelStyle}
              data-panel-column-span={columnSpan || undefined}
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
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: '5px',
                    width: '1px',
                    backgroundColor: isEditMode ? 'var(--owt-color-primary, #F5BB1A)' : 'var(--owt-panel-divider-color, #C4C4C4)',
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
      style={orientation === 'horizontal' ? { width: '100%' } : {}}
    >
      {content}
    </div>
  );
};
