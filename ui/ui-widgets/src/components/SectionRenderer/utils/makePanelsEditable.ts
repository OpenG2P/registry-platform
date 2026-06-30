import { PanelConfig, SectionConfig } from '../../../types';

export const makePanelsEditable = (
  panels: PanelConfig[],
  editable: boolean,
  sectionEditable: boolean,
): PanelConfig[] =>
  panels.map((panel) => ({
    ...panel,
    panels: panel.panels
      ? makePanelsEditable(panel.panels, editable, sectionEditable)
      : undefined,
    widgets: panel.widgets?.map((widget) => ({
      ...widget,
      'widget-readonly': editable
        ? sectionEditable
          ? false
          : widget['widget-readonly'] || false
        : true,
    })),
  }));

export const buildEditableSection = (
  section: SectionConfig,
  widgetsEditable: boolean,
): SectionConfig => ({
  ...section,
  panels: makePanelsEditable(
    section.panels,
    widgetsEditable,
    section['section-editable'] === true,
  ),
});
