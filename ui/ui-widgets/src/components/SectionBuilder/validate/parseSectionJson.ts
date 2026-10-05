import type { SectionConfig } from '../../../types';
import { getWidgetCategory } from '../../../registry/widgetTypes';
import { validateSection } from './validateSection';
import { parseJsonSyntax, type JsonSyntaxHint } from './parseJsoncSyntax';

export type { JsonSyntaxHint };

export type SectionJsonParseResult = {
  isValid: boolean;
  errors: string[];
  parsed?: SectionConfig;
  jsonSyntaxValid: boolean;
  jsonSyntaxHint?: JsonSyntaxHint;
};

function autoPopulateWidgetType(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;

  const processWidget = (widget: any): any => {
    if (!widget || typeof widget !== 'object') return widget;

    const widgetType = widget.widget;
    let next = widget;
    if (widgetType && !widget['widget-type']) {
      next = {
        ...widget,
        'widget-type': getWidgetCategory(widgetType),
      };
    }

    if (next.widgets && Array.isArray(next.widgets)) {
      next = { ...next, widgets: next.widgets.map(processWidget) };
    }

    if (next['widget-item']) {
      next = { ...next, 'widget-item': processWidget(next['widget-item']) };
    }

    if (next['widget-data-columns'] && Array.isArray(next['widget-data-columns'])) {
      next = {
        ...next,
        'widget-data-columns': next['widget-data-columns'].map((col: any) => {
          if (col && typeof col === 'object' && col.widget && !col['widget-type']) {
            return { ...col, 'widget-type': getWidgetCategory(col.widget) };
          }
          return col;
        }),
      };
    }

    return next;
  };

  const processPanel = (panel: any): any => {
    if (!panel || typeof panel !== 'object') return panel;

    let processed = { ...panel };

    if (processed.widgets && Array.isArray(processed.widgets)) {
      processed.widgets = processed.widgets.map(processWidget);
    }

    if (processed.panels && Array.isArray(processed.panels)) {
      processed.panels = processed.panels.map(processPanel);
    }

    return processed;
  };

  const record = data as Record<string, unknown>;
  if (record.panels && Array.isArray(record.panels)) {
    return { ...record, panels: record.panels.map(processPanel) };
  }

  return data;
}

export function parseSectionJson(text: string): SectionJsonParseResult {
  const syntax = parseJsonSyntax(text);

  if (!syntax.jsonSyntaxValid) {
    return {
      isValid: false,
      errors: syntax.errors,
      jsonSyntaxValid: false,
      jsonSyntaxHint: syntax.jsonSyntaxHint,
    };
  }

  const processed = autoPopulateWidgetType(syntax.parsed) as SectionConfig;
  const validation = validateSection(processed);

  return {
    isValid: validation.isValid,
    errors: validation.errors,
    parsed: processed,
    jsonSyntaxValid: true,
  };
}
