import type { BaseWidgetConfig } from '../types';

export const WIDGET_TYPES = [
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'radio',
  'checkbox',
  'file',
  'table',
  'dialog-table',
  'phone',
  'display',
  'profile',
  'header-section',
  'scores-display',
  'id-authentication',
  'register-lookup',
  'parent-lookup',
  'multi-select',
  'geo-hierarchy',
  'docs',
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

export function getWidgetCategory(widget: string): 'input' | 'layout' | 'table' | 'group' {
  switch (widget) {
    case 'table':
    case 'dialog-table':
      return 'table';
    case 'profile':
    case 'header-section':
    case 'scores-display':
    case 'docs':
      return 'layout';
    default:
      return 'input';
  }
}

export function createDefaultWidgetConfig(widgetType: string): BaseWidgetConfig {
  const category = getWidgetCategory(widgetType);
  const config: BaseWidgetConfig = {
    widget: widgetType,
    'widget-id': `widget-${Date.now()}`,
    'widget-label': `New ${widgetType.replace(/-/g, ' ')} widget`,
    'widget-type': category,
  };

  if (category === 'input' || category === 'table') {
    config['widget-data-path'] = '';
  }

  if (category === 'table') {
    config['widget-data-columns'] = [];
  }

  return config;
}
