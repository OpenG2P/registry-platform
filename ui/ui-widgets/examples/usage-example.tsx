/**
 * Complete usage example showing how to set up and use the widget system
 */

import React from 'react';
import {
  WidgetProvider,
  WidgetRenderer,
  widgetRegistry,
  createWidgetStore,
} from '@openg2p/react-widgets';
import { TextInputWidget } from './TextInputWidget';
import { SelectWidget } from './SelectWidget';
import { VerticalLayoutWidget, HorizontalLayoutWidget } from './LayoutWidgets';

// 1. Create Redux store
const store = createWidgetStore();

// 2. Define API adapter (optional)
const apiAdapter = async (url: string, options: any) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return response.json();
};

// 3. Register your widgets
widgetRegistry.register({
  widget: 'text-input',
  component: TextInputWidget,
});

widgetRegistry.register({
  widget: 'select',
  component: SelectWidget,
});

widgetRegistry.register({
  widget: 'vertical-layout',
  component: VerticalLayoutWidget,
});

widgetRegistry.register({
  widget: 'horizontal-layout',
  component: HorizontalLayoutWidget,
});

// 4. Example widget configuration
const exampleConfig = {
  widget: 'vertical-layout',
  'widget-type': 'layout',
  widgets: [
    {
      widget: 'text-input',
      'widget-type': 'input',
      'widget-label': 'Name',
      'widget-id': 'name',
      'widget-data-path': 'person.name',
      'widget-required': true,
      'widget-data-validation': {
        required: true,
        minLength: 2,
        maxLength: 50,
      },
    },
    {
      widget: 'text-input',
      'widget-type': 'input',
      'widget-label': 'Email',
      'widget-id': 'email',
      'widget-data-path': 'person.email',
      'widget-required': true,
      'widget-data-validation': {
        validationType: 'email', // Predefined validation type
      },
    },
    {
      widget: 'text-input',
      'widget-type': 'input',
      'widget-label': 'Website',
      'widget-id': 'website',
      'widget-data-path': 'person.website',
      'widget-data-validation': {
        validationType: 'url', // Predefined validation type
      },
    },
    {
      widget: 'select',
      'widget-type': 'input',
      'widget-label': 'Country',
      'widget-id': 'country',
      'widget-data-path': 'address.country',
      'widget-data-source': {
        type: 'static',
        options: [
          { value: 'us', label: 'United States' },
          { value: 'uk', label: 'United Kingdom' },
        ],
      },
    },
  ],
};

// 5. Use in your app
export const ExampleApp = () => {
  return (
    <WidgetProvider store={store} apiAdapter={apiAdapter}>
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Example Form</h1>
        <WidgetRenderer config={exampleConfig} />
      </div>
    </WidgetProvider>
  );
};

