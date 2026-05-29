import React from 'react';
import { WidgetRenderer, BaseWidgetConfig, UseBaseWidgetOptions } from '@openg2p/react-widgets';

/**
 * Example: Vertical layout widget
 * 
 * Usage in schema:
 * {
 *   "widget": "vertical-layout",
 *   "widget-type": "layout",
 *   "widgets": [
 *     { ... widget configs ... }
 *   ]
 * }
 */
interface VerticalLayoutWidgetProps {
  config: BaseWidgetConfig;
  apiAdapter?: UseBaseWidgetOptions['apiAdapter'];
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
}

export const VerticalLayoutWidget = ({
  config,
  apiAdapter,
  schemaData,
  onValueChange,
}: VerticalLayoutWidgetProps) => {
  const widgets = config.widgets || [];

  return (
    <div className="flex flex-col space-y-4">
      {widgets.map((widgetConfig: BaseWidgetConfig, index: number) => (
        <WidgetRenderer
          key={widgetConfig['widget-id'] || index}
          config={widgetConfig}
          apiAdapter={apiAdapter}
          schemaData={schemaData}
          onValueChange={onValueChange}
        />
      ))}
    </div>
  );
};

/**
 * Example: Horizontal layout widget
 * 
 * Usage in schema:
 * {
 *   "widget": "horizontal-layout",
 *   "widget-type": "layout",
 *   "widgets": [
 *     { ... widget configs ... }
 *   ]
 * }
 */
interface HorizontalLayoutWidgetProps {
  config: BaseWidgetConfig;
  apiAdapter?: UseBaseWidgetOptions['apiAdapter'];
  schemaData?: UseBaseWidgetOptions['schemaData'];
  onValueChange?: UseBaseWidgetOptions['onValueChange'];
}

export const HorizontalLayoutWidget = ({
  config,
  apiAdapter,
  schemaData,
  onValueChange,
}: HorizontalLayoutWidgetProps) => {
  const widgets = config.widgets || [];

  return (
    <div className="flex flex-row space-x-4">
      {widgets.map((widgetConfig: BaseWidgetConfig, index: number) => (
        <WidgetRenderer
          key={widgetConfig['widget-id'] || index}
          config={widgetConfig}
          apiAdapter={apiAdapter}
          schemaData={schemaData}
          onValueChange={onValueChange}
        />
      ))}
    </div>
  );
};

