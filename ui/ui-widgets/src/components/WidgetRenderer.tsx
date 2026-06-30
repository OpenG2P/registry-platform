import type { ComponentType } from 'react';
import { useSelector } from 'react-redux';
import { BaseWidgetConfig } from '../types';
import { useBaseWidget, UseBaseWidgetOptions } from '../hooks/useBaseWidget';
import { widgetRegistry } from '../registry/WidgetRegistry';
import { useWidgetContext } from './WidgetProvider';
import { useWidgetCascade } from '../hooks/useWidgetCascade';
import { useGeoWidgetCascade } from '../hooks/useGeoWidgetCascade';
import { WidgetRootState } from '../store';

export interface WidgetRendererProps extends Omit<UseBaseWidgetOptions, 'config'> {
  config: BaseWidgetConfig;
  defaultComponent?: ComponentType<any>;
}

export const WidgetRenderer = ({
  config,
  dataSourceRequestHandler: propDataSourceRequestHandler,
  schemaData: propSchemaData,
  onValueChange,
  defaultComponent,
}: WidgetRendererProps) => {
  const context = useWidgetContext();
  const dataSourceRequestHandler = propDataSourceRequestHandler || context.dataSourceRequestHandler;
  const schemaData = propSchemaData || context.schemaData;

  if (!dataSourceRequestHandler && config['widget-data-source']?.type === 'api') {
    console.warn(
      `[WidgetRenderer] dataSourceRequestHandler is not provided for widget ${config['widget-id']} with API data source. ` +
      `The widget will render but API data source functionality will be disabled.`
    );
  }

  const values = useSelector((state: WidgetRootState) => state.widget.values);

  const widgetContext = useBaseWidget({
    config,
    dataSourceRequestHandler,
    schemaData,
    onValueChange,
  });

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

  if (!widgetContext.isVisible) {
    return null;
  }

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
