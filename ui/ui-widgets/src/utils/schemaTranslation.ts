import { UISchema, SectionConfig, PanelConfig, BaseWidgetConfig } from '../types';

export const translateWidgetConfig = (
  widgetConfig: BaseWidgetConfig,
  translate: (key: string, options?: any) => string
): BaseWidgetConfig => {
  const translated: BaseWidgetConfig = { ...widgetConfig };

  const isTranslationKey = (str: string): boolean => {
    return str.includes('.') || str.includes(':');
  };

  if (translated['widget-label'] && typeof translated['widget-label'] === 'string') {
    const label = translated['widget-label'];
    if (isTranslationKey(label)) {
      translated['widget-label'] = translate(label, { defaultValue: label });
    }
  }

  if (translated['widget-data-placeholder'] && typeof translated['widget-data-placeholder'] === 'string') {
    const placeholder = translated['widget-data-placeholder'];
    if (isTranslationKey(placeholder)) {
      translated['widget-data-placeholder'] = translate(placeholder, { defaultValue: placeholder });
    }
  }

  if (translated['widget-data-helptext'] && typeof translated['widget-data-helptext'] === 'string') {
    const helptext = translated['widget-data-helptext'];
    if (isTranslationKey(helptext)) {
      translated['widget-data-helptext'] = translate(helptext, { defaultValue: helptext });
    }
  }

  if (translated['widget-data-tooltip'] && typeof translated['widget-data-tooltip'] === 'string') {
    const tooltip = translated['widget-data-tooltip'];
    if (isTranslationKey(tooltip)) {
      translated['widget-data-tooltip'] = translate(tooltip, { defaultValue: tooltip });
    }
  }

  if (translated['widget-data-add-label'] && typeof translated['widget-data-add-label'] === 'string') {
    const addLabel = translated['widget-data-add-label'];
    if (isTranslationKey(addLabel)) {
      translated['widget-data-add-label'] = translate(addLabel, { defaultValue: addLabel });
    }
  }

  if (translated['widget-data-columns'] && Array.isArray(translated['widget-data-columns'])) {
    translated['widget-data-columns'] = translated['widget-data-columns'].map((col) => {
      if (col['widget-label'] && typeof col['widget-label'] === 'string') {
        const colLabel = col['widget-label'];
        if (isTranslationKey(colLabel)) {
          return {
            ...col,
            'widget-label': translate(colLabel, { defaultValue: colLabel }),
          };
        }
      }
      return col;
    });
  }

  if (translated.widgets && Array.isArray(translated.widgets)) {
    translated.widgets = translated.widgets.map((widget) =>
      translateWidgetConfig(widget, translate)
    );
  }

  if (translated['widget-item']) {
    translated['widget-item'] = translateWidgetConfig(translated['widget-item'], translate);
  }

  const dataSource = translated['widget-data-source'];
  if (dataSource && typeof dataSource === 'object' && 'type' in dataSource) {
    if (dataSource.type === 'static' && 'options' in dataSource && Array.isArray(dataSource.options)) {
      translated['widget-data-source'] = {
        ...dataSource,
        options: dataSource.options.map((option: { value: string | number; label: string }) => {
          if (option.label && typeof option.label === 'string') {
            return {
              ...option,
              label: translate(option.label, { defaultValue: option.label }),
            };
          }
          return option;
        }),
      };
    }
  }

  return translated;
};

export const translatePanelConfig = (
  panel: PanelConfig,
  translate: (key: string, options?: any) => string
): PanelConfig => {
  const translated: PanelConfig = { ...panel };

  if (translated.panels && Array.isArray(translated.panels)) {
    translated.panels = translated.panels.map((p) => translatePanelConfig(p, translate));
  }

  if (translated.widgets && Array.isArray(translated.widgets)) {
    translated.widgets = translated.widgets.map((widget) =>
      translateWidgetConfig(widget, translate)
    );
  }

  return translated;
};

export const translateUISchema = (
  schema: UISchema,
  translate: (key: string, options?: any) => string
): UISchema => {
  return {
    ...schema,
    sections: schema.sections.map((section) => {
      const translatedSection: SectionConfig = { ...section };

      if (translatedSection['section-title'] && typeof translatedSection['section-title'] === 'string') {
        const title = translatedSection['section-title'];
        if (title.includes('.') || title.includes(':')) {
          translatedSection['section-title'] = translate(title, { defaultValue: title });
        }
      }

      if (translatedSection.panels && Array.isArray(translatedSection.panels)) {
        translatedSection.panels = translatedSection.panels.map((panel) =>
          translatePanelConfig(panel, translate)
        );
      }

      return translatedSection;
    }),
  };
};
