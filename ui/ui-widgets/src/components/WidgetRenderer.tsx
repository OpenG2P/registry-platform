import React from 'react';
import { useSelector } from 'react-redux';
import { BaseWidgetConfig, WidgetContextValue } from '../types';
import { useBaseWidget, UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { widgetRegistry } from '../registry/WidgetRegistry';
import { useWidgetContext } from './WidgetProvider';
import { useWidgetCascade } from '../hooks/useWidgetCascade';
import { useGeoWidgetCascade } from '../hooks/useGeoWidgetCascade';
import { WidgetRootState } from '../store';

export interface WidgetRendererProps extends Omit<UseBaseWidgetOptions, 'config'> {
  config: BaseWidgetConfig;
  defaultComponent?: React.ComponentType<any>;
}

export const WidgetRenderer = ({
  config,
  dataSourceRequestHandler: propDataSourceRequestHandler,
  schemaData: propSchemaData,
  onValueChange,
  defaultComponent,
}: WidgetRendererProps) => {
  // Use context values as fallback
  const context = useWidgetContext();
  const dataSourceRequestHandler = propDataSourceRequestHandler || context.dataSourceRequestHandler;
  const schemaData = propSchemaData || context.schemaData;
  
  // Warn if dataSourceRequestHandler is missing for API data sources, but don't break rendering
  // This allows widgets to render in read-only or static modes (e.g., CRView)
  if (!dataSourceRequestHandler && config['widget-data-source']?.type === 'api') {
    console.warn(
      `[WidgetRenderer] dataSourceRequestHandler is not provided for widget ${config['widget-id']} with API data source. ` +
      `The widget will render but API data source functionality will be disabled.`
    );
  }

  // Get values from Redux for cascade hooks
  const values = useSelector((state: WidgetRootState) => state.widget.values);

  const widgetContext = useBaseWidget({
    config,
    dataSourceRequestHandler,
    schemaData,
    onValueChange,
  });

  // Apply cascade hooks if configured (only if handler is available)
  if (dataSourceRequestHandler) {
    useWidgetCascade({
      config,
      dataSourceRequestHandler,
      values,
    });

    useGeoWidgetCascade({
      config,
      dataSourceRequestHandler,
      values,
    });
  }

  // Don't render if not visible
  if (!widgetContext.isVisible) {
    return null;
  }

  // Render widget using registry
  // Don't use key based on readonly state - it causes remounting which resets userHasSetValueRef
  // The readonly state is already handled in the widget components themselves
  return (
    <div 
      className="widget-container" 
      data-widget-id={widgetContext.widgetId} 
      style={{ marginBottom: 0 }}
    >
      {widgetRegistry.render(config, widgetContext, defaultComponent)}
    </div>
  );
};

