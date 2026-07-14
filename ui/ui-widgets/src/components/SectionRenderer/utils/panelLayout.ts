import { PanelConfig } from '../../../types';

export const countVerticalPanels = (panels: PanelConfig[]): number => {
  let count = 0;
  for (const panel of panels) {
    const orientation = panel['panel-orientation'] || 'vertical';

    if (orientation === 'horizontal' && panel.panels) {
      count += countVerticalPanels(panel.panels);
    } else if (orientation === 'vertical') {
      const columnSpan = panel['panel-column-span'] || 1;
      count += columnSpan;
      if (panel.panels && panel.panels.length > 0) {
        count += countVerticalPanels(panel.panels);
      }
    }
  }
  return count;
};

export const hasTableWidget = (
  panels: PanelConfig[],
  includeDialogTable = false,
): boolean => {
  for (const panel of panels) {
    if (panel.widgets) {
      for (const widget of panel.widgets) {
        if (
          widget.widget === 'table' ||
          widget['widget-type'] === 'table' ||
          (includeDialogTable && widget.widget === 'dialog-table')
        ) {
          return true;
        }
      }
    }
    if (panel.panels && hasTableWidget(panel.panels, includeDialogTable)) {
      return true;
    }
  }
  return false;
};

export const getTableWidgetColumnSpan = (panels: PanelConfig[]): number | null => {
  for (const panel of panels) {
    if (panel.widgets) {
      for (const widget of panel.widgets) {
        if (widget.widget === 'table' || widget['widget-type'] === 'table') {
          return widget['widget-column-span'] || null;
        }
      }
    }
    if (panel.panels) {
      const nestedSpan = getTableWidgetColumnSpan(panel.panels);
      if (nestedSpan !== null) {
        return nestedSpan;
      }
    }
  }
  return null;
};

export const resolveSectionColumnSpan = (
  panels: PanelConfig[],
  gridColumnSpan?: number,
): { columnSpan: number; hasTable: boolean; hasExplicitTableSpan: boolean } => {
  const hasTable = hasTableWidget(panels);
  const tableWidgetColumnSpan = getTableWidgetColumnSpan(panels);
  const verticalPanelsCount = countVerticalPanels(panels);
  const columnSpan =
    gridColumnSpan ||
    (tableWidgetColumnSpan !== null
      ? tableWidgetColumnSpan
      : hasTable
        ? Math.max(verticalPanelsCount, 2)
        : verticalPanelsCount);

  return {
    columnSpan,
    hasTable,
    hasExplicitTableSpan: tableWidgetColumnSpan !== null,
  };
};
