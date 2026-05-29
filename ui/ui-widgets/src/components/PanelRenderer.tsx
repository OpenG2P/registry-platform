import React from 'react';
import { PanelConfig, DataSourceRequestHandler } from '../types';
import { UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { WidgetRenderer } from './WidgetRenderer';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';

export interface PanelRendererProps {
  panel: PanelConfig;
  dataSourceRequestHandler?: DataSourceRequestHandler;
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
  isEditMode?: boolean;
}

/**
 * Renders a panel with its nested panels or widgets
 * 
 * Panels can contain:
 * - Nested panels (for layout composition)
 * - Widgets (for actual form inputs/controls)
 */
export const PanelRenderer = ({
  panel,
  dataSourceRequestHandler,
  schemaData,
  onValueChange,
  isEditMode = false,
}: PanelRendererProps) => {
  const { translateConfig } = useWidgetTranslation();
  const orientation = panel['panel-orientation'] || 'vertical';
  const nestedPanels = panel.panels || [];
  const widgets = panel.widgets || [];

  // For horizontal orientation, use grid for equal-width columns
  // Dynamic grid based on number of nested panels and their column spans
  // For vertical orientation, use flex column
  const getContainerClassAndStyle = () => {
    if (orientation === 'horizontal' && nestedPanels.length > 0) {
      // Calculate total columns needed based on panel column spans
      // Sum up all column spans, or use panel count if no spans specified
      let totalColumns = 0;
      nestedPanels.forEach(panel => {
        const columnSpan = panel['panel-column-span'] || 1;
        totalColumns += columnSpan;
      });
      
      // Ensure at least as many columns as panels (for panels without explicit span)
      totalColumns = Math.max(totalColumns, nestedPanels.length);
      
      // Use predefined grid classes for common cases (1-5)
      // For more than 5, use inline style
      // Removed gap to allow borders to show properly
      if (totalColumns <= 5) {
        // For grid with column spans, we need to use inline styles to set minmax
        // This ensures each column is at least 200px wide
        return {
          className: 'grid',
          style: { gridTemplateColumns: `repeat(${totalColumns}, minmax(200px, 1fr))` },
        };
      } else {
        // For more than 5 columns, use inline style
        // Use minmax(200px, 1fr) to ensure minimum 200px per column
        return {
          className: 'grid',
          style: { gridTemplateColumns: `repeat(${totalColumns}, minmax(200px, 1fr))` },
        };
      }
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
        // Panels should always take full width of their container
        // Orientation only affects how content is arranged inside
        width: '100%',
        ...containerStyle
      }}
    >
      {/* Render nested panels */}
      {nestedPanels.map((nestedPanel, index) => {
        const isLastPanel = index === nestedPanels.length - 1;
        const isFirstPanel = index === 0;
        const nestedOrientation = nestedPanel['panel-orientation'] || 'vertical';
        const columnSpan = nestedPanel['panel-column-span'];
        
        // Calculate style for nested panel based on orientation and column span
        const getNestedPanelStyle = () => {
          if (orientation === 'horizontal') {
            // When nested inside horizontal panel, check for column span
            const baseStyle: React.CSSProperties = {
              minWidth: '200px',
              paddingRight: !isLastPanel ? '40px' : undefined,
              paddingLeft: !isFirstPanel ? '40px' : undefined,
              position: 'relative',
            };
            
            // If vertical panel has column span, use CSS grid-column-span
            if (nestedOrientation === 'vertical' && columnSpan && columnSpan > 1) {
              return {
                ...baseStyle,
                gridColumn: `span ${columnSpan}`,
                minWidth: 'auto', // Remove minWidth constraint when spanning columns
              };
            }
            
            return baseStyle;
          } else {
            // Vertical panel nested in vertical panel
            if (columnSpan && columnSpan > 1) {
              // If column span is specified, calculate width based on 200px per column
              const width = columnSpan * 200;
              return {
                width: `${width}px`,
                maxWidth: '100%',
                flexShrink: 0,
              };
            }
            return { width: '100%' };
          }
        };
        
        const nestedPanelStyle = getNestedPanelStyle();
        
        return (
          <React.Fragment key={nestedPanel['panel-id'] || `panel-${index}`}>
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
          </React.Fragment>
        );
      })}
      
      {/* Render widgets */}
      {widgets.map((widgetConfig, index) => {
        // Don't use readonly state in key - it causes remounting which resets userHasSetValueRef
        // The readonly state is already handled in the widget components themselves
        return (
          <WidgetRenderer
            key={widgetConfig['widget-id'] || `widget-${index}`}
            config={widgetConfig}
            dataSourceRequestHandler={dataSourceRequestHandler}
            schemaData={schemaData}
            onValueChange={onValueChange}
          />
        );
      })}
    </div>
  );

  // Render panel without card styling (panel-type removed from schema)
  // Vertical panels will have constrained width via CSS in SectionRenderer
  // Horizontal panels take full width
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
